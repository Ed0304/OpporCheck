"""Direct image OCR tests: validation, limits, inference, and failures.

Run (from the backend/ directory):  python -m unittest discover -s tests

PaddleOCR itself is never imported here: inference is stubbed through the
app.ocr seams (_load_engine, _run_predict), while validation, decoding,
aggregation, limits, and error mapping run for real. The one real-model
smoke test lives in benchmarks/paddleocr-phase0/ (that venv has paddle).
"""

from __future__ import annotations

import io
import json
import os
import tempfile
import time
import unittest
from unittest import mock

from PIL import Image

from app import ocr as ocr_mod
from app.ocr import (
    MAX_IMAGE_BYTES,
    MAX_IMAGE_DIMENSION,
    MAX_IMAGE_PIXELS,
    MAX_OCR_CHARS,
    OCRError,
    extract_image_text,
    normalize_language,
    sanitize_filename,
)


def make_image_bytes(fmt: str = "PNG", size: tuple[int, int] = (200, 100)) -> bytes:
    img = Image.new("RGB", size, "white")
    buf = io.BytesIO()
    img.save(buf, fmt)
    return buf.getvalue()


def stub_engine(*args, **kwargs):
    return object()


def stub_predict(texts, scores):
    def _fake(engine, image):
        return (texts, scores)

    return _fake


def drain_slot(timeout: float = 5.0) -> None:
    """Waits until the OCR single-flight slot is free again."""
    deadline = time.time() + timeout
    while time.time() < deadline:
        if ocr_mod._OCR_SLOT.acquire(blocking=False):
            ocr_mod._OCR_SLOT.release()
            return
        time.sleep(0.02)
    raise AssertionError("OCR slot did not free up after a test")


class ValidationTests(unittest.TestCase):
    def test_valid_png_upload(self):
        with mock.patch.object(ocr_mod, "_load_engine", stub_engine), mock.patch.object(
            ocr_mod, "_run_predict", stub_predict(["Hello"], [0.99])
        ):
            result = extract_image_text(
                "offer.png", make_image_bytes("PNG"), language="en",
                content_type="image/png",
            )
        self.assertEqual(result.text, "Hello")
        self.assertEqual(result.lines, 1)
        self.assertAlmostEqual(result.mean_confidence, 0.99)
        self.assertEqual(result.low_confidence_lines, 0)
        self.assertFalse(result.truncated)
        self.assertEqual(result.language, "en")

    def test_valid_jpeg_upload(self):
        with mock.patch.object(ocr_mod, "_load_engine", stub_engine), mock.patch.object(
            ocr_mod, "_run_predict", stub_predict(["Line one", "Line two"], [0.9, 0.8])
        ):
            result = extract_image_text(
                "photo.JPG", make_image_bytes("JPEG"), language="id",
                content_type="image/jpeg",
            )
        self.assertEqual(result.text, "Line one\nLine two")
        self.assertEqual(result.lines, 2)
        self.assertAlmostEqual(result.mean_confidence, 0.85)
        self.assertEqual(result.low_confidence_lines, 1)
        self.assertEqual(result.language, "id")

    def test_invalid_mime_type_is_rejected(self):
        with self.assertRaises(OCRError) as ctx:
            extract_image_text(
                "anim.gif", make_image_bytes("PNG"), content_type="image/gif"
            )
        self.assertEqual(ctx.exception.status_code, 400)

    def test_invalid_image_signature_is_rejected(self):
        with self.assertRaises(OCRError) as ctx:
            extract_image_text("fake.png", b"not an image at all")
        self.assertEqual(ctx.exception.status_code, 400)

    def test_empty_upload_is_rejected(self):
        with self.assertRaises(OCRError) as ctx:
            extract_image_text("empty.png", b"")
        self.assertEqual(ctx.exception.status_code, 400)

    def test_oversize_upload_is_rejected(self):
        with self.assertRaises(OCRError) as ctx:
            extract_image_text("big.png", b"\x89PNG\r\n\x1a\n" + b"x" * MAX_IMAGE_BYTES)
        self.assertEqual(ctx.exception.status_code, 413)

    def test_excessive_dimensions_are_rejected(self):
        content = make_image_bytes("PNG", size=(MAX_IMAGE_DIMENSION + 1, 10))
        with self.assertRaises(OCRError) as ctx:
            extract_image_text("wide.png", content)
        self.assertEqual(ctx.exception.status_code, 413)

    def test_excessive_pixels_are_rejected(self):
        # 5001 x 5000 = 25,005,000 px > MAX_IMAGE_PIXELS; solid color keeps
        # the file small while the decoded bitmap would be ~75 MB.
        self.assertGreater(5001 * 5000, MAX_IMAGE_PIXELS)
        content = make_image_bytes("PNG", size=(5001, 5000))
        with self.assertRaises(OCRError) as ctx:
            extract_image_text("huge.png", content)
        self.assertEqual(ctx.exception.status_code, 413)

    def test_corrupt_image_is_rejected(self):
        valid = make_image_bytes("PNG")
        with self.assertRaises(OCRError) as ctx:
            extract_image_text("cut.png", valid[:100])
        self.assertEqual(ctx.exception.status_code, 400)

    def test_wrong_extension_is_rejected(self):
        with self.assertRaises(OCRError) as ctx:
            extract_image_text("photo.gif", make_image_bytes("PNG"))
        self.assertEqual(ctx.exception.status_code, 400)

    def test_mime_signature_mismatch_is_rejected(self):
        with self.assertRaises(OCRError) as ctx:
            extract_image_text(
                "photo.png", make_image_bytes("JPEG"), content_type="image/png"
            )
        self.assertEqual(ctx.exception.status_code, 400)
        with self.assertRaises(OCRError) as ctx2:
            extract_image_text(
                "photo.jpg", make_image_bytes("PNG"), content_type="image/jpeg"
            )
        self.assertEqual(ctx2.exception.status_code, 400)


