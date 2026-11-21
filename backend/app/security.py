"""Lightweight HTTP protections for the FastAPI backend (Phase 2.5A).

Two middlewares, stdlib-only, no new dependencies:

- Trusted-host enforcement (Starlette's TrustedHostMiddleware): rejects
  requests whose Host header is outside an explicit allowlist. This is
  NOT authentication — it only ensures the app answers for hostnames the
  operator expects (localhost by default), blunting DNS-rebinding
  surprises if the process ever listens beyond loopback.
- Per-IP token-bucket rate limiting: bounds how fast one client can burn
  CPU on extraction/OCR/retrieval. Single-process memory only: correct
  for the documented one-process uvicorn setup, NOT a substitute for
  edge rate limiting in any multi-process deployment.

Both are configured by environment with safe localhost defaults. Real
authentication (per-user identity for browser callers) needs an
auth gateway or Firebase token verification, which is deliberately out
of scope here — see the Phase 2.5A report.
"""

from __future__ import annotations

import os
import threading
import time

DEFAULT_ALLOWED_HOSTS = ("127.0.0.1", "localhost")
DEFAULT_RATE_LIMIT_PER_MINUTE = 60


def allowed_hosts() -> list[str]:
    """Operator-configured Host allowlist (localhost by default)."""
    raw = os.environ.get("OPPORCHECK_ALLOWED_HOSTS", "")
    hosts = [part.strip() for part in raw.split(",") if part.strip()]
    return hosts or list(DEFAULT_ALLOWED_HOSTS)


def rate_limit_per_minute() -> int:
    """Requests/min/IP; 0 disables limiting. Generous by default."""
    raw = os.environ.get("OPPORCHECK_RATE_LIMIT_PER_MINUTE", "").strip()
    if raw == "":
        return DEFAULT_RATE_LIMIT_PER_MINUTE
    try:
        value = int(raw)
    except ValueError:
        return DEFAULT_RATE_LIMIT_PER_MINUTE
    return value if value > 0 else 0


def trust_proxy_headers() -> bool:
    """True only when the operator asserts a trusted edge proxy.

    Set TRUST_PROXY_HEADERS=true on Railway, whose edge overwrites
    X-Real-IP per request (unforgeable through the edge). Anywhere else
    — localhost, direct exposure — leave it off so the socket peer is
    used and spoofed headers are worthless.
    """
    return os.environ.get("TRUST_PROXY_HEADERS", "").strip().lower() in (
        "1",
        "true",
        "yes",
    )


def forwarded_client_ip(headers: list[tuple[bytes, bytes]]) -> str | None:
    """Single client IP from X-Real-IP, strictly validated (else None)."""
    for key, value in headers:
        if key.decode("latin-1").lower() != "x-real-ip":
            continue
        candidate = value.decode("latin-1").strip()
        if (
            candidate
            and len(candidate) <= 64
            and all(ch.isalnum() or ch in ".:_-" for ch in candidate)
        ):
            return candidate
        return None
    return None


class RateLimitMiddleware:
    """Per-IP token bucket; 429s over-limit requests (health exempt).

    Pure ASGI middleware (no FastAPI dependency) so it stays trivially
    testable. Buckets live in process memory and are pruned lazily.
    """

    def __init__(self, app, per_minute: int | None = None) -> None:
        self.app = app
        self.per_minute = (
            per_minute if per_minute is not None else rate_limit_per_minute()
        )
        self._buckets: dict[str, list[float]] = {}
        self._lock = threading.Lock()

    def _client_ip(self, scope) -> str:
        if trust_proxy_headers():
            forwarded = forwarded_client_ip(list(scope.get("headers", [])))
            if forwarded:
                return forwarded
        client = scope.get("client")
        if isinstance(client, (list, tuple)) and client:
            return str(client[0])
        return "unknown"

    def _allowed(self, ip: str, now: float) -> bool:
        if self.per_minute <= 0:
            return True
        window_start = now - 60.0
        with self._lock:
            hits = [t for t in self._buckets.get(ip, []) if t > window_start]
            if len(hits) >= self.per_minute:
                self._buckets[ip] = hits
                return False
            hits.append(now)
            self._buckets[ip] = hits
            # Lazy prune of cold buckets to bound memory.
            if len(self._buckets) > 4096:
                for key in [
                    k for k, v in self._buckets.items() if not v or v[-1] <= window_start
                ][:1024]:
                    del self._buckets[key]
            return True

    async def __call__(self, scope, receive, send):
        if scope.get("type") != "http" or scope.get("path") == "/health":
            await self.app(scope, receive, send)
            return
        if self._allowed(self._client_ip(scope), time.monotonic()):
            await self.app(scope, receive, send)
            return
        body = b'{"error":"Too many requests. Please wait and try again."}'
        await send(
            {
                "type": "http.response.start",
                "status": 429,
                "headers": [(b"content-type", b"application/json")],
            }
        )
        await send({"type": "http.response.body", "body": body})
