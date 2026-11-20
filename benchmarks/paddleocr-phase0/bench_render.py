"""PDF rendering feasibility via PyMuPDF (Phase 0).

Builds a synthetic 3-page PDF from sample PNGs, renders pages at several
resolutions fully in-memory, and OCRs two resolutions to quantify the
speed/quality tradeoff. Writes no intermediate image files.
"""

import bench_env  # noqa: F401  (must be first: redirects caches)

import io
import time

import numpy as np
import pymupdf
from paddleocr import PaddleOCR

from bench_env import BENCH
from metrics import cer

SAMPLES = BENCH / "samples"
PDF = SAMPLES / "multipage3.pdf"

BASE_KW = dict(
    use_doc_orientation_classify=False,
    use_doc_unwarping=False,
    use_textline_orientation=False,
    enable_mkldnn=False,
)


def build_pdf() -> None:
    doc = pymupdf.open()
    for name in ("en_offer", "id_offer", "ja_offer"):
        img = pymupdf.Pixmap(str(SAMPLES / f"{name}.png"))
        page = doc.new_page(width=img.width, height=img.height)
        page.insert_image(page.rect, stream=open(SAMPLES / f"{name}.png", "rb").read())
    doc.save(str(PDF))
    print(f"built {PDF} pages={doc.page_count} "
          f"bytes={PDF.stat().st_size / 1024:.0f}KB")


def render_page(doc: pymupdf.Document, index: int, dpi: int) -> np.ndarray:
    page = doc[index]
    pix = page.get_pixmap(dpi=dpi)
    arr = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, pix.n)
    return np.ascontiguousarray(arr[:, :, :3][:, :, ::-1])  # RGB -> BGR for OCR


def main() -> None:
    build_pdf()
    doc = pymupdf.open(str(PDF))
    print(f"pdf pages: {doc.page_count}")

    print("== render resolution sweep (page 0, in-memory) ==")
    for dpi in (72, 150, 300):
        t0 = time.perf_counter()
        arr = render_page(doc, 0, dpi)
        dt = time.perf_counter() - t0
        print(f"dpi={dpi} shape={arr.shape} ram_mb={arr.nbytes / 1e6:.1f} "
              f"render_seconds={dt:.2f}")

    print("== OCR quality vs resolution (page 0 = en_offer) ==")
    gt = (SAMPLES / "en_offer.gt.txt").read_text(encoding="utf-8")
    ocr = PaddleOCR(**BASE_KW)
    for dpi in (150, 300):
        arr = render_page(doc, 0, dpi)
        t0 = time.perf_counter()
        texts = ocr.predict(arr)[0].json["res"]["rec_texts"]
        dt = time.perf_counter() - t0
        print(f"dpi={dpi} infer_seconds={dt:.1f} lines={len(texts)} "
              f"cer={cer(gt, chr(10).join(texts)):.4f}")

    print("== multipage timing (150 dpi, in-memory render + OCR per page) ==")
    names = ("en_offer", "id_offer", "ja_offer")
    for i, name in enumerate(names):
        gt = (SAMPLES / f"{name}.gt.txt").read_text(encoding="utf-8")
        t0 = time.perf_counter()
        arr = render_page(doc, i, 150)
        t_render = time.perf_counter() - t0
        t0 = time.perf_counter()
        texts = ocr.predict(arr)[0].json["res"]["rec_texts"]
        t_ocr = time.perf_counter() - t0
        print(f"page{i} {name}: render={t_render:.2f}s ocr={t_ocr:.1f}s "
              f"cer={cer(gt, chr(10).join(texts)):.4f}")


if __name__ == "__main__":
    main()
