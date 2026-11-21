"""Hybrid PDF text extraction for opportunity review uploads (Phase 2).

Stateless utility: validates the upload, extracts native text with pypdf
page by page, and falls back to PaddleOCR (via PyMuPDF rendering) only
for pages without meaningful native text. Nothing is stored, so document
ownership is preserved at the investigation layer.

Every page gets an explicit outcome (native / ocr / native_empty /
failed); failed pages are reported per page, never silently dropped.
Region-level detection inside partially scanned pages is NOT attempted:
a page with adequate native text keeps it even if it also embeds images
(flagged with a warning instead).
"""

from __future__ import annotations

import os
from dataclasses import dataclass, replace
from io import BytesIO

from pypdf import PdfReader
from pypdf.errors import PdfReadError

from . import ocr as ocr_mod
from .ocr import OCRError, normalize_language

MAX_PDF_BYTES = 10 * 1024 * 1024  # 10 MB
MAX_TEXT_CHARS = 60_000  # matches the Firestore postingText rules limit
PDF_MAGIC = b"%PDF-"

MAX_PDF_PAGES = 30  # whole-file page cap (413 beyond)
RENDER_DPI_DEFAULT = 150  # Phase 0: 150 and 300 DPI measured identical CER
RENDER_DPI_MIN = 72
RENDER_DPI_MAX = 200  # never above without measured evidence
MAX_RENDER_PIXELS_TOTAL = 150_000_000  # rendered-pixel budget per request
OCR_BUDGET_SECONDS = 600.0  # total OCR deadline per PDF request

# A page counts as text-based only with real content: page numbers,
# footers, and isolated symbols must not mark a scan as native, while
# short genuine titles ("Employment Contract") must stay native. Very
# short pages below the bar fall back to OCR (correct output, bounded
# extra cost) rather than risk misclassifying a scan as text.
MIN_NATIVE_ALNUM = 12
MIN_NATIVE_WORDS = 2
# Share of U+FFFD replacement chars above which native text is corrupt.
CORRUPT_REPLACEMENT_RATIO = 0.1

SOURCE_NATIVE = "native"
SOURCE_OCR = "ocr"
SOURCE_NATIVE_EMPTY = "native_empty"
SOURCE_FAILED = "failed"


@dataclass(frozen=True)
class PageResult:
    page_number: int  # 1-based
    source: str  # native | ocr | native_empty | failed
    text: str
    truncated: bool
    mean_confidence: float | None  # set only for OCR pages
    low_confidence_lines: int
    status: str  # ok | empty | failed
    warning: str | None = None
    failure_code: str | None = None


@dataclass(frozen=True)
class ExtractionResult:
    text: str
    pages: int
    truncated: bool
    # Per-page normalized text ("" for blank pages); index + 1 is the page number.
    page_texts: tuple[str, ...]
    # Top-level source: native | ocr | mixed. "mixed" whenever page
    # outcomes are not uniformly successful native (or OCR) pages.
    source: str = SOURCE_NATIVE
    language: str = "en"
    page_results: tuple[PageResult, ...] = ()


def _normalize_page(part: str) -> str:
    """Normalizes one page the same way the joined text is normalized."""
    text = "\n".join(" ".join(line.split()) for line in part.strip().splitlines())
    return "\n\n".join(block for block in (b.strip() for b in text.split("\n\n")) if block)


class DocumentError(Exception):
    """User-facing document problem with an HTTP status code."""

    def __init__(self, message: str, status_code: int = 400) -> None:
        super().__init__(message)
        self.status_code = status_code


class _RenderError(Exception):
    """Internal render failure carrying a page-level failure code."""

    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


def _resolve_dpi() -> int:
    """Render resolution, operator-tunable within the measured-safe band."""
    try:
        dpi = int(os.environ.get("OCR_RENDER_DPI", str(RENDER_DPI_DEFAULT)))
    except ValueError:
        return RENDER_DPI_DEFAULT
    return max(RENDER_DPI_MIN, min(RENDER_DPI_MAX, dpi))


def _resolve(obj):
    """Unwraps pypdf indirect objects defensively."""
    get_object = getattr(obj, "get_object", None)
    if callable(get_object):
        try:
            return get_object()
        except Exception:
            return None
    return obj


