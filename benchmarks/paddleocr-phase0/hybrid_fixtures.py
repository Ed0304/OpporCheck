"""Hybrid-PDF fixtures for Phase 2 real-model tests (benchmark env).

Builds native (PyMuPDF text), scanned (Phase 0 sample PNGs as full-page
images), and mixed PDFs in memory. Scanned pages are sized so a 150 DPI
render reproduces roughly the sample PNG pixel dimensions (the scale
validated in Phase 0). All content is the existing synthetic corpus.
"""

import io

import fitz
from PIL import Image

from bench_env import BENCH

SAMPLES = BENCH / "samples"

NATIVE_TEXT = (
    "Offer of employment: Fruit Picker in Maidstone, United Kingdom. "
    "Basic pay GBP 11.50 per hour with overtime at GBP 17.25. "
    "Working hours are 40 hours per week across five days. "
    "Accommodation deduction of GBP 80.00 per week applies. "
    "The contract duration is six months starting 15 June 2026."
)


def _native_page(doc: fitz.Document, text: str) -> None:
    page = doc.new_page(width=595, height=842)
    rect = fitz.Rect(72, 72, 523, 770)
    page.insert_textbox(rect, text, fontsize=12, fontname="helv")


def _scanned_page(doc: fitz.Document, sample_name: str) -> None:
    raw = (SAMPLES / f"{sample_name}.png").read_bytes()
    pix = fitz.Pixmap(raw)
    # JPEG-encode like a real scanner so multi-page fixtures stay small.
    buf = io.BytesIO()
    Image.open(io.BytesIO(raw)).convert("RGB").save(buf, "JPEG", quality=85)
    page = doc.new_page(width=pix.width / 2, height=pix.height / 2)
    page.insert_image(page.rect, stream=buf.getvalue())


def build_native_pdf(pages: int = 3) -> bytes:
    doc = fitz.open()
    for _ in range(pages):
        _native_page(doc, NATIVE_TEXT)
    return doc.tobytes()


def build_scanned_pdf() -> bytes:
    doc = fitz.open()
    _scanned_page(doc, "en_offer")
    _scanned_page(doc, "id_offer")
    _scanned_page(doc, "ja_offer")
    return doc.tobytes()


def build_mixed_pdf() -> bytes:
    doc = fitz.open()
    _native_page(doc, NATIVE_TEXT)
    _scanned_page(doc, "en_offer")
    _native_page(doc, NATIVE_TEXT)
    return doc.tobytes()
