"""HTTP protection tests: trusted hosts and rate limiting.

Run (from the backend/ directory):  python -m unittest discover -s tests

Stdlib-only ASGI tests (no httpx/TestClient needed): each middleware is
driven directly with a synthetic scope and a recording downstream app.
"""

from __future__ import annotations

import os
import unittest
from unittest import mock

from starlette.middleware.trustedhost import TrustedHostMiddleware

from app.security import (
    DEFAULT_ALLOWED_HOSTS,
    DEFAULT_RATE_LIMIT_PER_MINUTE,
    RateLimitMiddleware,
    allowed_hosts,
    forwarded_client_ip,
    rate_limit_per_minute,
    trust_proxy_headers,
)


def run_asgi(app, path="/api/v1/documents/extract", host="127.0.0.1"):
    """Drives one GET request through an ASGI app; returns (status, body)."""
    messages: list[dict] = []

    async def receive():
        return {"type": "http.request", "body": b""}

    async def send(message):
        messages.append(message)

    async def downstream(scope, receive, send):
        await send(
            {
                "type": "http.response.start",
                "status": 200,
                "headers": [(b"content-type", b"application/json")],
            }
        )
        await send({"type": "http.response.body", "body": b'{"ok":true}'})

    scope = {
        "type": "http",
        "http_version": "1.1",
        "method": "GET",
        "path": path,
        "headers": [(b"host", host.encode("ascii"))],
        "client": ("10.9.8.7", 1234),
    }
    target = downstream if app is None else app
    # No event loop needed: nothing here awaits real I/O, so one send()
    # drives each coroutine to completion (and repeated asyncio.run calls
    # trip Windows proactor cleanup bugs).
    coro = target(scope, receive, send)
    try:
        coro.send(None)
    except StopIteration:
        pass
    start = next(m for m in messages if m["type"] == "http.response.start")
    body = b"".join(m.get("body", b"") for m in messages if m["type"] == "http.response.body")
    return start["status"], body


class TrustedHostTests(unittest.TestCase):
    def test_localhost_allowed_by_default(self):
        async def downstream(scope, receive, send):
            await send(
                {"type": "http.response.start", "status": 200, "headers": []}
            )
            await send({"type": "http.response.body", "body": b"ok"})

        for host in ("127.0.0.1", "localhost"):
            status, _ = run_asgi(
                TrustedHostMiddleware(downstream, allowed_hosts=list(DEFAULT_ALLOWED_HOSTS)),
                host=host,
            )
            self.assertEqual(status, 200, host)

    def test_foreign_host_rejected(self):
        async def downstream(scope, receive, send):  # pragma: no cover
            raise AssertionError("must not reach the app")

        status, body = run_asgi(
            TrustedHostMiddleware(downstream, allowed_hosts=["127.0.0.1"]),
            host="evil.example",
        )
        self.assertEqual(status, 400)
        self.assertIn(b"Invalid host", body)

    def test_allowlist_configurable_by_env(self):
        with mock.patch.dict(os.environ, {"OPPORCHECK_ALLOWED_HOSTS": "one.test, two.test"}):
            self.assertEqual(allowed_hosts(), ["one.test", "two.test"])
        with mock.patch.dict(os.environ, {}, clear=False):
            os.environ.pop("OPPORCHECK_ALLOWED_HOSTS", None)
            self.assertEqual(allowed_hosts(), list(DEFAULT_ALLOWED_HOSTS))


class RateLimitTests(unittest.TestCase):
    def test_allows_burst_then_429s(self):
        async def downstream(scope, receive, send):
            await send(
                {"type": "http.response.start", "status": 200, "headers": []}
            )
            await send({"type": "http.response.body", "body": b"ok"})

        limited = RateLimitMiddleware(downstream, per_minute=3)
        self.assertEqual(run_asgi(limited)[0], 200)
        self.assertEqual(run_asgi(limited)[0], 200)
        self.assertEqual(run_asgi(limited)[0], 200)
        status, body = run_asgi(limited)
        self.assertEqual(status, 429)
        self.assertIn(b"Too many requests", body)

    def test_health_exempt_and_limits_isolated_per_ip(self):
        async def downstream(scope, receive, send):
            await send(
                {"type": "http.response.start", "status": 200, "headers": []}
            )
            await send({"type": "http.response.body", "body": b"ok"})

        limited = RateLimitMiddleware(downstream, per_minute=1)
        self.assertEqual(run_asgi(limited, path="/health")[0], 200)
        self.assertEqual(run_asgi(limited, path="/health")[0], 200)
        self.assertEqual(run_asgi(limited, path="/x")[0], 200)
        # Same bucket for the same test IP: second metered call is limited.
        self.assertEqual(run_asgi(limited, path="/x")[0], 429)

    def test_limit_configurable_and_disablable(self):
        with mock.patch.dict(os.environ, {"OPPORCHECK_RATE_LIMIT_PER_MINUTE": "120"}):
            self.assertEqual(rate_limit_per_minute(), 120)
        with mock.patch.dict(os.environ, {"OPPORCHECK_RATE_LIMIT_PER_MINUTE": "0"}):
            self.assertEqual(rate_limit_per_minute(), 0)
        with mock.patch.dict(os.environ, {"OPPORCHECK_RATE_LIMIT_PER_MINUTE": "junk"}):
            self.assertEqual(rate_limit_per_minute(), DEFAULT_RATE_LIMIT_PER_MINUTE)
        with mock.patch.dict(os.environ, {}, clear=False):
            os.environ.pop("OPPORCHECK_RATE_LIMIT_PER_MINUTE", None)
            self.assertEqual(rate_limit_per_minute(), DEFAULT_RATE_LIMIT_PER_MINUTE)


