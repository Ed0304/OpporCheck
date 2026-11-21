"""Phase 2 hybrid performance evaluation (benchmark env, real engine).

Measures native vs scanned vs mixed PDFs: native extraction time,
rendered/OCR page counts, OCR seconds per page, total request time,
peak RSS, and cold vs warm engine initialization. Prints one table.

Run from benchmarks/paddleocr-phase0 with the benchmark venv:
    .venv/Scripts/python.exe bench_hybrid_perf.py
"""

import bench_env  # noqa: F401  (must be first: redirects caches)

import os
import sys
import threading
import time
from pathlib import Path

import psutil

BACKEND = Path(__file__).resolve().parents[2] / "backend"
sys.path.insert(0, str(BACKEND))

from app import documents as documents_mod  # noqa: E402
from app import ocr as ocr_mod  # noqa: E402
from app.documents import extract_pdf_text  # noqa: E402

from hybrid_fixtures import (  # noqa: E402
    build_mixed_pdf,
    build_native_pdf,
    build_scanned_pdf,
)

PROC = psutil.Process(os.getpid())


class PeakRSS:
    def __init__(self) -> None:
        self.peak = 0
        self._stop = threading.Event()
        self._thread = threading.Thread(target=self._run, daemon=True)

    def _run(self) -> None:
        while not self._stop.is_set():
            try:
                self.peak = max(self.peak, PROC.memory_info().rss)
            except psutil.Error:
                pass
            time.sleep(0.2)

    def __enter__(self) -> "PeakRSS":
        self._thread.start()
        return self

    def __exit__(self, *exc) -> None:
        self._stop.set()
        self._thread.join(timeout=2.0)


def main() -> None:
    native_pdf = build_native_pdf()
    scanned_pdf = build_scanned_pdf()
    mixed_pdf = build_mixed_pdf()
    print(f"engines loaded before: {len(ocr_mod._ENGINES)}")

    # Counting wrapper calls the real renderer/predictor (measured, not mocked).
    real_render = documents_mod._render_page_to_image
    real_predict = ocr_mod._run_predict
    renders: list[str] = []
    predicts: list[str] = []

    def _count_render(content, page_index, dpi):
        renders.append(f"p{page_index}@{dpi}")
        return real_render(content, page_index, dpi)

    def _count_predict(engine, image):
        predicts.append("ocr")
        return real_predict(engine, image)

    documents_mod._render_page_to_image = _count_render
    ocr_mod._run_predict = _count_predict
    try:
        with PeakRSS() as mem:
            t0 = time.perf_counter()
            native = extract_pdf_text("native.pdf", native_pdf)
            t_native = time.perf_counter() - t0
            print(
                f"native : {t_native:6.2f}s pages={native.pages} "
                f"renders={len(renders)} ocrs={len(predicts)} "
                f"source={native.source} engines={len(ocr_mod._ENGINES)}"
            )

            renders.clear()
            predicts.clear()
            t0 = time.perf_counter()
            cold = extract_pdf_text("scanned.pdf", scanned_pdf)
            t_cold = time.perf_counter() - t0
            ocr_secs_cold = t_cold
            print(
                f"scanned: {t_cold:6.2f}s pages={cold.pages} "
                f"renders={renders} ocrs={len(predicts)} "
                f"source={cold.source} engines={len(ocr_mod._ENGINES)}"
            )

            renders.clear()
            predicts.clear()
            t0 = time.perf_counter()
            warm = extract_pdf_text("scanned.pdf", scanned_pdf)
            t_warm = time.perf_counter() - t0
            print(
                f"warm   : {t_warm:6.2f}s pages={warm.pages} "
                f"renders={len(renders)} ocrs={len(predicts)} "
                f"source={warm.source}"
            )

            renders.clear()
            predicts.clear()
            t0 = time.perf_counter()
            mixed = extract_pdf_text("mixed.pdf", mixed_pdf)
            t_mixed = time.perf_counter() - t0
            print(
                f"mixed  : {t_mixed:6.2f}s pages={mixed.pages} "
                f"renders={renders} ocrs={len(predicts)} "
                f"source={mixed.source}"
            )
        print(f"peak RSS MB: {mem.peak / (1024 * 1024):.1f}")
        print(f"cold-init overhead ~ {ocr_secs_cold - t_warm:.1f}s (cold minus warm)")
    finally:
        documents_mod._render_page_to_image = real_render
        ocr_mod._run_predict = real_predict


if __name__ == "__main__":
    main()
