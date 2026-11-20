"""Probe: default model discovery, cold init, first predict() (Phase 0).

Times PaddleOCR() construction (includes first-run model download) and one
predict() call. Prints resolved config, rec_texts, and score stats.
"""

import bench_env  # noqa: F401  (must be first: redirects caches)

import inspect
import time

import numpy as np
from paddleocr import PaddleOCR

from bench_env import BENCH

print("== PaddleOCR.__init__ signature ==")
print(inspect.signature(PaddleOCR.__init__))

print("== cold init (includes model download on first run) ==")
t0 = time.perf_counter()
# enable_mkldnn=False selects the plain paddle run mode: oneDNN execution
# fails on this CPU (NotImplementedError in onednn_instruction.cc).
# Same flag SignalBait uses.
ocr = PaddleOCR(
    use_doc_orientation_classify=False,
    use_doc_unwarping=False,
    use_textline_orientation=False,
    enable_mkldnn=False,
)
t1 = time.perf_counter()
print(f"cold_init_seconds: {t1 - t0:.1f}")

print("== resolved pipeline attributes ==")
for attr in ("pipeline_name", "pipeline", "config", "model_settings", "lang"):
    try:
        value = getattr(ocr, attr, "<missing>")
        text = str(value)
        print(f"{attr}: {text[:600]}")
    except Exception as exc:  # defensive introspection only
        print(f"{attr}: <error {exc}>")

img_path = str(BENCH / "samples" / "en_offer.png")
print(f"== predict(path) on {img_path} ==")
t0 = time.perf_counter()
results = ocr.predict(img_path)
t1 = time.perf_counter()
print(f"predict_path_seconds: {t1 - t0:.1f}")

for result in results:
    data = result.json["res"]
    texts = data["rec_texts"]
    scores = np.asarray(data["rec_scores"], dtype=float)
    print(f"lines: {len(texts)}")
    print(f"scores: min={scores.min():.3f} mean={scores.mean():.3f} "
          f"p10={np.percentile(scores, 10):.3f}")
    for line, score in zip(texts, scores):
        print(f"  [{score:.3f}] {line}")

print("== predict(numpy) in-memory input trial ==")
import cv2  # noqa: E402

arr = cv2.imread(img_path)
print(f"numpy shape: {arr.shape} dtype: {arr.dtype}")
t0 = time.perf_counter()
results2 = ocr.predict(arr)
t1 = time.perf_counter()
print(f"predict_numpy_seconds: {t1 - t0:.1f}")
data2 = results2[0].json["res"]
print(f"numpy lines: {len(data2['rec_texts'])}")
print("numpy first line:", data2["rec_texts"][0] if data2["rec_texts"] else "<none>")