class LanguageTests(unittest.TestCase):
    def test_supported_languages_are_accepted(self):
        for code in ("en", "id", "ms", "ja", "zh-Hant", "zh-Hans"):
            self.assertEqual(normalize_language(code), code)

    def test_language_matching_is_case_insensitive(self):
        self.assertEqual(normalize_language("EN"), "en")
        self.assertEqual(normalize_language("zh-hant"), "zh-Hant")

    def test_missing_language_defaults_to_english(self):
        self.assertEqual(normalize_language(None), "en")
        self.assertEqual(normalize_language("  "), "en")

    def test_thai_and_vietnamese_are_rejected(self):
        for code in ("th", "vi", "thai", "vietnamese"):
            with self.assertRaises(OCRError) as ctx:
                normalize_language(code)
            self.assertEqual(ctx.exception.status_code, 400)
            self.assertIn("not supported", str(ctx.exception))

    def test_unknown_language_is_rejected(self):
        with self.assertRaises(OCRError) as ctx:
            normalize_language("xx")
        self.assertEqual(ctx.exception.status_code, 400)


class FilenameTests(unittest.TestCase):
    def test_sanitize_strips_paths(self):
        self.assertEqual(sanitize_filename("C:\\fakepath\\offer.png"), "offer.png")
        self.assertEqual(sanitize_filename("../../etc/x.png"), "x.png")
        self.assertEqual(sanitize_filename(""), "upload.png")

    def test_errors_never_echo_the_raw_filename(self):
        nasty = "Amina_Khan_passport_copy.png"
        with self.assertRaises(OCRError) as ctx:
            extract_image_text(nasty, b"garbage")
        self.assertNotIn("Amina", str(ctx.exception))


