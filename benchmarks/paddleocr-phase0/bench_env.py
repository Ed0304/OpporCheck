"""Shared benchmark environment: redirect ALL caches into the benchmark dir.

Import this module FIRST in every benchmark script, before paddle/paddleocr.
Keeps model files, HF caches, and temp artifacts inside the isolated
experiment directory (and makes cache-size measurement trivial).
"""

import os
from pathlib import Path

BENCH = Path(__file__).resolve().parent
HOME = BENCH / "home"
HOME.mkdir(exist_ok=True)

# Direct assignment (not setdefault): the real USERPROFILE/HOME/TEMP are
# already set, and paddle/paddlex resolve "~" from them at import time.
os.environ["USERPROFILE"] = str(HOME)
os.environ["HOME"] = str(HOME)
os.environ["XDG_CACHE_HOME"] = str(HOME / ".cache")
os.environ["HF_HOME"] = str(HOME / ".cache" / "huggingface")
os.environ["HF_HUB_CACHE"] = str(HOME / ".cache" / "huggingface" / "hub")
os.environ["MODELSCOPE_CACHE"] = str(HOME / ".cache" / "modelscope")

# Bypass PaddleX's 1-second model-hoster healthcheck: it false-negatives
# through this network's proxy while direct HEAD/GET to all four hosters
# returns 200 (see probe_net.py). Downloads use the hosters directly.
os.environ["PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK"] = "True"

TMP = BENCH / "tmp"
TMP.mkdir(exist_ok=True)
os.environ["TMPDIR"] = str(TMP)
os.environ["TEMP"] = str(TMP)
os.environ["TMP"] = str(TMP)
