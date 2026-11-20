"""Phase 1 model comparison: v6-small vs v6-medium per language (benchmark env).

Matrix (identical ground-truth samples throughout):
  v6-small / v6-medium x {id, ms, ja, zh_hant, zh_hans} + v5-latin x {id, ms}.
EN baseline (small == medium) already established in Phase 0 and not rerun.
Writes results/compare_small_medium.json. Progress: one line per run.
"""

import bench_env  # noqa: F401  (must be first: redirects caches)

import json
import os
import threading
import time

import numpy as np
import psutil
from paddleocr import PaddleOCR

from bench_env import BENCH
from metrics import cer, numeric_check, wer

SAMPLES = BENCH / "samples"
RESULTS = BENCH / "results"

BASE_KW = dict(
    use_doc_orientation_classify=False,
    use_doc_unwarping=False,
    use_textline_orientation=False,
    enable_mkldnn=False,
)

CONFIGS = {
    "v6small": dict(
        text_detection_model_name="PP-OCRv6_small_det",
        text_recognition_model_name="PP-OCRv6_small_rec",
    ),
    "v6medium": dict(
        text_detection_model_name="PP-OCRv6_medium_det",
        text_recognition_model_name="PP-OCRv6_medium_rec",
    ),
    "v5latin": dict(
        text_detection_model_name="PP-OCRv5_mobile_det",
        text_recognition_model_name="latin_PP-OCRv5_mobile_rec",
    ),
}

PLAN = {
    "v6small": ["id_offer", "ms_offer", "ja_offer", "zh_hant_offer", "zh_hans_offer"],
    "v6medium": ["id_offer", "ms_offer", "ja_offer", "zh_hant_offer", "zh_hans_offer"],
    "v5latin": ["id_offer", "ms_offer"],
}

WER_SAMPLES = {"id_offer", "ms_offer"}

NUMERIC_FIELDS = {
    "id_offer": ["4.500.000", "750.000", "8 jam", "3%", "35.000",
                 "10 Agustus 2026", "24 bulan"],
    "ms_offer": ["1,800.00", "200.00", "8 jam", "11%", "13.50",
                 "05 Januari 2027", "12 bulan"],
    "ja_offer": ["220,000", "1,720", "8時間", "40時間", "25,000", "10,000",
                 "2026年9月1日", "12か月"],
    "zh_hant_offer": ["28,000", "175", "8小時", "40小時", "2,500", "1,200",
                      "2027年2月1日", "36個月"],
    "zh_hans_offer": ["28,000", "175", "8小时", "40小时", "2,500", "1,200",
                      "2027年2月1日", "36个月"],
}

PROC = psutil.Process(os.getpid())


def peak_rss_during(fn):
    peak = 0
    stop = threading.Event()

    def sample():
        nonlocal peak
        while not stop.is_set():
            try:
                peak = max(peak, PROC.memory_info().rss)
            except psutil.Error:
                pass
            time.sleep(0.2)

    t = threading.Thread(target=sample, daemon=True)
    t.start()
    t0 = time.perf_counter()
    try:
        return fn(), time.perf_counter() - t0, peak
    finally:
        stop.set()
        t.join(timeout=2.0)


def main() -> None:
    rows: list[dict] = []
    for config_name, kwargs in CONFIGS.items():
        print(f"--- config {config_name} ---", flush=True)
        t0 = time.perf_counter()
        ocr = PaddleOCR(**BASE_KW, **kwargs)
        init_s = round(time.perf_counter() - t0, 1)
        print(f"init_seconds: {init_s}", flush=True)
        for sample in PLAN[config_name]:
            gt = (SAMPLES / f"{sample}.gt.txt").read_text(encoding="utf-8")
            img = str(SAMPLES / f"{sample}.png")

            def _predict():
                data = ocr.predict(img)[0].json["res"]
                return list(data["rec_texts"]), np.asarray(data["rec_scores"], float)

            (texts, scores), wall, _peak = peak_rss_during(_predict)
            hyp = "\n".join(texts)
            row = {
                "config": config_name,
                "sample": sample,
                "init_seconds": init_s,
                "infer_seconds": round(wall, 1),
                "peak_rss_mb": round(_peak / (1024 * 1024), 1),
                "lines": len(texts),
                "score_mean": round(float(scores.mean()), 4),
                "cer": round(cer(gt, hyp), 4),
                "wer": round(wer(gt, hyp), 4) if sample in WER_SAMPLES else None,
                "numeric": numeric_check(hyp, NUMERIC_FIELDS[sample]),
            }
            rows.append(row)
            npass = sum(row["numeric"].values())
            print(f"{config_name}__{sample} infer={row['infer_seconds']}s "
                  f"cer={row['cer']} wer={row['wer']} numeric={npass}/"
                  f"{len(row['numeric'])} mean_conf={row['score_mean']} "
                  f"rss={row['peak_rss_mb']}MB", flush=True)
        del ocr
    (RESULTS / "compare_small_medium.json").write_text(
        json.dumps(rows, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"wrote {len(rows)} rows", flush=True)


if __name__ == "__main__":
    main()
