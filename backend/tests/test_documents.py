"""PDF extraction tests: page-level text and failure handling.

Run (from the backend/ directory):  python -m unittest discover -s tests

Fixtures are generated in-process (no binary files, no network): valid
multi-page PDFs are assembled byte-by-byte with correct cross-reference
offsets, encrypted PDFs via pypdf's writer. Route tests call the route's
sync core directly (no event loop needed).
"""

from __future__ import annotations

import io
import unittest

from app.documents import (
    MAX_PDF_BYTES,
    DocumentError,
    extract_pdf_text,
)


def make_pdf(page_texts: list[str]) -> bytes:
    """Assembles a minimal valid PDF with one text line per page.

    Blank pages carry an empty content stream. Offsets are computed so
    the cross-reference table is exact.
    """
    out = bytearray(b"%PDF-1.4\n")
    offsets: list[int] = []

    def obj(number: int, body: bytes) -> None:
        offsets.append(len(out))
        out.extend(f"{number} 0 obj\n".encode("ascii"))
        out.extend(body)
        out.extend(b"\nendobj\n")

    kids = " ".join(f"{3 + i * 2} 0 R" for i in range(len(page_texts)))
    obj(1, f"<< /Type /Catalog /Pages 2 0 R >>".encode("ascii"))
    obj(2, f"<< /Type /Pages /Kids [{kids}] /Count {len(page_texts)} >>".encode("ascii"))
    font_number = 3 + len(page_texts) * 2
    for index, text in enumerate(page_texts):
        page_number = 3 + index * 2
        content_number = page_number + 1
        safe = text.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
        stream = f"BT /F1 12 Tf 72 720 Td ({safe}) Tj ET".encode("ascii")
        obj(
            page_number,
            f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
            f"/Contents {content_number} 0 R "
            f"/Resources << /Font << /F1 {font_number} 0 R >> >> >>".encode("ascii"),
        )
        offsets.append(len(out))
        out.extend(f"{content_number} 0 obj\n".encode("ascii"))
        out.extend(f"<< /Length {len(stream)} >>\nstream\n".encode("ascii"))
        out.extend(stream)
        out.extend(b"\nendstream\nendobj\n")
    obj(font_number, b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")

    xref_at = len(out)
    total = font_number + 1
    out.extend(f"xref\n0 {total}\n".encode("ascii"))
    out.extend(b"0000000000 65535 f \n")
    order = [1, 2]
    for index in range(len(page_texts)):
        order.extend([3 + index * 2, 4 + index * 2])
    order.append(font_number)
    for i in range(1, total):
        position = offsets[order.index(i)]
        out.extend(f"{position:010d} 00000 n \n".encode("ascii"))
    out.extend(
        f"trailer\n<< /Size {total} /Root 1 0 R >>\nstartxref\n{xref_at}\n%%EOF".encode(
            "ascii"
        )
    )
    return bytes(out)


def make_encrypted_pdf(password: str) -> bytes:
    from pypdf import PdfReader, PdfWriter

    writer = PdfWriter()
    reader = PdfReader(io.BytesIO(make_pdf(["Secret clause."])))
    writer.add_page(reader.pages[0])
    writer.encrypt(password)
    buffer = io.BytesIO()
    writer.write(buffer)
    return buffer.getvalue()


class PageExtractionTests(unittest.TestCase):
    def test_pages_come_back_separately_with_known_text(self):
        result = extract_pdf_text(
            "contract.pdf",
            make_pdf(
                [
                    "Base salary is 12.50 per hour.",
                    "Accommodation fee of 120 will be deducted monthly.",
                ]
            ),
        )
        self.assertEqual(result.pages, 2)
        self.assertEqual(
            list(result.page_texts),
            [
                "Base salary is 12.50 per hour.",
                "Accommodation fee of 120 will be deducted monthly.",
            ],
        )
        self.assertIn("Base salary", result.text)
        self.assertFalse(result.truncated)

    def test_blank_pages_yield_empty_page_text(self):
        result = extract_pdf_text("sparse.pdf", make_pdf(["Only this page has text.", ""]))
        self.assertEqual(result.pages, 2)
        self.assertEqual(result.page_texts[0], "Only this page has text.")
        self.assertEqual(result.page_texts[1], "")

    def test_oversize_uploads_are_rejected(self):
        with self.assertRaises(DocumentError) as ctx:
            extract_pdf_text("big.pdf", b"%PDF-" + b"x" * MAX_PDF_BYTES)
        self.assertEqual(ctx.exception.status_code, 413)

    def test_non_pdf_bytes_are_rejected(self):
        with self.assertRaises(DocumentError) as ctx:
            extract_pdf_text("notes.txt", b"just some pasted text")
        self.assertEqual(ctx.exception.status_code, 400)

    def test_corrupt_pdfs_are_rejected(self):
        with self.assertRaises(DocumentError):
            extract_pdf_text("broken.pdf", b"%PDF-1.4\n%truncated garbage((((")

    def test_password_protected_pdfs_are_rejected(self):
        with self.assertRaises(DocumentError) as ctx:
            extract_pdf_text("locked.pdf", make_encrypted_pdf("secret"))
        self.assertIn("password", str(ctx.exception).lower())

    def test_pdfs_without_extractable_text_are_rejected(self):
        with self.assertRaises(DocumentError) as ctx:
            extract_pdf_text("scanned.pdf", make_pdf(["", ""]))
        self.assertEqual(ctx.exception.status_code, 422)

    def test_truly_empty_pdfs_are_rejected_with_guidance(self):
        # Blank pages with no images are native_empty (no OCR attempted);
        # with nothing usable anywhere, the error must say how to proceed.
        # Scanned-image behavior moved to test_hybrid_pdf.py (Phase 2).
        with self.assertRaises(DocumentError) as ctx:
            extract_pdf_text("blank.pdf", make_pdf([""]))
        message = str(ctx.exception).lower()
        self.assertIn("no extractable text", message)
        self.assertIn("paste the text", message)


class ExtractRouteTests(unittest.TestCase):
    """Exercises the route's sync core (no event loop needed)."""

    def test_route_returns_page_texts(self):
        import json

        from app.main import extract_response

        response = extract_response(
            "contract.pdf", "application/pdf", make_pdf(["Page one text here."])
        )
        self.assertEqual(response.status_code, 200)
        payload = json.loads(response.body.decode("utf-8"))
        self.assertEqual(payload["pages"], 1)
        self.assertEqual(payload["page_texts"], ["Page one text here."])
        self.assertIn("Page one text", payload["text"])

    def test_route_rejects_non_pdf_mime(self):
        from app.main import extract_response

        response = extract_response("notes.txt", "text/plain", b"hello")
        self.assertEqual(response.status_code, 400)

    def test_route_maps_document_errors(self):
        from app.main import extract_response

        response = extract_response("scan.pdf", "application/pdf", make_pdf([""]))
        self.assertEqual(response.status_code, 422)

    def test_sequential_uploads_share_no_server_state(self):
        # The service is stateless: nothing uploaded can be fetched back.
        # Tripwire: the app must expose no document-fetch-by-id route.
        from app.main import app

        paths = sorted(
            route.path for route in app.routes if hasattr(route, "path")
        )
        for path in paths:
            self.assertNotIn("{", path, f"parameterized route could leak state: {path}")
        self.assertIn("/api/v1/documents/extract", paths)


if __name__ == "__main__":
    unittest.main()
