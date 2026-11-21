"""Direct image OCR for opportunity review uploads (Phase 1 + Phase 2).

Stateless request handling over process-wide lazy OCR engines: validates
the upload, decodes the image in memory, runs PaddleOCR 3.x CPU
inference, and returns text plus aggregate confidence. Nothing is stored,
no document-derived files are written, and no debug image/JSON output is
ever enabled.

Phase 2 reuses the engine singleton, single-flight slot, and bounded
prediction below for hybrid scanned-PDF pages (see documents.py).

Explicitly NOT supported: Thai and Vietnamese (no suitable tested model;
rejected with 400).
"""

from __future__ import annotations

import io
import os
import threading
from dataclasses import dataclass

from PIL import Image, UnidentifiedImageError

MAX_IMAGE_BYTES = 10 * 1024 * 1024  # 10 MB, parity with the PDF cap
MAX_IMAGE_DIMENSION = 8000  # either side, in pixels
MAX_IMAGE_PIXELS = 25_000_000  # decoded-pixel ceiling (25 MP)
MAX_OCR_CHARS = 60_000  # matches the Firestore postingText rules limit
OCR_TIMEOUT_SECONDS = 300.0  # per-request inference deadline
LOW_CONFIDENCE_THRESHOLD = 0.9  # lines below this count as low-confidence

JPEG_MAGIC = b"\xff\xd8\xff"
PNG_MAGIC = b"\x89PNG\r\n\x1a\n"
ALLOWED_CONTENT_TYPES = frozenset({"image/jpeg", "image/png"})
ALLOWED_EXTENSIONS = frozenset({".jpg", ".jpeg", ".png"})

# UI language code -> PaddleOCR lang code. Validated strictly; anything
# else (including th/vi, which have no tested Phase 1 model) is rejected.
OCR_LANGUAGES = {
    "en": "en",
    "id": "id",
    "ms": "ms",
    "ja": "japan",
    "zh-Hant": "chinese_cht",
    "zh-Hans": "ch",
}
DEFAULT_LANGUAGE = "en"

# (detection_model, recognition_model) per OCR language. PP-OCRv6 small is
# the primary candidate everywhere: the Phase 0 benchmark and the Phase 1
# small-vs-medium comparison (benchmarks/paddleocr-phase0/) measure it
# against medium per language. Medium stays available per language here if
# a regression is ever found; it is not the automatic default.
MODEL_BY_LANGUAGE = {
    "en": ("PP-OCRv6_small_det", "PP-OCRv6_small_rec"),
    "id": ("PP-OCRv6_small_det", "PP-OCRv6_small_rec"),
    "ms": ("PP-OCRv6_small_det", "PP-OCRv6_small_rec"),
    "ja": ("PP-OCRv6_small_det", "PP-OCRv6_small_rec"),
    "zh-Hant": ("PP-OCRv6_small_det", "PP-OCRv6_small_rec"),
    "zh-Hans": ("PP-OCRv6_small_det", "PP-OCRv6_small_rec"),
}

# Defense in depth: Pillow refuses to decode beyond our own pixel ceiling
# even if a caller skips the explicit size check below.
Image.MAX_IMAGE_PIXELS = MAX_IMAGE_PIXELS

_ENGINE_LOCK = threading.Lock()
_ENGINES: dict[tuple[str, str], object] = {}
# Strict single-flight: at most one inference runs at a time. Phase 0
# showed two threads on one engine serialize with no speedup, so extra
# requests fail fast with 429 instead of queueing unboundedly.
_OCR_SLOT = threading.Semaphore(1)


class OCRError(Exception):
    """User-facing OCR problem with an HTTP status code."""

    def __init__(self, message: str, status_code: int = 400) -> None:
        super().__init__(message)
        self.status_code = status_code


@dataclass(frozen=True)
class OCRResult:
    text: str
    lines: int
    mean_confidence: float
    low_confidence_lines: int
    truncated: bool
    language: str


def sanitize_filename(name: str) -> str:
    """Keeps a safe display basename; never trust client-supplied names."""
    base = name.replace("\\", "/").rsplit("/", 1)[-1].strip()
    base = "".join(ch for ch in base if ch.isprintable())
    if not base:
        return "upload.png"
    if len(base) > 120:
        stem, dot, ext = base.rpartition(".")
        base = (stem[: 120 - len(ext) - 1] + dot + ext) if dot else base[:120]
    return base


