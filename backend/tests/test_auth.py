"""Firebase ID-token verification tests (all verifier calls mocked).

Run (from the backend/ directory):  python -m unittest discover -s tests

No live Google calls, no user credentials: the google-auth verifier and
transport are stubbed at the app.auth seams. Failure mapping (token
problems -> 401, server-side problems -> 503) is asserted explicitly.
"""

from __future__ import annotations

import os
import unittest
from unittest import mock

import requests.exceptions

from app.auth import (
    AuthError,
    FirebaseAuthMiddleware,
    firebase_project_id,
    verify_bearer_token,
)

PROJECT = "opporcheck-test"


def run_middleware(middleware_cls, path="/api/v1/documents/extract", headers=None, method="GET"):
    """Drives one request through middleware; returns (status, body, scope)."""
    status, body, _, scope = run_middleware_full(
        middleware_cls, path=path, headers=headers, method=method
    )
    return status, body, scope


def run_middleware_full(middleware_cls, path="/api/v1/documents/extract", headers=None, method="GET"):
    """Drives one request through middleware; returns (status, body, headers, scope)."""
    messages: list[dict] = []

    async def receive():
        return {"type": "http.request", "body": b""}

    async def send(message):
        messages.append(message)

    async def downstream(scope, receive, send):
        await send(
            {"type": "http.response.start", "status": 200, "headers": []}
        )
        await send({"type": "http.response.body", "body": b"ok"})

    scope: dict = {
        "type": "http",
        "http_version": "1.1",
        "method": method,
        "path": path,
        "headers": headers or [],
        "client": ("10.0.0.9", 1111),
    }
    coro = middleware_cls(downstream)(scope, receive, send)
    try:
        coro.send(None)
    except StopIteration:
        pass
    start = next(m for m in messages if m["type"] == "http.response.start")
    body = b"".join(m.get("body", b"") for m in messages if m["type"] == "http.response.body")
    return start["status"], body, list(start.get("headers", [])), scope


def valid_claims():
    return {
        "uid": "user-123",
        "aud": PROJECT,
        "iss": "https://securetoken.google.com/" + PROJECT,
        "exp": 4102444800,
    }


class VerifyTokenTests(unittest.TestCase):
    def test_valid_token_returns_uid(self):
        with mock.patch.dict(os.environ, {"FIREBASE_PROJECT_ID": PROJECT}):
            with mock.patch(
                "app.auth._get_verifier",
                return_value=lambda token, req, audience=None: valid_claims(),
            ), mock.patch("app.auth._get_transport", return_value=object()):
                verified = verify_bearer_token("Bearer good.token.here")
        self.assertEqual(verified["uid"], "user-123")

    def test_audience_pinned_to_configured_project(self):
        seen: dict = {}

        def _fake(token, req, audience=None):
            seen["audience"] = audience
            return valid_claims()

        with mock.patch.dict(os.environ, {"FIREBASE_PROJECT_ID": PROJECT}):
            with mock.patch("app.auth._get_verifier", return_value=_fake), mock.patch(
                "app.auth._get_transport", return_value=object()
            ):
                verify_bearer_token("Bearer x")
        self.assertEqual(seen["audience"], PROJECT)

    def test_missing_and_malformed_headers_rejected(self):
        with mock.patch.dict(os.environ, {"FIREBASE_PROJECT_ID": PROJECT}):
            for header in (None, "", "Token abc", "Bearer ", "Bearer"):
                with self.assertRaises(AuthError) as ctx:
                    verify_bearer_token(header)
                self.assertEqual(ctx.exception.status_code, 401, header)

    def test_invalid_signature_rejected(self):
        def _bad(token, req, audience=None):
            raise ValueError("invalid signature")

        with mock.patch.dict(os.environ, {"FIREBASE_PROJECT_ID": PROJECT}):
            with mock.patch("app.auth._get_verifier", return_value=_bad), mock.patch(
                "app.auth._get_transport", return_value=object()
            ):
                with self.assertRaises(AuthError) as ctx:
                    verify_bearer_token("Bearer forged")
        self.assertEqual(ctx.exception.status_code, 401)

    def test_expired_token_rejected(self):
        def _expired(token, req, audience=None):
            raise ValueError("token expired")

        with mock.patch.dict(os.environ, {"FIREBASE_PROJECT_ID": PROJECT}):
            with mock.patch("app.auth._get_verifier", return_value=_expired), mock.patch(
                "app.auth._get_transport", return_value=object()
            ):
                with self.assertRaises(AuthError) as ctx:
                    verify_bearer_token("Bearer old")
        self.assertEqual(ctx.exception.status_code, 401)

    def test_wrong_audience_rejected(self):
        # google-auth raises when the token's audience differs from the
        # project we pin; our mapping turns that into a 401.
        def _wrong_aud(token, req, audience=None):
            raise ValueError("audience mismatch")

        with mock.patch.dict(os.environ, {"FIREBASE_PROJECT_ID": PROJECT}):
            with mock.patch("app.auth._get_verifier", return_value=_wrong_aud), mock.patch(
                "app.auth._get_transport", return_value=object()
            ):
                with self.assertRaises(AuthError) as ctx:
                    verify_bearer_token("Bearer other-project-token")
                self.assertEqual(ctx.exception.status_code, 401)

    def test_missing_uid_claim_rejected(self):
        def _no_uid(token, req, audience=None):
            return {"aud": PROJECT}

        with mock.patch.dict(os.environ, {"FIREBASE_PROJECT_ID": PROJECT}):
            with mock.patch("app.auth._get_verifier", return_value=_no_uid), mock.patch(
                "app.auth._get_transport", return_value=object()
            ):
                with self.assertRaises(AuthError) as ctx:
                    verify_bearer_token("Bearer odd")
        self.assertEqual(ctx.exception.status_code, 401)

    def test_cert_fetch_failure_fails_closed_with_503(self):
        def _unreachable(token, req, audience=None):
            raise requests.exceptions.ConnectionError("dns down")

        with mock.patch.dict(os.environ, {"FIREBASE_PROJECT_ID": PROJECT}):
            with mock.patch("app.auth._get_verifier", return_value=_unreachable), mock.patch(
                "app.auth._get_transport", return_value=object()
            ):
                with self.assertRaises(AuthError) as ctx:
                    verify_bearer_token("Bearer x")
        self.assertEqual(ctx.exception.status_code, 503)

    def test_missing_project_config_fails_closed(self):
        with mock.patch.dict(os.environ, {}, clear=False):
            os.environ.pop("FIREBASE_PROJECT_ID", None)
            self.assertIsNone(firebase_project_id())
            with self.assertRaises(AuthError) as ctx:
                verify_bearer_token("Bearer x")
        self.assertEqual(ctx.exception.status_code, 503)

    def test_token_content_never_echoed(self):
        secret = "Bearer eyJzZWNyZXQtdG9rZW4"
        with mock.patch.dict(os.environ, {"FIREBASE_PROJECT_ID": PROJECT}):
            with mock.patch(
                "app.auth._get_verifier",
                side_effect=ValueError("bad"),
            ), mock.patch("app.auth._get_transport", return_value=object()):
                try:
                    verify_bearer_token(secret)
                    self.fail("should have raised")
                except AuthError as exc:
                    self.assertNotIn("eyJzZWNyZXQtdG9rZW4", str(exc))


