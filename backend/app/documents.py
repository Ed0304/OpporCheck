"""PDF text extraction for opportunity review uploads.

Stateless utility: validates the upload, extracts embedded text with pypdf,
and returns it. Nothing is stored, so document ownership is preserved at the
investigation layer (the extracted text is saved under the user's Firestore
ownerId along with the analysis).

Explicitly NOT supported: scanned-image PDFs (no OCR engine is installed).
Such files are reported as having no extractable text.
"""

from __future__ import annotations

from dataclasses import dataclass
from io import BytesIO

from pypdf import PdfReader
from pypdf.errors import PdfReadError

MAX_PDF_BYTES = 10 * 1024 * 1024  # 10 MB
MAX_TEXT_CHARS = 60_000  # matches the Firestore postingText rules limit
PDF_MAGIC = b"%PDF-"


@dataclass(frozen=True)
class ExtractionResult:
    text: str
    pages: int
    truncated: bool
    # Per-page normalized text ("" for blank pages); index + 1 is the page number.
    page_texts: tuple[str, ...]


def _normalize_page(part: str) -> str:
    """Normalizes one page the same way the joined text is normalized."""
    text = "\n".join(" ".join(line.split()) for line in part.strip().splitlines())
    return "\n\n".join(block for block in (b.strip() for b in text.split("\n\n")) if block)


class DocumentError(Exception):
    """User-facing document problem with an HTTP status code."""

    def __init__(self, message: str, status_code: int = 400) -> None:
        super().__init__(message)
        self.status_code = status_code


def extract_pdf_text(filename: str, content: bytes) -> ExtractionResult:
    """Validate and extract text from uploaded PDF bytes."""
    if len(content) > MAX_PDF_BYTES:
        raise DocumentError(
            f'"{filename}" is larger than the 10 MB limit. '
            "Please upload a smaller file or paste the text instead.",
            status_code=413,
        )
    if len(content) < len(PDF_MAGIC) or not content.startswith(PDF_MAGIC):
        raise DocumentError(
            f'"{filename}" is not a valid PDF file. Please upload a real .pdf file.',
        )
    try:
        # Lenient parsing: real-world PDFs often carry minor xref defects.
        reader = PdfReader(BytesIO(content), strict=False)
    except PdfReadError as exc:
        raise DocumentError(
            f'"{filename}" could not be opened as a PDF ({exc}). '
            "The file may be corrupt."
        ) from exc

    if reader.is_encrypted:
        try:
            unlocked = reader.decrypt("")
        except Exception as exc:
            raise DocumentError(
                f'"{filename}" is password-protected. Please remove the password '
                "or paste the text instead."
            ) from exc
        if not unlocked:
            raise DocumentError(
                f'"{filename}" is password-protected. Please remove the password '
                "or paste the text instead."
            )

    try:
        pages = len(reader.pages)
        parts = [(reader.pages[i].extract_text() or "") for i in range(pages)]
    except PdfReadError as exc:
        raise DocumentError(
            f'"{filename}" could not be read ({exc}). The file may be corrupt.'
        ) from exc

    text = "\n\n".join(part.strip() for part in parts).strip()
    # Normalize excessive blank lines while keeping paragraph breaks.
    text = "\n".join(" ".join(line.split()) for line in text.splitlines())
    text = "\n\n".join(block for block in (b.strip() for b in text.split("\n\n")) if block)

    if not text:
        raise DocumentError(
            f'"{filename}" contains no extractable text. Scanned PDFs are not '
            "supported (no OCR). Please paste the text instead.",
            status_code=422,
        )

    truncated = len(text) > MAX_TEXT_CHARS
    return ExtractionResult(
        text=text[:MAX_TEXT_CHARS],
        pages=pages,
        truncated=truncated,
        page_texts=tuple(_normalize_page(part) for part in parts),
    )