def normalize_language(language: str | None) -> str:
    """Validates the requested OCR language; rejects th/vi explicitly."""
    if language is None or not str(language).strip():
        return DEFAULT_LANGUAGE
    wanted = str(language).strip().lower()
    for canonical in OCR_LANGUAGES:
        if canonical.lower() == wanted:
            return canonical
    supported = ", ".join(sorted(OCR_LANGUAGES))
    if wanted in {"th", "vi", "thai", "vietnamese"}:
        raise OCRError(
            "Thai and Vietnamese are not supported for OCR. "
            f"Supported languages: {supported}."
        )
    raise OCRError(f"Unsupported OCR language. Supported languages: {supported}.")


def decode_image(content: bytes) -> Image.Image:
    """Validates magic bytes and decodes the image with Pillow.

    Checks dimensions from the image header before decoding pixels, so
    oversized images are rejected without allocating the full bitmap.
    """
    if not content.startswith(JPEG_MAGIC) and not content.startswith(PNG_MAGIC):
        raise OCRError("The uploaded file is not a valid JPEG or PNG image.")
    try:
        image = Image.open(io.BytesIO(content))
        width, height = image.size
    except (UnidentifiedImageError, OSError, ValueError) as exc:
        raise OCRError("The uploaded image could not be read. It may be corrupt.") from exc
    if width > MAX_IMAGE_DIMENSION or height > MAX_IMAGE_DIMENSION:
        raise OCRError(
            f"The image is larger than the {MAX_IMAGE_DIMENSION}px per-side limit.",
            status_code=413,
        )
    if width * height > MAX_IMAGE_PIXELS:
        raise OCRError("The image exceeds the total pixel limit.", status_code=413)
    try:
        image.load()
    except (OSError, ValueError) as exc:
        raise OCRError("The uploaded image could not be read. It may be corrupt.") from exc
    return image.convert("RGB")


def _import_paddleocr():  # seam for tests to simulate a missing engine
    from paddleocr import PaddleOCR  # noqa: PLC0415 (lazy: engine loads on first OCR)

    return PaddleOCR


def _ensure_cache_dir() -> None:
    """Makes the PaddleX model cache location explicit and writable.

    Operators set OCR_MODEL_CACHE (forwarded to PaddleX's documented
    PADDLE_PDX_CACHE_HOME); otherwise PaddleX uses ~/.paddlex. Must run
    before paddleocr is imported, since PaddleX reads the variable at
    import time. The cache holds model files only, never documents.
    """
    override = os.environ.get("OCR_MODEL_CACHE", "").strip()
    if override:
        os.environ["PADDLE_PDX_CACHE_HOME"] = override
    target = os.environ.get(
        "PADDLE_PDX_CACHE_HOME", os.path.join(os.path.expanduser("~"), ".paddlex")
    )
    try:
        os.makedirs(target, exist_ok=True)
    except OSError as exc:
        raise OCRError(
            "The OCR model cache is not writable. The operator must configure it.",
            status_code=503,
        ) from exc


def get_engine(det_model: str, rec_model: str) -> object:
    """Public engine accessor for hybrid PDF pages (see documents.py)."""
    return _load_engine(det_model, rec_model)


def _load_engine(det_model: str, rec_model: str) -> object:
    """Returns the cached engine for one model pair, loading it on demand."""
    key = (det_model, rec_model)
    with _ENGINE_LOCK:
        engine = _ENGINES.get(key)
        if engine is not None:
            return engine
        _ensure_cache_dir()
        try:
            paddle_ocr_cls = _import_paddleocr()
        except ImportError as exc:
            raise OCRError(
                "The OCR engine is not installed on this server.", status_code=503
            ) from exc
        # CPU inference; enable_mkldnn=False works around a oneDNN
        # execution failure observed on the benchmark CPU (plain paddle
        # mode). Orientation classifiers stay off for speed.
        engine = paddle_ocr_cls(
            text_detection_model_name=det_model,
            text_recognition_model_name=rec_model,
            use_doc_orientation_classify=False,
            use_doc_unwarping=False,
            use_textline_orientation=False,
            enable_mkldnn=False,
        )
        _ENGINES[key] = engine
        return engine


