"""Phase 2 real-model hybrid smoke test (benchmark env only).

Imports the real backend app code and runs end-to-end hybrid extraction
through extract_pdf_text() with the real PyMuPDF renderer and the real
PaddleOCR engine. A counting wrapper around _run_predict verifies that
native-only PDFs never invoke inference and mixed PDFs OCR exactly the
scanned pages — the wrapper calls the real function (targeted
instrumentation, not mocked behavior).

Run from benchmarks/paddleocr-phase0 with the benchmark venv:
    .venv/Scripts/python.exe test_hybrid_smoke.py
"""

import bench_env  # noqa: F401  (must be first: redirects caches)

import sys
import unittest
from pathlib import Path
from unittest import mock

BACKEND = Path(__file__).resolve().parents[2] / "backend"
sys.path.insert(0, str(BACKEND))

from app import documents as documents_mod  # noqa: E402
from app import ocr as ocr_mod  # noqa: E402
from app.documents import extract_pdf_text  # noqa: E402

from bench_env import BENCH  # noqa: E402
from hybrid_fixtures import (  # noqa: E402
    build_mixed_pdf,
    build_native_pdf,
    build_scanned_pdf,
)

SAMPLES = BENCH / "samples"


class HybridSmokeTests(unittest.TestCase):
    def test_native_pdf_never_initializes_ocr(self):
        calls: list[str] = []
        real_predict = ocr_mod._run_predict

        def _counting(engine, image):
            calls.append("predict")
            return real_predict(engine, image)

        engines_before = dict(ocr_mod._ENGINES)
        with mock.patch.object(ocr_mod, "_run_predict", _counting):
            result = extract_pdf_text("native.pdf", build_native_pdf())
        self.assertEqual(result.source, "native")
        self.assertEqual([p.source for p in result.page_results], ["native"] * 3)
        # Native extraction preserves source line breaks (real behavior);
        # normalize whitespace before asserting content.
        self.assertIn("GBP 11.50", " ".join(result.text.split()))
        self.assertEqual(calls, [])
        self.assertEqual(ocr_mod._ENGINES, engines_before)

    def test_scanned_pdf_ocrs_with_real_content(self):
        result = extract_pdf_text("scanned.pdf", build_scanned_pdf())
        self.assertEqual(result.source, "ocr")
        self.assertEqual([p.source for p in result.page_results], ["ocr"] * 3)
        # Real recognized content from three known samples.
        self.assertIn("GBP 11.50", result.text)
        self.assertIn("4.500.000", result.text)
        self.assertIn("220,000", result.text)
        for page in result.page_results:
            self.assertEqual(page.status, "ok")
            self.assertIsNotNone(page.mean_confidence)
            self.assertGreaterEqual(page.mean_confidence or 0.0, 0.85)

    def test_mixed_pdf_ocrs_only_scanned_pages(self):
        calls: list[str] = []
        real_predict = ocr_mod._run_predict

        def _counting(engine, image):
            calls.append("predict")
            return real_predict(engine, image)

        with mock.patch.object(ocr_mod, "_run_predict", _counting):
            result = extract_pdf_text("mixed.pdf", build_mixed_pdf())
        self.assertEqual(result.source, "mixed")
        self.assertEqual(
            [p.source for p in result.page_results], ["native", "ocr", "native"]
        )
        self.assertEqual(len(calls), 1)
        self.assertIn("GBP 11.50", result.text)
        # Attribution: joined text and per-page texts stay index-aligned.
        self.assertEqual(len(result.page_texts), 3)
        for page, text in zip(result.page_results, result.page_texts):
            self.assertEqual(page.text, text)


if __name__ == "__main__":
    unittest.main(verbosity=2)