def run_limited(app, host="127.0.0.1", headers=None, client=("10.9.8.7", 1)):
    """Drives one GET through a middleware; returns the status code."""
    messages: list[dict] = []

    async def receive():
        return {"type": "http.request", "body": b""}

    async def send(message):
        messages.append(message)

    async def downstream(scope, receive, send):
        await send({"type": "http.response.start", "status": 200, "headers": []})
        await send({"type": "http.response.body", "body": b"ok"})

    scope: dict = {
        "type": "http",
        "method": "GET",
        "path": "/api/v1/documents/extract",
        "headers": [(b"host", host.encode("ascii"))] + list(headers or []),
        "client": client,
    }
    coro = app(scope, receive, send)
    try:
        coro.send(None)
    except StopIteration:
        pass
    return next(m for m in messages if m["type"] == "http.response.start")["status"]


class ProxyTrustTests(unittest.TestCase):
    def test_forwarded_header_ignored_by_default(self):
        async def downstream(scope, receive, send):
            await send({"type": "http.response.start", "status": 200, "headers": []})
            await send({"type": "http.response.body", "body": b"ok"})

        with mock.patch.dict(os.environ, {}, clear=False):
            os.environ.pop("TRUST_PROXY_HEADERS", None)
            self.assertFalse(trust_proxy_headers())
            limited = RateLimitMiddleware(downstream, per_minute=1)
            spoofed = [(b"x-real-ip", b"1.2.3.4")]
            self.assertEqual(run_limited(limited, headers=spoofed), 200)
            # Same socket peer, different spoofed header: still the same bucket.
            other_spoof = [(b"x-real-ip", b"9.9.9.9")]
            self.assertEqual(run_limited(limited, headers=other_spoof), 429)

    def test_trusted_edge_ip_used_when_enabled(self):
        async def downstream(scope, receive, send):
            await send({"type": "http.response.start", "status": 200, "headers": []})
            await send({"type": "http.response.body", "body": b"ok"})

        with mock.patch.dict(os.environ, {"TRUST_PROXY_HEADERS": "true"}):
            self.assertTrue(trust_proxy_headers())
            limited = RateLimitMiddleware(downstream, per_minute=1)
            proxy_peer = ("172.18.0.2", 40000)
            alice = [(b"x-real-ip", b"203.0.113.7")]
            bob = [(b"x-real-ip", b"198.51.100.9")]
            self.assertEqual(run_limited(limited, headers=alice, client=proxy_peer), 200)
            # A different real client behind the same proxy gets its own bucket.
            self.assertEqual(run_limited(limited, headers=bob, client=proxy_peer), 200)
            # But the same client repeating is limited.
            self.assertEqual(run_limited(limited, headers=alice, client=proxy_peer), 429)

    def test_malformed_forwarded_values_fall_back_to_peer(self):
        self.assertIsNone(forwarded_client_ip([]))
        self.assertIsNone(forwarded_client_ip([(b"x-real-ip", b"")]))
        self.assertIsNone(forwarded_client_ip([(b"x-real-ip", b"1.2.3.4, 5.6.7.8")]))
        self.assertIsNone(forwarded_client_ip([(b"x-real-ip", b"a" * 65)]))
        self.assertEqual(
            forwarded_client_ip([(b"X-Real-IP", b"2001:db8::1")]), "2001:db8::1"
        )


class WiringTests(unittest.TestCase):
    def test_middlewares_registered_on_app(self):
        from app.main import app

        names = []
        for entry in app.user_middleware:
            cls = getattr(
                entry, "cls", entry[0] if isinstance(entry, tuple) else None
            )
            names.append(getattr(cls, "__name__", ""))
        for expected in (
            "TrustedHostMiddleware",
            "RateLimitMiddleware",
            "FirebaseAuthMiddleware",
            "CORSMiddleware",
        ):
            self.assertIn(expected, names)


if __name__ == "__main__":
    unittest.main()
