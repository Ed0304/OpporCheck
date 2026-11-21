"""Pre-download pinned PaddleOCR models into the image (Docker build step).

Constructs the exact production engine (v6-small pair from app config)
so PaddleX resolves and stores the model files under PADDLE_PDX_CACHE_HOME.
Model bytes follow the pinned paddleocr/paddlex releases; the script prints
every downloaded file with its size so CI logs record exactly what baked.
No inference runs here. No documents involved.

Usage (inside the image build only):  python scripts/download_models.py
"""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.ocr import MODEL_BY_LANGUAGE, _load_engine  # noqa: E402


def main() -> None:
    cache = os.environ.get("PADDLE_PDX_CACHE_HOME", "")
    print(f"model cache: {cache or '(paddlex default)'}")
    seen: set[tuple[str, str]] = set()
    for language in sorted(MODEL_BY_LANGUAGE):
        pair = MODEL_BY_LANGUAGE[language]
        if pair in seen:
            print(f"lang {language}: already loaded {pair[0]} + {pair[1]}")
            continue
        seen.add(pair)
        print(f"lang {language}: loading {pair[0]} + {pair[1]} ...", flush=True)
        _load_engine(*pair)
        print(f"lang {language}: cached.")
    total_bytes = 0
    file_count = 0
    if cache and os.path.isdir(cache):
        for root, _, files in os.walk(cache):
            for name in files:
                path = os.path.join(root, name)
                size = os.path.getsize(path)
                total_bytes += size
                file_count += 1
                print(f"  {size / 1024 / 1024:.1f} MB  {os.path.relpath(path, cache)}")
    print(f"baked {file_count} files, {total_bytes / 1024 / 1024:.1f} MB total.")


if __name__ == "__main__":
    main()