class AuthMiddlewareTests(unittest.TestCase):
    def test_health_open_without_token(self):
        status, _, _ = run_middleware(
            FirebaseAuthMiddleware, path="/health", headers=[]
        )
        self.assertEqual(status, 200)

    def test_protected_path_rejects_missing_token(self):
        with mock.patch.dict(os.environ, {"FIREBASE_PROJECT_ID": PROJECT}):
            status, body, _ = run_middleware(FirebaseAuthMiddleware, headers=[])
        self.assertEqual(status, 401)
        self.assertIn(b"Authorization", body)

    def test_unconfigured_server_rejects_with_503(self):
        with mock.patch.dict(os.environ, {}, clear=False):
            os.environ.pop("FIREBASE_PROJECT_ID", None)
            status, _, _ = run_middleware(
                FirebaseAuthMiddleware,
                headers=[(b"authorization", b"Bearer x")],
            )
        self.assertEqual(status, 503)

    def test_protected_path_accepts_valid_token_and_exposes_uid(self):
        async def downstream(scope, receive, send):
            await send(
                {"type": "http.response.start", "status": 204, "headers": []}
            )
            await send({"type": "http.response.body", "body": b""})

        messages: list[dict] = []

        async def receive():
            return {"type": "http.request", "body": b""}

        async def send(message):
            messages.append(message)

        scope: dict = {
            "type": "http",
            "method": "GET",
            "path": "/api/v1/documents/extract",
            "headers": [(b"authorization", b"Bearer good")],
            "client": ("10.0.0.9", 1),
        }
        with mock.patch.dict(os.environ, {"FIREBASE_PROJECT_ID": PROJECT}):
            with mock.patch(
                "app.auth._get_verifier",
                return_value=lambda token, req, audience=None: valid_claims(),
            ), mock.patch("app.auth._get_transport", return_value=object()):
                coro = FirebaseAuthMiddleware(downstream)(scope, receive, send)
                try:
                    coro.send(None)
                except StopIteration:
                    pass
        start = next(m for m in messages if m["type"] == "http.response.start")
        self.assertEqual(start["status"], 204)
        self.assertEqual(scope.get("state", {}).get("firebase_uid"), "user-123")

    def test_options_preflight_passes_through_without_token(self):
        # CORS preflights carry no credentials by design; rejecting them
        # would block every cross-origin browser call before it starts.
        status, _, _ = run_middleware(
            FirebaseAuthMiddleware, method="OPTIONS", headers=[]
        )
        self.assertEqual(status, 200)

    def test_401_echoes_allowlisted_origin(self):
        origin = "https://app.example"
        with mock.patch.dict(
            os.environ,
            {"FIREBASE_PROJECT_ID": PROJECT, "FRONTEND_ORIGINS": origin},
        ):
            status, _, headers, _ = run_middleware_full(
                FirebaseAuthMiddleware,
                headers=[(b"origin", origin.encode("ascii"))],
            )
        self.assertEqual(status, 401)
        self.assertIn(
            (b"access-control-allow-origin", origin.encode("ascii")), headers
        )

    def test_401_omits_disallowed_origin(self):
        with mock.patch.dict(
            os.environ,
            {
                "FIREBASE_PROJECT_ID": PROJECT,
                "FRONTEND_ORIGINS": "https://app.example",
            },
        ):
            status, _, headers, _ = run_middleware_full(
                FirebaseAuthMiddleware,
                headers=[(b"origin", b"https://evil.example")],
            )
        self.assertEqual(status, 401)
        names = [name for name, _ in headers]
        self.assertNotIn(b"access-control-allow-origin", names)


if __name__ == "__main__":
    unittest.main()
