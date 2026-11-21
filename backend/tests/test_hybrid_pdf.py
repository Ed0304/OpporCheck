"""Hybrid PDF extraction tests: native-first page routing with OCR fallback.

Run (from the backend/ directory):  python -m unittest discover -s tests

Fixtures are generated in-process (no binary files, no network): text PDFs
via the shared make_pdf builder, scanned-image PDFs via Pillow's PDF
writer, mixed PDFs by merging both with pypdf, and text+image pages via a
hand-built PDF with an image XObject. Rendering and inference are stubbed
through the documents seams; the real-model smoke corpus lives in
benchmarks/paddleocr-phase0/ (that venv has paddle + PyMuPDF).
"""

from __future__ import annotations

import io
import unittest
from unittest import mock

from PIL import Image as PILImage
from pypdf import PdfReader, PdfWriter

from app import documents as documents_mod
from app import ocr as ocr_mod
from app.documents import (
    DocumentError,
    extract_pdf_text,
)
from app.ocr import OCRError
from test_documents import make_pdf


def make_image_pdf(page_count: int = 1) -> bytes:
    """Image-only PDF pages (simulated scans): no extractable text."""
    images = []
    for _ in range(page_count):
        img = PILImage.new("RGB", (400, 300), "white")
        images.append(img)
    buf = io.BytesIO()
    images[0].save(buf, "PDF", save_all=True, append_images=images[1:])
    return buf.getvalue()


def make_mixed_pdf(parts: list[tuple[str, str]]) -> bytes:
    """Merges single pages in order; part is ("text", line) or ("image", "")."""
    writer = PdfWriter()
    for kind, line in parts:
        if kind == "text":
            writer.append(io.BytesIO(make_pdf([line])))
        else:
            writer.append(io.BytesIO(make_image_pdf(1)))
    buf = io.BytesIO()
    writer.write(buf)
    return buf.getvalue()


def make_pdf_raw(streams: list[bytes]) -> bytes:
    """Single/multi-page PDF with caller-supplied raw content streams."""
    out = bytearray(b"%PDF-1.4\n")
    offsets: list[int] = []

    def obj(number: int, body: bytes) -> None:
        offsets.append(len(out))
        out.extend(f"{number} 0 obj\n".encode("ascii"))
        out.extend(body)
        out.extend(b"\nendobj\n")

    kids = " ".join(f"{3 + i * 2} 0 R" for i in range(len(streams)))
    obj(1, b"<< /Type /Catalog /Pages 2 0 R >>")
    obj(
        2,
        f"<< /Type /Pages /Kids [{kids}] /Count {len(streams)} >>".encode("ascii"),
    )
    font_number = 3 + len(streams) * 2
    for index, stream in enumerate(streams):
        page_number = 3 + index * 2
        content_number = page_number + 1
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
    for index in range(len(streams)):
        order.extend([3 + index * 2, 4 + index * 2])
    order.append(font_number)
    for i in range(1, total):
        out.extend(f"{offsets[order.index(i)]:010d} 00000 n \n".encode("ascii"))
    out.extend(
        f"trailer\n<< /Size {total} /Root 1 0 R >>\nstartxref\n{xref_at}\n%%EOF".encode(
            "ascii"
        )
    )
    return bytes(out)