class InferenceTests(unittest.TestCase):
    def test_engine_import_failure_maps_to_503(self):
        with mock.patch.dict(os.environ, {"OCR_MODEL_CACHE": tempfile.mkdtemp()}):
            with mock.patch.object(
                ocr_mod, "_import_paddleocr", side_effect=ImportError("no paddle")
            ):
                with self.assertRaises(OCRError) as ctx:
                    extract_image_text("a.png", make_image_bytes("PNG"))
        self.assertEqual(ctx.exception.status_code, 503)

    def test_unwritable_cache_dir_maps_to_503(self):
        with tempfile.NamedTemporaryFile() as blocker:
            with mock.patch.dict(os.environ, {"OCR_MODEL_CACHE": blocker.name}):
                # A file where a directory must be: makedirs fails.
                with self.assertRaises(OCRError) as ctx:
                    ocr_mod._ensure_cache_dir()
        self.assertEqual(ctx.exception.status_code, 503)

    def test_inference_failure_maps_to_500_without_details(self):
        def _boom(engine, image):
            raise RuntimeError("pir::ArrayAttribute exploded")

        with mock.patch.object(ocr_mod, "_load_engine", stub_engine), mock.patch.object(
            ocr_mod, "_run_predict", _boom
        ):
            with self.assertRaises(OCRError) as ctx:
                extract_image_text("a.png", make_image_bytes("PNG"))
        self.assertEqual(ctx.exception.status_code, 500)
        self.assertNotIn("pir::", str(ctx.exception))

    def test_blank_result_maps_to_422(self):
        with mock.patch.object(ocr_mod, "_load_engine", stub_engine), mock.patch.object(
            ocr_mod, "_run_predict", stub_predict(["   ", ""], [0.5, 0.4])
        ):
            with self.assertRaises(OCRError) as ctx:
                extract_image_text("blank.png", make_image_bytes("PNG"))
        self.assertEqual(ctx.exception.status_code, 422)

    def test_long_output_is_truncated(self):
        long_text = "w" * (MAX_OCR_CHARS + 5000)
        with mock.patch.object(ocr_mod, "_load_engine", stub_engine), mock.patch.object(
            ocr_mod, "_run_predict", stub_predict([long_text], [0.99])
        ):
            result = extract_image_text("long.png", make_image_bytes("PNG"))
        self.assertTrue(result.truncated)
        self.assertEqual(len(result.text), MAX_OCR_CHARS)

    def test_processing_timeout_returns_504(self):
        def _slow(engine, image):
            time.sleep(0.3)
            return (["late"], [0.9])

        try:
            with mock.patch.object(ocr_mod, "_load_engine", stub_engine), mock.patch.object(
                ocr_mod, "_run_predict", _slow
            ):
                with self.assertRaises(OCRError) as ctx:
                    extract_image_text("a.png", make_image_bytes("PNG"), timeout=0.02)
            self.assertEqual(ctx.exception.status_code, 504)
        finally:
            drain_slot()

    def test_busy_engine_returns_429(self):
        acquired = ocr_mod._OCR_SLOT.acquire(blocking=False)
        self.assertTrue(acquired)
        try:
            with mock.patch.object(ocr_mod, "_load_engine", stub_engine), mock.patch.object(
                ocr_mod, "_run_predict", stub_predict(["x"], [0.9])
            ):
                with self.assertRaises(OCRError) as ctx:
                    extract_image_text("a.png", make_image_bytes("PNG"))
            self.assertEqual(ctx.exception.status_code, 429)
        finally:
            ocr_mod._OCR_SLOT.release()

    def test_no_document_derived_files_are_written(self):
        with tempfile.TemporaryDirectory() as tmp:
            env = {"TMPDIR": tmp, "TEMP": tmp, "TMP": tmp}
            with mock.patch.dict(os.environ, env):
                with mock.patch.object(ocr_mod, "_load_engine", stub_engine):
                    with mock.patch.object(
                        ocr_mod, "_run_predict", stub_predict(["seen"], [0.95])
                    ):
                        extract_image_text("doc.png", make_image_bytes("PNG"))
            leftovers = [
                os.path.join(root, name)
                for root, _, files in os.walk(tmp)
                for name in files
            ]
            self.assertEqual(leftovers, [])


class OcrRouteTests(unittest.TestCase):
    """Exercises the route's sync core (no event loop needed)."""

    def test_route_returns_ocr_shape_without_scores(self):
        import json as _json

        from app.main import ocr_response

        with mock.patch.object(ocr_mod, "_load_engine", stub_engine), mock.patch.object(
            ocr_mod, "_run_predict", stub_predict(["L1", "L2"], [0.95, 0.7])
        ):
            response = ocr_response(
                "scan.png", "image/png", "ms", make_image_bytes("PNG")
            )
        self.assertEqual(response.status_code, 200)
        payload = _json.loads(response.body.decode("utf-8"))
        self.assertEqual(payload["filename"], "scan.png")
        self.assertEqual(payload["text"], "L1\nL2")
        self.assertEqual(payload["pages"], 1)
        self.assertEqual(payload["page_texts"], ["L1\nL2"])
        self.assertEqual(payload["source"], "ocr")
        self.assertEqual(payload["language"], "ms")
        self.assertEqual(payload["lines"], 2)
        self.assertAlmostEqual(payload["mean_confidence"], 0.825)
        self.assertEqual(payload["low_confidence_lines"], 1)
        self.assertFalse(payload["truncated"])
        self.assertNotIn("scores", payload)
        self.assertNotIn("rec_scores", payload)

    def test_route_maps_ocr_errors(self):
        from app.main import ocr_response

        response = ocr_response("scan.png", "image/png", "th", make_image_bytes("PNG"))
        self.assertEqual(response.status_code, 400)
        payload = json.loads(response.body.decode("utf-8"))
        self.assertIn("not supported", payload["error"])

    def test_route_sanitizes_filename(self):
        from app.main import ocr_response

        with mock.patch.object(ocr_mod, "_load_engine", stub_engine), mock.patch.object(
            ocr_mod, "_run_predict", stub_predict(["x"], [0.9])
        ):
            response = ocr_response(
                "..\\..\\secret.png", "image/png", "en", make_image_bytes("PNG")
            )
        payload = json.loads(response.body.decode("utf-8"))
        self.assertEqual(payload["filename"], "secret.png")

    def test_ocr_route_is_registered_and_stateless(self):
        from app.main import app

        paths = sorted(route.path for route in app.routes if hasattr(route, "path"))
        self.assertIn("/api/v1/documents/ocr", paths)
        for path in paths:
            self.assertNotIn("{", path, f"parameterized route could leak state: {path}")


if __name__ == "__main__":
    unittest.main()
