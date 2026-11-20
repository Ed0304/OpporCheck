"""Network diagnosis: probe each PaddleX model hoster (Phase 0).

Read-only connectivity probes. Control: pypi.org (known good via pip).
"""

import bench_env  # noqa: F401  (must be first: redirects caches)

import requests

URLS = [
    "https://pypi.org/simple/",  # control: pip works
    "https://paddle-model-ecology.bj.bcebos.com",  # BOS
    "https://huggingface.co",  # HuggingFace
    "https://modelscope.cn",  # ModelScope
    "https://aistudio.baidu.com",  # AIStudio
]

for url in URLS:
    for method in ("HEAD", "GET"):
        try:
            resp = requests.request(method, url, timeout=10, allow_redirects=True)
            print(f"{method} {url} -> {resp.status_code} "
                  f"ok={resp.ok} bytes={len(resp.content)}")
            break
        except Exception as exc:  # noqa: BLE001 - diagnosis needs the error text
            print(f"{method} {url} -> {type(exc).__name__}: {exc}")