def make_text_image_pdf(text: str) -> bytes:
    """One page with real text plus a 1x1 image XObject."""
    out = bytearray(b"%PDF-1.4\n")
    offsets: list[int] = []

    def obj(number: int, body: bytes) -> None:
        offsets.append(len(out))
        out.extend(f"{number} 0 obj\n".encode("ascii"))
        out.extend(body)
        out.extend(b"\nendobj\n")

    safe = text.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
    stream = f"BT /F1 12 Tf 72 720 Td ({safe}) Tj ET q 1 0 0 1 72 700 cm /Im1 Do Q".encode(
        "ascii"
    )
    obj(1, b"<< /Type /Catalog /Pages 2 0 R >>")
    obj(2, b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>")
    obj(
        3,
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
        b"/Contents 4 0 R /Resources << /Font << /F1 5 0 R >> "
        b"/XObject << /Im1 6 0 R >> >> >>",
    )
    offsets.append(len(out))
    out.extend(b"4 0 obj\n")
    out.extend(f"<< /Length {len(stream)} >>\nstream\n".encode("ascii"))
    out.extend(stream)
    out.extend(b"\nendstream\nendobj\n")
    obj(5, b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")
    offsets.append(len(out))
    out.extend(b"6 0 obj\n")
    out.extend(
        b"<< /Type /XObject /Subtype /Image /Width 1 /Height 1 "
        b"/ColorSpace /DeviceRGB /BitsPerComponent 8 /Length 3 >>\nstream\n"
    )
    out.extend(bytes([200, 100, 50]))
    out.extend(b"\nendstream\nendobj\n")

    xref_at = len(out)
    out.extend(b"xref\n0 7\n")
    out.extend(b"0000000000 65535 f \n")
    for i in range(1, 7):
        out.extend(f"{offsets[i - 1]:010d} 00000 n \n".encode("ascii"))
    out.extend(
        f"trailer\n<< /Size 7 /Root 1 0 R >>\nstartxref\n{xref_at}\n%%EOF".encode(
            "ascii"
        )
    )
    return bytes(out)


TEXT_PAGE = (
    "Base salary is 12.50 per hour with overtime paid monthly "
    "under the seasonal agricultural worker agreement terms."
)


def stub_ocr(texts=("Scanned line one", "Scanned line two"), scores=(0.95, 0.82)):
    def _fake(image, det_model, rec_model):
        return (list(texts), list(scores))

    return _fake


def fake_render(image=None):
    def _fake(content, page_index, dpi):
        return image or PILImage.new("RGB", (800, 600), "white")

    return _fake


class ClassificationTests(unittest.TestCase):
    def test_native_pages_never_touch_renderer_or_engine(self):
        with mock.patch.object(
            ocr_mod, "_load_engine", mock.Mock()
        ) as load_mock, mock.patch.object(
            documents_mod, "_render_page_to_image", mock.Mock()
        ) as render_mock:
            result = extract_pdf_text("text.pdf", make_pdf([TEXT_PAGE, TEXT_PAGE]))
        load_mock.assert_not_called()
        render_mock.assert_not_called()
        self.assertEqual(result.source, "native")
        self.assertEqual([p.source for p in result.page_results], ["native", "native"])
        self.assertIn("Base salary", result.text)

    def test_page_number_only_page_goes_to_ocr(self):
        with mock.patch.object(
            documents_mod, "_render_page_to_image", fake_render()
        ), mock.patch.object(documents_mod, "_ocr_rendered_page", stub_ocr()):
            result = extract_pdf_text("footer.pdf", make_pdf(["Page 12"]))
        self.assertEqual(result.page_results[0].source, "ocr")
        self.assertIn("Scanned line", result.text)

    def test_symbols_only_page_goes_to_ocr(self):
        with mock.patch.object(
            documents_mod, "_render_page_to_image", fake_render()
        ), mock.patch.object(documents_mod, "_ocr_rendered_page", stub_ocr()):
            result = extract_pdf_text("symbols.pdf", make_pdf(["*** ### @@@ ???"]))
        self.assertEqual(result.page_results[0].source, "ocr")

    def test_empty_page_without_images_skips_ocr(self):
        with mock.patch.object(
            documents_mod, "_render_page_to_image", mock.Mock()
        ) as render_mock:
            result = extract_pdf_text(
                "sparse.pdf", make_pdf([TEXT_PAGE, ""])
            )
        render_mock.assert_not_called()
        self.assertEqual(
            [p.source for p in result.page_results], ["native", "native_empty"]
        )
        self.assertEqual(result.page_results[1].status, "empty")
        self.assertEqual(result.source, "native")

    def test_scanned_pdf_ocrs_every_page(self):
        with mock.patch.object(
            documents_mod, "_render_page_to_image", fake_render()
        ), mock.patch.object(documents_mod, "_ocr_rendered_page", stub_ocr()):
            result = extract_pdf_text("scan.pdf", make_image_pdf(2))
        self.assertEqual(result.source, "ocr")
        self.assertEqual([p.source for p in result.page_results], ["ocr", "ocr"])
        self.assertEqual(result.page_results[0].status, "ok")
        self.assertAlmostEqual(result.page_results[0].mean_confidence or 0, 0.885)
        self.assertEqual(result.page_results[0].low_confidence_lines, 1)

    def test_mixed_orderings_keep_page_attribution(self):
        for parts, expected in [
            ([("text", TEXT_PAGE), ("image", "")], ["native", "ocr"]),
            ([("image", ""), ("text", TEXT_PAGE)], ["ocr", "native"]),
            (
                [("text", TEXT_PAGE), ("image", ""), ("text", TEXT_PAGE), ("image", "")],
                ["native", "ocr", "native", "ocr"],
            ),
        ]:
            with mock.patch.object(
                documents_mod, "_render_page_to_image", fake_render()
            ), mock.patch.object(documents_mod, "_ocr_rendered_page", stub_ocr()):
                result = extract_pdf_text("mixed.pdf", make_mixed_pdf(parts))
            self.assertEqual(
                [p.source for p in result.page_results], expected, parts
            )
            self.assertEqual(result.source, "mixed")
            self.assertIn("Base salary", result.text)
            self.assertIn("Scanned line", result.text)
            # Joined text and per-page texts stay aligned by index.
            self.assertEqual(len(result.page_texts), len(parts))
            for i, (page, text) in enumerate(
                zip(result.page_results, result.page_texts)
            ):
                self.assertEqual(page.text, text)
                self.assertEqual(page.page_number, i + 1)

    def test_only_ocr_pages_are_rendered(self):
        with mock.patch.object(
            documents_mod, "_render_page_to_image", mock.Mock(side_effect=fake_render())
        ) as render_mock, mock.patch.object(
            documents_mod, "_ocr_rendered_page", stub_ocr()
        ):
            extract_pdf_text(
                "mixed.pdf",
                make_mixed_pdf([("text", TEXT_PAGE), ("image", ""), ("text", TEXT_PAGE)]),
            )
        self.assertEqual(render_mock.call_count, 1)

    def test_native_page_with_embedded_image_warns(self):
        with mock.patch.object(
            documents_mod, "_render_page_to_image", mock.Mock()
        ) as render_mock:
            result = extract_pdf_text(
                "fig.pdf", make_text_image_pdf("Quarterly revenue figures are attached below for review")
            )
        render_mock.assert_not_called()
        page = result.page_results[0]
        self.assertEqual(page.source, "native")
        self.assertIsNotNone(page.warning)
        self.assertIn("images", (page.warning or "").lower())

    def test_meaningful_text_thresholds(self):
        self.assertFalse(documents_mod._is_meaningful("Page 12"))
        self.assertFalse(documents_mod._is_meaningful("*** ###"))
        self.assertFalse(documents_mod._is_meaningful("a b c d e"))
        self.assertTrue(documents_mod._is_meaningful(TEXT_PAGE))

    def test_corrupt_native_text_falls_back_to_ocr(self):
        self.assertTrue(documents_mod._looks_corrupt("Salary is \ufffd\ufffd\ufffd ok"))
        self.assertFalse(documents_mod._looks_corrupt(TEXT_PAGE))
        # Undefined WinAnsi bytes decode to replacement chars in pypdf.
        stream = (
            b"BT /F1 12 Tf 72 720 Td (ok "
            + b"\x81" * 60
            + b" end of line here now with enough words to pass thresholds easily) Tj ET"
        )
        with mock.patch.object(
            documents_mod,
            "_render_page_to_image",
            mock.Mock(side_effect=fake_render()),
        ) as render_mock, mock.patch.object(
            documents_mod, "_ocr_rendered_page", stub_ocr()
        ):
            result = extract_pdf_text("corrupt.pdf", make_pdf_raw([stream]))
        self.assertEqual(render_mock.call_count, 1)
        self.assertEqual(result.page_results[0].source, "ocr")


class FailureTests(unittest.TestCase):
    def test_render_failure_preserves_siblings(self):
        def _boom(content, page_index, dpi):
            raise documents_mod._RenderError("render_failed")

        with mock.patch.object(documents_mod, "_render_page_to_image", _boom):
            result = extract_pdf_text(
                "mixed.pdf", make_mixed_pdf([("text", TEXT_PAGE), ("image", "")])
            )
        self.assertEqual(
            [(p.source, p.status) for p in result.page_results],
            [("native", "ok"), ("failed", "failed")],
        )
        self.assertEqual(result.page_results[1].failure_code, "render_failed")
        self.assertEqual(result.page_results[1].text, "")
        self.assertEqual(result.source, "mixed")
        self.assertIn("Base salary", result.text)

    def test_missing_engine_marks_pages_unavailable(self):
        def _unavailable(image, det_model, rec_model):
            raise OCRError("no engine", status_code=503)

        with mock.patch.object(
            documents_mod, "_render_page_to_image", fake_render()
        ), mock.patch.object(documents_mod, "_ocr_rendered_page", _unavailable):
            with self.assertRaises(OCRError) as ctx:
                extract_pdf_text("scan.pdf", make_image_pdf(1))
            self.assertEqual(ctx.exception.status_code, 503)
            # Partial success still returns 200 with explicit codes.
            partial = extract_pdf_text(
                "mixed.pdf", make_mixed_pdf([("text", TEXT_PAGE), ("image", "")])
            )
            self.assertEqual(partial.page_results[1].failure_code, "ocr_unavailable")
            self.assertIn("Base salary", partial.text)

    def test_inference_failure_is_per_page(self):
        def _boom(image, det_model, rec_model):
            raise RuntimeError("predictor exploded")

        with mock.patch.object(
            documents_mod, "_render_page_to_image", fake_render()
        ), mock.patch.object(documents_mod, "_ocr_rendered_page", _boom):
            result = extract_pdf_text(
                "mixed.pdf", make_mixed_pdf([("text", TEXT_PAGE), ("image", "")])
            )
        self.assertEqual(result.page_results[1].failure_code, "ocr_failed")
        self.assertIn("Base salary", result.text)

    def test_busy_slot_fails_ocr_pages_with_429(self):
        acquired = ocr_mod._OCR_SLOT.acquire(blocking=False)
        self.assertTrue(acquired)
        try:
            with self.assertRaises(OCRError) as ctx:
                extract_pdf_text("scan.pdf", make_image_pdf(1))
            self.assertEqual(ctx.exception.status_code, 429)
        finally:
            ocr_mod._OCR_SLOT.release()

    def test_busy_slot_preserves_native_pages(self):
        acquired = ocr_mod._OCR_SLOT.acquire(blocking=False)
        self.assertTrue(acquired)
        try:
            result = extract_pdf_text(
                "mixed.pdf", make_mixed_pdf([("text", TEXT_PAGE), ("image", "")])
            )
        finally:
            ocr_mod._OCR_SLOT.release()
        self.assertEqual([p.source for p in result.page_results], ["native", "failed"])
        self.assertEqual(result.page_results[1].failure_code, "busy")
        self.assertIn("Base salary", result.text)

    def test_job_timeout_fails_pending_ocr_pages(self):
        def _timeout(job_fn, timeout):
            raise OCRError("timed out", status_code=504)

        with mock.patch.object(ocr_mod, "run_ocr_job", _timeout):
            with self.assertRaises(OCRError) as ctx:
                extract_pdf_text("scan.pdf", make_image_pdf(2))
        self.assertEqual(ctx.exception.status_code, 504)

    def test_pixel_budget_blocks_ocr_pages(self):
        patches = (
            mock.patch.object(documents_mod, "_render_page_to_image", fake_render()),
            mock.patch.object(documents_mod, "_ocr_rendered_page", stub_ocr()),
            mock.patch.object(documents_mod, "MAX_RENDER_PIXELS_TOTAL", 10),
        )
        for patcher in patches:
            patcher.start()
        try:
            partial = extract_pdf_text(
                "mixed.pdf", make_mixed_pdf([("text", TEXT_PAGE), ("image", "")])
            )
            self.assertEqual(partial.page_results[1].failure_code, "pixel_budget")
            self.assertIn("Base salary", partial.text)
            with self.assertRaises(DocumentError) as ctx:
                extract_pdf_text("scan.pdf", make_image_pdf(1))
            self.assertEqual(ctx.exception.status_code, 422)
        finally:
            for patcher in patches:
                patcher.stop()

    def test_ocr_blank_result_marks_page_empty(self):
        with mock.patch.object(
            documents_mod, "_render_page_to_image", fake_render()
        ), mock.patch.object(
            documents_mod, "_ocr_rendered_page", stub_ocr([], [])
        ):
            with self.assertRaises(DocumentError) as ctx:
                extract_pdf_text("blank-scan.pdf", make_image_pdf(1))
        self.assertEqual(ctx.exception.status_code, 422)


class LimitTests(unittest.TestCase):
    def test_page_count_cap(self):
        with self.assertRaises(DocumentError) as ctx:
            extract_pdf_text("huge.pdf", make_pdf([TEXT_PAGE] * 31))
        self.assertEqual(ctx.exception.status_code, 413)

    def test_render_dimension_cap(self):
        with mock.patch.object(
            documents_mod, "_render_page_to_image", fake_render()
        ), mock.patch.object(
            documents_mod, "_ocr_rendered_page", stub_ocr()
        ), mock.patch.object(
            ocr_mod, "MAX_IMAGE_DIMENSION", 50
        ):
            result = extract_pdf_text(
                "mixed.pdf", make_mixed_pdf([("text", TEXT_PAGE), ("image", "")])
            )
        self.assertEqual(result.page_results[1].failure_code, "render_too_large")

    def test_dpi_setting_is_clamped_and_forwarded(self):
        seen: list[int] = []

        def _capture(content, page_index, dpi):
            seen.append(dpi)
            return PILImage.new("RGB", (800, 600), "white")

        for env_value, expected in [("200", 200), ("999", 200), ("10", 72), ("abc", 150)]:
            seen.clear()
            with mock.patch.dict("os.environ", {"OCR_RENDER_DPI": env_value}):
                with mock.patch.object(
                    documents_mod, "_render_page_to_image", _capture
                ), mock.patch.object(documents_mod, "_ocr_rendered_page", stub_ocr()):
                    extract_pdf_text("scan.pdf", make_image_pdf(1))
            self.assertEqual(seen, [expected], env_value)

    def test_joined_truncation_flags_later_pages(self):
        long_page = ("word " * 600).strip()  # ~3000 chars of real words
        with mock.patch.object(documents_mod, "MAX_TEXT_CHARS", 5000):
            result = extract_pdf_text("long.pdf", make_pdf([long_page] * 4))
        self.assertTrue(result.truncated)
        flags = [p.truncated for p in result.page_results]
        self.assertEqual(flags[0], False)
        self.assertTrue(any(flags[1:]))
        # Page texts stay complete even when the joined text is cut.
        self.assertTrue(all(len(t) > 2000 for t in result.page_texts))


class HybridRouteTests(unittest.TestCase):
    def test_route_returns_page_results(self):
        import json

        from app.main import extract_response

        with mock.patch.object(
            documents_mod, "_render_page_to_image", fake_render()
        ), mock.patch.object(documents_mod, "_ocr_rendered_page", stub_ocr()):
            response = extract_response(
                "mixed.pdf",
                "application/pdf",
                make_mixed_pdf([("text", TEXT_PAGE), ("image", "")]),
            )
        self.assertEqual(response.status_code, 200)
        payload = json.loads(response.body.decode("utf-8"))
        self.assertEqual(payload["source"], "mixed")
        self.assertEqual(payload["language"], "en")
        self.assertEqual(len(payload["page_results"]), 2)
        first, second = payload["page_results"]
        self.assertEqual(first["page"], 1)
        self.assertEqual(first["source"], "native")
        self.assertIsNone(first["mean_confidence"])
        self.assertEqual(second["page"], 2)
        self.assertEqual(second["source"], "ocr")
        self.assertAlmostEqual(second["mean_confidence"], 0.885)
        self.assertEqual(second["low_confidence_lines"], 1)
        self.assertNotIn("rec_scores", response.body.decode("utf-8"))

    def test_route_accepts_language(self):
        import json

        from app.main import extract_response

        response = extract_response(
            "text.pdf", "application/pdf", make_pdf([TEXT_PAGE]), language="ja"
        )
        payload = json.loads(response.body.decode("utf-8"))
        self.assertEqual(payload["language"], "ja")

        bad = extract_response("text.pdf", "application/pdf", make_pdf([TEXT_PAGE]), language="xx")
        self.assertEqual(bad.status_code, 400)
        thai = extract_response(
            "text.pdf", "application/pdf", make_pdf([TEXT_PAGE]), language="th"
        )
        self.assertEqual(thai.status_code, 400)

    def test_route_maps_hybrid_errors(self):
        from app.main import extract_response

        def _unavailable(image, det_model, rec_model):
            raise OCRError("no engine", status_code=503)

        with mock.patch.object(
            documents_mod, "_render_page_to_image", fake_render()
        ), mock.patch.object(documents_mod, "_ocr_rendered_page", _unavailable):
            response = extract_response("scan.pdf", "application/pdf", make_image_pdf(1))
        self.assertEqual(response.status_code, 503)

    def test_extract_route_registered(self):
        from app.main import app

        paths = sorted(route.path for route in app.routes if hasattr(route, "path"))
        self.assertIn("/api/v1/documents/extract", paths)


if __name__ == "__main__":
    unittest.main()
