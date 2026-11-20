"""Main OCR benchmark: quality + performance (Phase 0).

Runs each model config over its sample plan, records timing, accuracy
(CER/WER/numeric exact-match), confidence stats, CPU and peak RSS.
Writes per-run JSON to results/ plus results/summary.json.

Long run (~10-20 min on CPU). Progress prints one line per run.
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
RESULTS.mkdir(exist_ok=True)

BASE_KW = dict(
    use_doc_orientation_classify=False,
    use_doc_unwarping=False,
    use_textline_orientation=False,
    enable_mkldnn=False,  # oneDNN execution fails on this CPU; plain paddle mode
)

CONFIGS = {
    "v6medium_default": dict(),
    "v6medium_lang_id": dict(lang="id"),
    "v6_th_lang": dict(lang="th"),
    "v6small": dict(
        text_detection_model_name="PP-OCRv6_small_det",
        text_recognition_model_name="PP-OCRv6_small_rec",
    ),
    "v5latin": dict(
        text_detection_model_name="PP-OCRv5_mobile_det",
        text_recognition_model_name="latin_PP-OCRv5_mobile_rec",
    ),
}

# sample -> trials
PLAN = {
    "v6medium_default": {
        "en_offer": 3, "en_dense": 1, "en_table": 1, "id_offer": 1,
        "ms_offer": 1, "ja_offer": 1, "zh_hant_offer": 1, "th_offer": 1,
        "vi_offer": 1,
    },
    "v6medium_lang_id": {"id_offer": 1},
    "v6_th_lang": {"th_offer": 1},
    "v6small": {"en_offer": 1, "en_dense": 1, "en_table": 1},
    "v5latin": {"id_offer": 1, "ms_offer": 1},
}

# Latin-script (whitespace-tokenized) samples get WER; CJK/Thai get CER only.
WER_SAMPLES = {"en_offer", "en_dense", "en_table", "id_offer", "ms_offer", "vi_offer"}

NUMERIC_FIELDS = {
    "en_offer": ["11.50", "17.25", "40", "80.00", "5%", "15 June 2026",
                 "01 June 2026", "6 months"],
    "en_dense": ["11.50", "40", "80.00", "14 days", "30 June 2026",
                 "07 July 2026", "7 calendar days", "1.5"],
    "en_table": ["1,840.00", "172.50", "320.00", "5%", "1,692.50"],
    "id_offer": ["4.500.000", "750.000", "8 jam", "3%", "35.000",
                 "10 Agustus 2026", "24 bulan"],
    "ms_offer": ["1,800.00", "200.00", "8 jam", "11%", "13.50",
                 "05 Januari 2027", "12 bulan"],
    "ja_offer": ["220,000", "1,720", "8時間", "40時間", "25,000", "10,000",
                 "2026年9月1日", "12か月"],
    "zh_hant_offer": ["28,000", "175", "8小時", "40小時", "2,500", "1,200",
                      "2027年2月1日", "36個月"],
    "th_offer": ["15,000", "95", "8 ชั่วโมง", "2,000", "12 เดือน"],
    "vi_offer": ["8.000.000", "800.000", "8 giờ", "8%", "55.000",
                 "15/09/2026", "24 tháng"],
}

PROC = psutil.Process(os.getpid())
NCPU = os.cpu_count() or 1


class RssSampler(threading.Thread):
    def __init__(self) -> None:
        super().__init__(daemon=True)
        self.peak = 0
        self._stop = threading.Event()

    def run(self) -> None:
        while not self._stop.is_set():
            try:
                rss = PROC.memory_info().rss
                if rss > self.peak:
                    self.peak = rss
            except psutil.Error:
                pass
            time.sleep(0.2)

    def stop(self) -> int:
        self._stop.set()
        self.join(timeout=2.0)
        return self.peak


def run_predict(ocr: PaddleOCR, image_path: str) -> dict:
    sampler = RssSampler()
    cpu0 = PROC.cpu_times()
    sampler.start()
    t0 = time.perf_counter()
    results = ocr.predict(image_path)
    t1 = time.perf_counter()
    cpu1 = PROC.cpu_times()
    peak_rss = sampler.stop()
    data = results[0].json["res"]
    texts = list(data["rec_texts"])
    scores = np.asarray(data["rec_scores"], dtype=float)
    cpu_secs = (cpu1.user - cpu0.user) + (cpu1.system - cpu0.system)
    wall = t1 - t0
    return {
        "infer_seconds": round(wall, 1),
        "cpu_util_pct": round(100.0 * cpu_secs / wall / NCPU, 1) if wall > 0 else 0.0,
        "peak_rss_mb": round(peak_rss / (1024 * 1024), 1),
        "lines": len(texts),
        "score_min": round(float(scores.min()), 4) if len(scores) else None,
        "score_mean": round(float(scores.mean()), 4) if len(scores) else None,
        "score_p10": round(float(np.percentile(scores, 10)), 4) if len(scores) else None,
        "frac_lines_below_09": round(float(np.mean(scores < 0.9)), 4) if len(scores) else None,
        "texts": texts,
        "scores": [round(float(s), 4) for s in scores],
    }


def main() -> None:
    summary: list[dict] = []
    for config_name, kwargs in CONFIGS.items():
        print(f"--- config {config_name} {kwargs} ---", flush=True)
        t0 = time.perf_counter()
        ocr = PaddleOCR(**BASE_KW, **kwargs)
        init_s = round(time.perf_counter() - t0, 1)
        print(f"init_seconds: {init_s}", flush=True)
        for sample, trials in PLAN[config_name].items():
            gt = (SAMPLES / f"{sample}.gt.txt").read_text(encoding="utf-8")
            img = str(SAMPLES / f"{sample}.png")
            for trial in range(1, trials + 1):
                run = run_predict(ocr, img)
                hyp = "\n".join(run["texts"])
                run.update({
                    "config": config_name,
                    "sample": sample,
                    "trial": trial,
                    "init_seconds": init_s,
                    "cer": round(cer(gt, hyp), 4),
                    "wer": round(wer(gt, hyp), 4) if sample in WER_SAMPLES else None,
                    "numeric": numeric_check(hyp, NUMERIC_FIELDS[sample]),
                })
                tag = f"{config_name}__{sample}__t{trial}"
                (RESULTS / f"{tag}.json").write_text(
                    json.dumps(run, ensure_ascii=False, indent=1), encoding="utf-8")
                summary.append({k: v for k, v in run.items()
                                if k not in ("texts", "scores")})
                npass = sum(run["numeric"].values())
                ntot = len(run["numeric"])
                print(f"{tag} infer={run['infer_seconds']}s cer={run['cer']} "
                      f"wer={run['wer']} numeric={npass}/{ntot} "
                      f"mean_conf={run['score_mean']} rss={run['peak_rss_mb']}MB "
                      f"cpu={run['cpu_util_pct']}%", flush=True)
        del ocr
    (RESULTS / "summary.json").write_text(
        json.dumps(summary, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"wrote {len(summary)} runs to {RESULTS}", flush=True)


if __name__ == "__main__":
    main()
