"""One-off: diff v6-small vs v6-medium output on zh_hant (Phase 1).

Determines whether the CER gap (0.1546 vs 0.1031) is spacing/punctuation
or real character errors. Prints both outputs plus a char diff.
"""

import bench_env  # noqa: F401  (must be first: redirects caches)

import difflib

from paddleocr import PaddleOCR

from bench_env import BENCH
from metrics import normalize

BASE_KW = dict(
    use_doc_orientation_classify=False,
    use_doc_unwarping=False,
    use_textline_orientation=False,
    enable_mkldnn=False,
)

img = str(BENCH / "samples" / "zh_hant_offer.png")
gt = (BENCH / "samples" / "zh_hant_offer.gt.txt").read_text(encoding="utf-8")

small = PaddleOCR(
    text_detection_model_name="PP-OCRv6_small_det",
    text_recognition_model_name="PP-OCRv6_small_rec",
    **BASE_KW,
)
medium = PaddleOCR(
    text_detection_model_name="PP-OCRv6_medium_det",
    text_recognition_model_name="PP-OCRv6_medium_rec",
    **BASE_KW,
)

s_texts = small.predict(img)[0].json["res"]["rec_texts"]
m_texts = medium.predict(img)[0].json["res"]["rec_texts"]

print("== GT ==")
print(normalize(gt))
print("== SMALL ==")
print(normalize("\n".join(s_texts)))
print("== MEDIUM ==")
print(normalize("\n".join(m_texts)))
print("== SMALL vs MEDIUM char diff ==")
for line in difflib.unified_diff(
    normalize("\n".join(s_texts)).split(" "),
    normalize("\n".join(m_texts)).split(" "),
    lineterm="",
):
    print(line)