def _page_has_images(page) -> bool:
    """Best-effort check for direct image XObjects on one page."""
    try:
        resources = _resolve(page.get("/Resources")) or {}
        xobjects = _resolve(resources.get("/XObject")) or {}
        items = xobjects.values() if hasattr(xobjects, "values") else []
        for item in items:
            target = _resolve(item)
            if target is not None and target.get("/Subtype") == "/Image":
                return True
        return False
    except Exception:
        return False


def _is_meaningful(text: str) -> bool:
    """True only for real content, not page numbers or stray symbols."""
    alnum = sum(1 for ch in text if ch.isalnum())
    words = text.split()
    return alnum >= MIN_NATIVE_ALNUM and len(words) >= MIN_NATIVE_WORDS


def _looks_corrupt(text: str) -> bool:
    """Flags native text dominated by replacement/control characters.

    pypdf passes undefined byte values through as raw control characters
    (verified: 0x81 bytes decode to U+0081, not U+FFFD), so both count.
    """
    if not text:
        return False
    bad = sum(
        1 for ch in text if ch == "\ufffd" or (not ch.isprintable() and ch not in "\n\t ")
    )
    return bad / len(text) > CORRUPT_REPLACEMENT_RATIO


def _import_fitz():  # seam for tests to simulate a missing renderer
    import fitz  # noqa: PLC0415 (lazy: only needed for scanned pages)

    return fitz


def _render_page_to_image(content: bytes, page_index: int, dpi: int):
    """Renders one PDF page to an in-memory RGB Pillow image."""
    try:
        fitz = _import_fitz()
    except ImportError as exc:
        raise _RenderError("render_unavailable") from exc
    try:
        doc = fitz.open(stream=content, filetype="pdf")
    except Exception as exc:
        raise _RenderError("render_failed") from exc
    try:
        try:
            pix = doc[page_index].get_pixmap(dpi=dpi, alpha=False)
        except Exception as exc:
            raise _RenderError("render_failed") from exc
        mode = {1: "L", 3: "RGB", 4: "RGBA"}.get(pix.n)
        if mode is None:
            raise _RenderError("render_failed")
        from PIL import Image

        return Image.frombytes(mode, (pix.width, pix.height), pix.samples).convert("RGB")
    finally:
        doc.close()


def _ocr_rendered_page(image, det_model: str, rec_model: str):
    """Runs one rendered page through the shared OCR engine (no slot here)."""
    from .ocr import _load_engine, _run_predict

    engine = _load_engine(det_model, rec_model)
    return _run_predict(engine, image)