def _run_predict(engine: object, image: Image.Image) -> tuple[list[str], list[float]]:
    """Runs one 3.x predict() call; seam for tests to stub inference."""
    import numpy as np  # noqa: PLC0415 (lazy: only needed with the engine)

    array = np.asarray(image)[:, :, ::-1]  # RGB -> BGR channel flip (a view)
    data = engine.predict(array)[0].json["res"]  # type: ignore[union-attr]
    return list(data["rec_texts"]), [float(s) for s in data["rec_scores"]]


def _check_mime_and_extension(
    filename: str, content_type: str | None, content: bytes
) -> None:
    if content_type and content_type not in ALLOWED_CONTENT_TYPES:
        raise OCRError("Only JPEG and PNG images are supported.")
    lowered = filename.lower()
    if "." in lowered.rsplit("/", 1)[-1]:
        ext = "." + lowered.rsplit(".", 1)[-1]
        if ext not in ALLOWED_EXTENSIONS:
            raise OCRError("Only .jpg, .jpeg, and .png files are supported.")
    # Declared type must match the actual signature; neither is trusted alone.
    is_jpeg = content.startswith(JPEG_MAGIC)
    if content_type == "image/jpeg" and not is_jpeg:
        raise OCRError("The file was sent as JPEG but is not JPEG data.")
    if content_type == "image/png" and not content.startswith(PNG_MAGIC):
        raise OCRError("The file was sent as PNG but is not PNG data.")


def run_ocr_job(job_fn, timeout: float):
    """Runs one OCR job (single image or a PDF's OCR pages) under the slot.

    The job function runs on a daemon worker: at most one OCR job executes
    at a time (extras fail fast with 429) and the join deadline bounds
    total work (504 on expiry). A timed-out straggler keeps the slot until
    it finishes. Engine exceptions are mapped to user-safe OCRErrors.
    """
    if not _OCR_SLOT.acquire(blocking=False):
        raise OCRError(
            "Another OCR request is still running. Please wait and try again.",
            status_code=429,
        )
    box: dict[str, object] = {}

    def _work() -> None:
        try:
            box["result"] = job_fn()
        except OCRError as exc:
            box["error"] = exc
        except Exception as exc:  # never leak engine internals to callers
            box["error"] = OCRError("OCR processing failed. Please try again.", 500)
            box["cause"] = exc
        finally:
            _OCR_SLOT.release()

    worker = threading.Thread(target=_work, daemon=True)
    worker.start()
    worker.join(timeout)
    if worker.is_alive():
        # The straggler keeps the slot until it finishes, so further
        # requests fail fast with 429 instead of piling on.
        raise OCRError(
            "OCR processing timed out. Please try again with a smaller file.",
            status_code=504,
        )
    if "error" in box:
        raise box["error"]  # type: ignore[misc]
    return box["result"]


def extract_image_text(
    filename: str,
    content: bytes,
    language: str | None = None,
    content_type: str | None = None,
    timeout: float | None = None,
) -> OCRResult:
    """Validates an image upload and runs OCR with bounded resources."""
    chosen = normalize_language(language)
    if len(content) > MAX_IMAGE_BYTES:
        raise OCRError(
            "The image is larger than the 10 MB limit. "
            "Please upload a smaller file or paste the text instead.",
            status_code=413,
        )
    if not content:
        raise OCRError("The uploaded file is empty.")
    _check_mime_and_extension(filename, content_type, content)
    image = decode_image(content)
    det_model, rec_model = MODEL_BY_LANGUAGE[chosen]
    engine = _load_engine(det_model, rec_model)

    texts, scores = run_ocr_job(
        lambda: _run_predict(engine, image),
        timeout if timeout is not None else OCR_TIMEOUT_SECONDS,
    )

    lines = [line for line in (t.strip() for t in texts) if line]
    text = "\n".join(lines).strip()
    if not text:
        raise OCRError(
            "No readable text was found in the image. "
            "Please check the image or paste the text instead.",
            status_code=422,
        )
    mean_confidence = sum(scores) / len(scores) if scores else 0.0
    low = sum(1 for s in scores if s < LOW_CONFIDENCE_THRESHOLD)
    truncated = len(text) > MAX_OCR_CHARS
    return OCRResult(
        text=text[:MAX_OCR_CHARS],
        lines=len(lines),
        mean_confidence=mean_confidence,
        low_confidence_lines=low,
        truncated=truncated,
        language=chosen,
    )
