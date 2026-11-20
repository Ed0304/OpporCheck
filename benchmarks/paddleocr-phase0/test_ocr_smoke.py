"""Phase 1 real-model smoke test (benchmark env only, not app tests).

Imports the real backend app code (backend/app) and runs one end-to-end
OCR through ocr_response() with the real PaddleOCR engine on a synthetic
sample. Ordinary backend tests stub inference; this is the one test that
does not mock OCR behavior.

Run from benchmarks/paddleocr-phase0 with the benchmark venv:
    .venv/Scripts/python.exe test_ocr_smoke.py
"""

import bench_env  # noqa: F401  (must be first: redirects caches)

import json
import sys
import unittest
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[2] / "backend"
sys.path.insert(0, str(BACKEND))

from app.main import ocr_response  # noqa: E402

from bench_env import BENCH  # noqa: E402


class RealModelSmokeTests(unittest.TestCase):
    def test_english_sample_end_to_end(self):
        content = (BENCH / "samples" / "en_offer.png").read_bytes()
        response = ocr_response("en_offer.png", "image/png", "en", content)
        self.assertEqual(response.status_code, 200)
        payload = json.loads(response.body.decode("utf-8"))
        self.assertEqual(payload["source"], "ocr")
        self.assertEqual(payload["language"], "en")
        self.assertEqual(payload["pages"], 1)
        self.assertIn("GBP 11.50", payload["text"])
        self.assertGreater(payload["lines"], 5)
        self.assertGreaterEqual(payload["mean_confidence"], 0.9)
        self.assertNotIn("scores", payload)

    def test_thai_rejected_without_inference(self):
        content = (BENCH / "samples" / "en_offer.png").read_bytes()
        response = ocr_response("en_offer.png", "image/png", "th", content)
        self.assertEqual(response.status_code, 400)


if __name__ == "__main__":
    unittest.main(verbosity=2)