def extract_pdf_text(
    filename: str,
    content: bytes,
    language: str | None = None,
    ocr_timeout: float | None = None,
) -> ExtractionResult:
    """Validate and extract text from uploaded PDF bytes (hybrid)."""
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
        page_count = len(reader.pages)
    except PdfReadError as exc:
        raise DocumentError(
            f'"{filename}" could not be read ({exc}). The file may be corrupt.'
        ) from exc
    if page_count > MAX_PDF_PAGES:
        raise DocumentError(
            f'"{filename}" has more than the {MAX_PDF_PAGES}-page limit. '
            "Please upload a shorter file or paste the text instead.",
            status_code=413,
        )
    try:
        chosen = normalize_language(language)
    except OCRError as exc:
        raise DocumentError(str(exc), status_code=exc.status_code) from exc

    dpi = _resolve_dpi()
    det_model, rec_model = ocr_mod.MODEL_BY_LANGUAGE[chosen]

    # Pass 1: native extraction + classification (no OCR engine touched).
    planned: list[dict] = []
    for index in range(page_count):
        try:
            page = reader.pages[index]
            raw = page.extract_text() or ""
            has_images = _page_has_images(page)
        except Exception:
            # Any per-page failure (including corrupt content streams)
            # marks just this page; siblings are still preserved.
            planned.append({"index": index, "kind": "failed", "code": "extract_failed"})
            continue
        normalized = _normalize_page(raw)
        if not normalized:
            if has_images:
                planned.append({"index": index, "kind": "ocr"})
            else:
                planned.append({"index": index, "kind": "empty"})
        elif not _is_meaningful(normalized) or _looks_corrupt(normalized):
            planned.append({"index": index, "kind": "ocr"})
        else:
            planned.append(
                {
                    "index": index,
                    "kind": "native",
                    "text": normalized,
                    "warning": (
                        "This page also contains images that were not read."
                        if has_images
                        else None
                    ),
                }
            )

    # Pass 2: OCR exactly the pages that need it, under one slot + budget.
    ocr_pages = [p for p in planned if p["kind"] == "ocr"]
    ocr_outcomes: dict[int, dict] = {}
    if ocr_pages:
        budget = ocr_timeout if ocr_timeout is not None else OCR_BUDGET_SECONDS
        rendered_pixels = 0

        def _job():
            nonlocal rendered_pixels
            outcomes: dict[int, dict] = {}
            for entry in ocr_pages:
                index = entry["index"]
                try:
                    image = _render_page_to_image(content, index, dpi)
                except _RenderError as exc:
                    outcomes[index] = {"failed": exc.code}
                    continue
                width, height = image.size
                if (
                    width > ocr_mod.MAX_IMAGE_DIMENSION
                    or height > ocr_mod.MAX_IMAGE_DIMENSION
                ):
                    outcomes[index] = {"failed": "render_too_large"}
                    continue
                if rendered_pixels + width * height > MAX_RENDER_PIXELS_TOTAL:
                    outcomes[index] = {"failed": "pixel_budget"}
                    continue
                rendered_pixels += width * height
                try:
                    texts, scores = _ocr_rendered_page(image, det_model, rec_model)
                except OCRError as exc:
                    if exc.status_code == 503:
                        outcomes[index] = {"failed": "ocr_unavailable"}
                    else:
                        outcomes[index] = {"failed": "ocr_failed"}
                    continue
                except Exception:
                    outcomes[index] = {"failed": "ocr_failed"}
                    continue
                lines = [line for line in (t.strip() for t in texts) if line]
                text = "\n".join(lines).strip()
                if not text:
                    outcomes[index] = {"empty": True}
                    continue
                mean_confidence = sum(scores) / len(scores) if scores else 0.0
                low = sum(1 for s in scores if s < ocr_mod.LOW_CONFIDENCE_THRESHOLD)
                outcomes[index] = {
                    "text": text,
                    "mean_confidence": mean_confidence,
                    "low_confidence_lines": low,
                }
            return outcomes

        try:
            ocr_outcomes = ocr_mod.run_ocr_job(_job, budget)
        except OCRError as exc:
            # Slot busy or total budget exhausted: every pending OCR page
            # fails explicitly so native pages are still preserved.
            code = "busy" if exc.status_code == 429 else "timeout"
            for entry in ocr_pages:
                ocr_outcomes[entry["index"]] = {"failed": code}

    # Pass 3: assemble per-page results in order; never drop a page.
    page_results: list[PageResult] = []
    page_texts: list[str] = []
    for entry in planned:
        number = entry["index"] + 1
        kind = entry["kind"]
        if kind == "native":
            page_results.append(
                PageResult(
                    page_number=number,
                    source=SOURCE_NATIVE,
                    text=entry["text"],
                    truncated=False,
                    mean_confidence=None,
                    low_confidence_lines=0,
                    status="ok",
                    warning=entry["warning"],
                )
            )
            page_texts.append(entry["text"])
        elif kind == "empty":
            page_results.append(
                PageResult(
                    page_number=number,
                    source=SOURCE_NATIVE_EMPTY,
                    text="",
                    truncated=False,
                    mean_confidence=None,
                    low_confidence_lines=0,
                    status="empty",
                )
            )
            page_texts.append("")
        elif kind == "failed":
            page_results.append(
                PageResult(
                    page_number=number,
                    source=SOURCE_FAILED,
                    text="",
                    truncated=False,
                    mean_confidence=None,
                    low_confidence_lines=0,
                    status="failed",
                    failure_code=entry["code"],
                )
            )
            page_texts.append("")
        else:  # ocr
            outcome = ocr_outcomes.get(entry["index"], {"failed": "ocr_failed"})
            if "failed" in outcome:
                page_results.append(
                    PageResult(
                        page_number=number,
                        source=SOURCE_FAILED,
                        text="",
                        truncated=False,
                        mean_confidence=None,
                        low_confidence_lines=0,
                        status="failed",
                        failure_code=outcome["failed"],
                    )
                )
                page_texts.append("")
            elif "empty" in outcome:
                page_results.append(
                    PageResult(
                        page_number=number,
                        source=SOURCE_OCR,
                        text="",
                        truncated=False,
                        mean_confidence=None,
                        low_confidence_lines=0,
                        status="empty",
                    )
                )
                page_texts.append("")
            else:
                page_results.append(
                    PageResult(
                        page_number=number,
                        source=SOURCE_OCR,
                        text=outcome["text"],
                        truncated=False,
                        mean_confidence=outcome["mean_confidence"],
                        low_confidence_lines=outcome["low_confidence_lines"],
                        status="ok",
                    )
                )
                page_texts.append(outcome["text"])

    text = "\n\n".join(part.strip() for part in page_texts).strip()
    # Normalize excessive blank lines while keeping paragraph breaks.
    text = "\n".join(" ".join(line.split()) for line in text.splitlines())
    text = "\n\n".join(block for block in (b.strip() for b in text.split("\n\n")) if block)

    if not text:
        # Nothing usable by any means. Preserve actionable statuses when
        # every failure shares one cause; otherwise fall back to 422.
        codes = {
            p.failure_code for p in page_results if p.source == SOURCE_FAILED
        }
        if codes == {"busy"}:
            raise OCRError(
                "Another OCR request is still running. Please wait and try again.",
                status_code=429,
            )
        if codes == {"timeout"}:
            raise OCRError(
                "OCR processing timed out. Please try again with a smaller file.",
                status_code=504,
            )
        if codes == {"ocr_unavailable"}:
            raise OCRError(
                "OCR is not available on this server, and the PDF has no "
                "extractable text. Please paste the text instead.",
                status_code=503,
            )
        raise DocumentError(
            f'"{filename}" contains no extractable text. '
            "Please paste the text instead.",
            status_code=422,
        )

    truncated = len(text) > MAX_TEXT_CHARS
    joined = text[:MAX_TEXT_CHARS]
    # Mark pages at/after the joined-text ceiling (page texts stay complete).
    # Cumulative stripped lengths approximate the normalized join, erring
    # toward flagging the boundary page — the safe direction for a warning.
    if truncated:
        running = 0
        flagged: list[PageResult] = []
        for page in page_results:
            consumed = len(page.text.strip())
            if consumed:
                running += consumed + 2
            cut = consumed > 0 and running > MAX_TEXT_CHARS
            flagged.append(replace(page, truncated=cut) if cut else page)
        page_results = flagged

    ok_sources = {p.source for p in page_results if p.status == "ok"}
    has_failed = any(p.status == "failed" for p in page_results)
    if ok_sources == {SOURCE_NATIVE} and not has_failed:
        top_source = SOURCE_NATIVE
    elif ok_sources == {SOURCE_OCR} and not has_failed:
        top_source = SOURCE_OCR
    else:
        top_source = "mixed"

    return ExtractionResult(
        text=joined,
        pages=page_count,
        truncated=truncated,
        page_texts=tuple(page_texts),
        source=top_source,
        language=chosen,
        page_results=tuple(page_results),
    )


__all__ = [
    "CORRUPT_REPLACEMENT_RATIO",
    "MAX_PDF_BYTES",
    "MAX_PDF_PAGES",
    "MAX_RENDER_PIXELS_TOTAL",
    "MAX_TEXT_CHARS",
    "MIN_NATIVE_ALNUM",
    "MIN_NATIVE_WORDS",
    "OCR_BUDGET_SECONDS",
    "PDF_MAGIC",
    "RENDER_DPI_DEFAULT",
    "RENDER_DPI_MAX",
    "RENDER_DPI_MIN",
    "SOURCE_FAILED",
    "SOURCE_NATIVE",
    "SOURCE_NATIVE_EMPTY",
    "SOURCE_OCR",
    "DocumentError",
    "ExtractionResult",
    "PageResult",
    "extract_pdf_text",
]
