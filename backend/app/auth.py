"""Firebase ID-token verification for FastAPI (Phase 2.6B).

Browser clients sign in with the existing Firebase Authentication and send
`Authorization: Bearer <ID token>`; this module verifies the token offline
against Google's public signing keys and exposes the Firebase UID. It
grants NO Firestore access and needs NO service-account permissions:
verification is pure cryptography plus project/audience checks, so the
credential (used only where a Google client library needs ambient creds)
carries zero IAM roles.

Fail-closed everywhere: missing config, malformed/expired/forged tokens,
wrong audience or issuer, and unreachable signing keys all reject the
request — 401 for caller problems, 503 when the server side cannot
verify. No token content is ever logged.
"""

from __future__ import annotations

import os

from .security import cors_error_headers

FIREBASE_PROJECT_ENV = "FIREBASE_PROJECT_ID"

# Paths that never require authentication. /health exists so platforms
# can probe liveness; it exposes no data.
OPEN_PATHS = frozenset({"/health"})


class AuthError(Exception):
    """Authentication failure with an HTTP status code."""

    def __init__(self, message: str, status_code: int = 401) -> None:
        super().__init__(message)
        self.status_code = status_code


def firebase_project_id() -> str | None:
    """Expected token audience from the environment (None when unset)."""
    value = os.environ.get(FIREBASE_PROJECT_ENV, "").strip()
    return value or None


def _get_verifier():  # seam for tests (no live Google calls)
    from google.oauth2.id_token import verify_firebase_token

    return verify_firebase_token


def _get_transport():  # seam for tests to simulate cert-fetch failures
    from google.auth.transport import requests as google_requests

    return google_requests.Request()


def _is_transport_error(exc: Exception) -> bool:
    """True when verification itself broke (certs unreachable, DNS, ...)."""
    try:
        import requests.exceptions

        if isinstance(exc, requests.exceptions.RequestException):
            return True
    except ImportError:  # pragma: no cover - requests is a hard dependency
        pass
    try:
        from google.auth import exceptions as google_exceptions

        if isinstance(exc, google_exceptions.TransportError):
            return True
    except ImportError:  # pragma: no cover - google-auth is a hard dependency
        pass
    return isinstance(exc, (TimeoutError, OSError))


def verify_bearer_token(authorization: str | None) -> dict:
    """Verifies one Authorization header; returns {"uid": ..., "claims": ...}.

    Raises AuthError: 401 for caller problems (missing/malformed/expired/
    forged/wrong-audience/wrong-issuer tokens, missing claims), 503 when
    the server cannot verify (unconfigured project, unreachable keys).
    """
    project_id = firebase_project_id()
    if not project_id:
        raise AuthError(
            "Authentication is not configured on this server.", status_code=503
        )
    if not authorization or not authorization.startswith("Bearer "):
        raise AuthError("Missing or malformed Authorization header.")
    token = authorization[len("Bearer ") :].strip()
    if not token:
        raise AuthError("Missing or malformed Authorization header.")
    try:
        claims = _get_verifier()(token, _get_transport(), audience=project_id)
    except AuthError:
        raise
    except Exception as exc:
        if _is_transport_error(exc):
            raise AuthError(
                "Could not verify credentials. Please try again.", status_code=503
            ) from exc
        raise AuthError("Invalid or expired credentials.") from exc
    if not isinstance(claims, dict):
        raise AuthError("Invalid or expired credentials.")
    uid = claims.get("uid") or claims.get("user_id") or claims.get("sub")
    if not uid or not isinstance(uid, str):
        raise AuthError("Invalid or expired credentials.")
    return {"uid": uid, "claims": claims}


class FirebaseAuthMiddleware:
    """Rejects unauthenticated requests; stores the UID on request state."""

    def __init__(self, app) -> None:
        self.app = app

    async def __call__(self, scope, receive, send):
        if (
            scope.get("type") != "http"
            or scope.get("path") in OPEN_PATHS
            # CORS preflights carry no credentials by design; the inner
            # CORSMiddleware answers them. Rejecting them here would block
            # every cross-origin browser call before it starts.
            or scope.get("method") == "OPTIONS"
        ):
            await self.app(scope, receive, send)
            return
        raw_headers = list(scope.get("headers", []))
        headers = {
            key.decode("latin-1").lower(): value.decode("latin-1")
            for key, value in raw_headers
        }
        try:
            verified = verify_bearer_token(headers.get("authorization"))
        except AuthError as exc:
            body = f'{{"error":"{exc}"}}'.encode("utf-8")
            await send(
                {
                    "type": "http.response.start",
                    "status": exc.status_code,
                    "headers": [
                        (b"content-type", b"application/json"),
                        *cors_error_headers(raw_headers),
                    ],
                }
            )
            await send({"type": "http.response.body", "body": body})
            return
        state = scope.setdefault("state", {})
        if isinstance(state, dict):
            state["firebase_uid"] = verified["uid"]
        await self.app(scope, receive, send)
