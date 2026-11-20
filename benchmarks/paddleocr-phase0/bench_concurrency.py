"""Light concurrency probe: two simultaneous OCR requests (Phase 0).

Shares one PaddleOCR instance across two threads on a small sample.
Records per-thread wall time, peak RSS, and any thread-safety failure.
Kept small on purpose: this machine is memory-pressured.
"""

import bench_env  # noqa: F401  (must be first: redirects caches)

import concurrent.futures
import os
import threading
import time

import psutil
from paddleocr import PaddleOCR

from bench_env import BENCH

PROC = psutil.Process(os.getpid())
BASE_KW = dict(
    use_doc_orientation_classify=False,
    use_doc_unwarping=False,
    use_textline_orientation=False,
    enable_mkldnn=False,
)


def main() -> None:
    ocr = PaddleOCR(**BASE_KW)
    img = str(BENCH / "samples" / "en_table.png")
    peak = 0
    peak_lock = threading.Lock()
    stop = threading.Event()

    def sample() -> None:
        nonlocal peak
        while not stop.is_set():
            rss = PROC.memory_info().rss
            with peak_lock:
                peak = max(peak, rss)
            time.sleep(0.2)

    def one(tag: str) -> dict:
        t0 = time.perf_counter()
        try:
            texts = ocr.predict(img)[0].json["res"]["rec_texts"]
            return {"tag": tag, "seconds": round(time.perf_counter() - t0, 1),
                    "lines": len(texts), "error": None}
        except Exception as exc:  # noqa: BLE001 - failure itself is the finding
            return {"tag": tag, "seconds": round(time.perf_counter() - t0, 1),
                    "lines": 0, "error": f"{type(exc).__name__}: {exc}"}

    # Baseline: one sequential run for comparison.
    baseline = one("sequential-baseline")
    print(baseline, flush=True)

    sampler = threading.Thread(target=sample, daemon=True)
    sampler.start()
    t0 = time.perf_counter()
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(one, ("thread-A", "thread-B")))
    wall = time.perf_counter() - t0
    stop.set()
    sampler.join(timeout=2.0)
    for r in results:
        print(r, flush=True)
    print(f"concurrent_wall_seconds={wall:.1f} "
          f"peak_rss_mb={peak / (1024 * 1024):.1f}", flush=True)


if __name__ == "__main__":
    main()
