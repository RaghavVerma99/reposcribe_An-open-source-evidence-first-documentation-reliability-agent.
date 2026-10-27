"""RepoScribe application factory."""

from __future__ import annotations

import asyncio
import json
import logging
import mimetypes
import os
import sys
import time
import uuid
from collections import deque
from contextlib import asynccontextmanager
from pathlib import Path, PurePosixPath

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.api import audits, findings, health, patches, provider, questions, repositories
from app.core.errors import AppError, app_error_handler, unhandled_error_handler
from app.core.security import MB, read_session_cookie, set_session_secret, sign_session
from app.core.settings import get_settings
from app.services.store import Store, sweep_orphan_workspaces

# Python's mimetypes table varies by image; register the font types explicitly
# so preloaded woff2 files are not served as application/octet-stream.
mimetypes.add_type("font/woff2", ".woff2")
mimetypes.add_type("font/woff", ".woff")

COOKIE_NAME = "reposcribe_session"
API_PREFIX = "/api/v1"
RATE_LIMIT = 120
RATE_WINDOW_SECONDS = 60
# How many requests pass before idle rate-limit buckets are swept, and the hard
# cap on tracked clients. Without both, the bucket map grows without bound.
RATE_SWEEP_INTERVAL = 500
RATE_MAX_CLIENTS = 10_000
# How often the background janitor removes expired workspaces. Between sweeps,
# unreachable directories only leave the disk when someone calls the store.
JANITOR_INTERVAL_SECONDS = 60

# The UI is a static bundle with self-hosted fonts and no inline script or
# style, so nothing legitimate needs a looser policy. API responses carry the
# same headers so a JSON endpoint can never be framed or sniffed either.
CSP_POLICY = (
    "default-src 'self'; "
    "script-src 'self'; "
    "style-src 'self'; "
    "img-src 'self' data:; "
    "font-src 'self'; "
    "connect-src 'self'; "
    "object-src 'none'; "
    "base-uri 'none'; "
    "frame-ancestors 'none'; "
    "form-action 'self'"
)

_LOG_JSON = os.environ.get("REPOSCRIBE_LOG_FORMAT", "text").strip().lower() == "json"

# Single application logger. Initialized once per process — but the
# `logging` package already dedupes, so importing elsewhere is safe.
_LOGGER_NAME = "reposcribe"
_logger = logging.getLogger(_LOGGER_NAME)
if not _logger.handlers and not any(
    isinstance(h, logging.StreamHandler) for h in _logger.parent.handlers if h
):
    _handler = logging.StreamHandler(stream=sys.stderr)
    _message_format = (
        "%(message)s"
        if _LOG_JSON
        else "%(asctime)s %(levelname)-5s %(message)s"
    )
    _handler.setFormatter(
        logging.Formatter(_message_format, datefmt="%Y-%m-%dT%H:%M:%S%z")
    )
    _logger.addHandler(_handler)
    # Default to INFO; override with REPOSCRIBE_LOG_LEVEL.
    _logger.setLevel(os.environ.get("REPOSCRIBE_LOG_LEVEL", "INFO").upper())


def _sweep_rate_buckets(buckets: dict[str, deque], now: float) -> None:
    """Drop rate-limit buckets that no longer hold a live request.

    Buckets are keyed by client address, so an attacker sending traffic from
    many addresses would otherwise grow the map forever.
    """
    for key in [key for key, bucket in buckets.items() if not bucket]:
        buckets.pop(key, None)
    if len(buckets) <= RATE_MAX_CLIENTS:
        return
    # Over the cap: drop the least recently active clients first.
    ordered = sorted(
        buckets.items(),
        key=lambda item: item[1][-1] if item[1] else 0.0,
    )
    for key, _bucket in ordered[: len(buckets) - RATE_MAX_CLIENTS]:
        buckets.pop(key, None)


class SPAStaticFiles(StaticFiles):
    """Serve the built SPA and fall back to ``index.html`` for client routes.

    API paths and missing asset files keep their real 404 so a typo in an
    endpoint or a deleted bundle never looks like a working page.
    """

    async def get_response(self, path: str, scope):
        try:
            response = await super().get_response(path, scope)
        except StarletteHTTPException as exc:
            if exc.status_code != 404 or not self._is_client_route(path):
                raise
            shell = await super().get_response("index.html", scope)
            return self._with_cache(shell, "index.html")
        if response.status_code == 404:
            if path == "api" or path.startswith("api/"):
                # Let the application's JSON error handler answer API typos.
                raise StarletteHTTPException(status_code=404)
            if self._is_client_route(path):
                shell = await super().get_response("index.html", scope)
                return self._with_cache(shell, "index.html")
        return self._with_cache(response, path)

    @staticmethod
    def _with_cache(response, path: str):
        """Hashed assets are immutable; the shell must always revalidate."""
        normalized = path.replace("\\", "/")
        content_type = response.headers.get("content-type", "")
        # StaticFiles serves the shell for "" or "." as well as index.html, so
        # the content type is the reliable signal, not the request path.
        if content_type.startswith("text/html") or normalized.endswith(".html"):
            response.headers["Cache-Control"] = "no-cache"
        elif normalized.startswith("assets/") or normalized.startswith("fonts/"):
            response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
        else:
            response.headers["Cache-Control"] = "public, max-age=3600"
        return response

    @staticmethod
    def _is_client_route(path: str) -> bool:
        normalized = path.replace("\\", "/")
        if normalized == "api" or normalized.startswith("api/"):
            return False
        # Hashed assets and other file-like requests must 404 rather than
        # silently returning the HTML shell with the wrong content type.
        return not PurePosixPath(normalized).suffix



def create_app() -> FastAPI:
    settings = get_settings()
    _set_session_secret_from(settings)
    production = settings.app_env == "production"
    app = FastAPI(
        title="RepoScribe API",
        version="0.3.0",
        # The schema and the interactive docs are developer surfaces; the
        # production deployment must not expose them.
        docs_url=None if production else "/api/docs",
        openapi_url=None if production else "/api/openapi.json",
        redoc_url=None if production else "/api/redoc",
        lifespan=_make_lifespan(settings),
    )
    app.state.store = Store(settings)
    app.state.rate = {}
    app.state.rate_checks = 0

    app.add_middleware(
        CORSMiddleware,
        allow_origins=[settings.frontend_origin],
        allow_credentials=True,
        allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Content-Type"],
    )

    @app.middleware("http")
    async def session_and_limits(request: Request, call_next):
        request.state.request_id = uuid.uuid4().hex[:12]
        # An unsigned or tampered cookie is ignored: a client must not be able
        # to pick a session id it likes (session fixation).
        existing = read_session_cookie(request.cookies.get(COOKIE_NAME, ""))
        session = existing or f"sess_{uuid.uuid4().hex}"
        request.state.session_id = session
        session_cookie_value = sign_session(session)
        started = time.monotonic()
        # The session cookie is signed, so a client cannot pick an arbitrary
        # id, but it can still mint new sessions at will. The rate limit is
        # therefore keyed on the network peer, which it cannot rotate at will.
        client_key = request.client.host if request.client else "unknown"

        if request.url.path.startswith("/api") and request.method != "OPTIONS":
            # Liveness and provider-status poll at high frequency in production.
            # They must not drain the per-client request budget.
            if request.url.path not in ("/api/v1/health", "/api/v1/provider"):
                bucket = app.state.rate.get(client_key)
                now = time.monotonic()
                if bucket is None:
                    bucket = deque()
                    app.state.rate[client_key] = bucket
                while bucket and now - bucket[0] > RATE_WINDOW_SECONDS:
                    bucket.popleft()
                if len(bucket) >= RATE_LIMIT:
                    _log_request(request, 429, int((time.monotonic() - started) * 1000))
                    return JSONResponse(
                        status_code=429,
                        content={
                            "error": {
                                "code": "rate_limited",
                                "message": "Too many requests. Retry shortly.",
                                "request_id": request.state.request_id,
                                "retryable": True,
                            }
                        },
                        headers={
                            "Retry-After": str(RATE_WINDOW_SECONDS),
                            "X-Request-ID": request.state.request_id,
                        },
                    )
                bucket.append(now)
                app.state.rate_checks += 1
                if app.state.rate_checks % RATE_SWEEP_INTERVAL == 0:
                    _sweep_rate_buckets(app.state.rate, now)

            # Reject an oversized upload before multipart parsing buffers it.
            # The endpoint also enforces the exact limit while streaming.
            if (
                request.method == "POST"
                and request.url.path == f"{API_PREFIX}/repositories"
                and (raw_length := request.headers.get("content-length"))
                and raw_length.isdigit()
                and int(raw_length) > settings.max_upload_mb * MB + MB
            ):
                _log_request(request, 413, int((time.monotonic() - started) * 1000))
                return JSONResponse(
                    status_code=413,
                    content={
                        "error": {
                            "code": "payload_too_large",
                            "message": f"Upload exceeds the {settings.max_upload_mb} MB limit.",
                            "request_id": request.state.request_id,
                            "retryable": False,
                        }
                    },
                    headers={"X-Request-ID": request.state.request_id},
                )

            # Every other request with a declared body is capped much lower. The
            # gate runs before routing and before any body is buffered, so no
            # endpoint can be handed an unbounded JSON payload.
            if (
                request.method in ("POST", "PUT", "PATCH", "DELETE")
                and request.url.path != f"{API_PREFIX}/repositories"
                and (raw_length := request.headers.get("content-length"))
                and raw_length.isdigit()
                and int(raw_length) > settings.max_request_body_mb * MB
            ):
                _log_request(request, 413, int((time.monotonic() - started) * 1000))
                return JSONResponse(
                    status_code=413,
                    content={
                        "error": {
                            "code": "payload_too_large",
                            "message": f"Request body exceeds the {settings.max_request_body_mb} MB limit.",
                            "request_id": request.state.request_id,
                            "retryable": False,
                        }
                    },
                    headers={"X-Request-ID": request.state.request_id},
                )

        response = await call_next(request)
        duration_ms = int((time.monotonic() - started) * 1000)
        response.headers["X-Request-ID"] = request.state.request_id
        _log_request(request, response.status_code, duration_ms)
        if not existing:
            response.set_cookie(
                COOKIE_NAME,
                session_cookie_value,
                httponly=True,
                samesite="lax",
                secure=settings.app_env == "production",
                max_age=settings.workspace_ttl_minutes * 60,
            )
        return response

    # Registered last, so it wraps the session middleware: the early 413 and
    # 429 responses carry the same security headers as normal ones.
    @app.middleware("http")
    async def security_headers(request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
        response.headers["Content-Security-Policy"] = CSP_POLICY
        if request.url.path.startswith("/api"):
            # Finding text and excerpts are per-session; nothing should cache.
            response.headers["Cache-Control"] = "no-store"
        if production:
            response.headers["Strict-Transport-Security"] = "max-age=31536000"
        return response

    app.add_exception_handler(AppError, app_error_handler)
    app.add_exception_handler(RequestValidationError, _validation_handler)
    app.add_exception_handler(StarletteHTTPException, _http_handler)
    app.add_exception_handler(Exception, unhandled_error_handler)

    for module in (health, provider, repositories, audits, findings, questions, patches):
        app.include_router(module.router, prefix=API_PREFIX)

    dist = Path(__file__).resolve().parents[2] / "frontend" / "dist"
    if dist.is_dir():
        app.mount("/", SPAStaticFiles(directory=dist, html=True), name="ui")

    return app


def _set_session_secret_from(settings) -> None:
    # Sessions are signed with a per-process secret unless SESSION_SECRET is
    # configured. More than one worker must share that value.
    set_session_secret(settings.session_secret)


def _make_lifespan(settings):
    """Startup and shutdown for one worker.

    Repositories are restored from SQLite before the server accepts traffic.
    A workspace that survived the restart keeps its repository; a workspace
    that did not is marked unavailable, but its findings and audit history
    remain readable. A janitor task then expires idle workspaces while the
    process runs and is cancelled on shutdown.
    """

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        removed = sweep_orphan_workspaces(settings, keep=app.state.store.ids())
        if removed:
            _logger.warning(
                "Removed %d workspace directory(ies) with no persisted owner.",
                len(removed),
            )

        for state in app.state.store.all():
            if state.root.is_dir():
                continue
            note = (
                "The workspace was not restored after a restart; upload the "
                "repository again to re-audit it."
            )
            if note not in state.scan_limitations:
                state.status = "failed"
                state.scan_limitations.append(note)
                app.state.store.persist(state)

        async def janitor():
            while True:
                await asyncio.sleep(JANITOR_INTERVAL_SECONDS)
                try:
                    app.state.store.sweep_expired()
                    sweep_orphan_workspaces(settings, keep=app.state.store.ids())
                except Exception:  # pragma: no cover - a janitor failure must never kill the app
                    _logger.warning("Workspace sweep failed.", exc_info=True)

        task = asyncio.create_task(janitor(), name="reposcribe-janitor")
        try:
            yield
        finally:
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:  # pragma: no cover - shutdown path
                pass

    return lifespan


def _log_request(request: Request, status: int, duration_ms: int) -> None:
    """OPS-02: one INFO line per request with the route template, status,
    duration, and request id. No body, no query string, no secrets."""
    route = request.scope.get("route")
    template = getattr(route, "path", None)
    if not template:
        path_template = request.url.path
    elif template.startswith(API_PREFIX):
        path_template = template
    elif request.url.path.startswith(API_PREFIX):
        # FastAPI's lazy router inclusion keeps the parent prefix out of
        # ``route.path``, so put it back for the log line.
        path_template = f"{API_PREFIX}{template}"
    else:
        path_template = template
    fields = {
        "rid": request.state.request_id,
        "method": request.method,
        "path": path_template,
        "status": status,
        "duration_ms": duration_ms,
    }
    if _LOG_JSON:
        _logger.info(json.dumps(fields, separators=(",", ":")))
    else:
        _logger.info(
            "rid=%(rid)s method=%(method)s path=%(path)s status=%(status)s duration_ms=%(duration_ms)s",
            fields,
        )


async def _validation_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    request_id = getattr(request.state, "request_id", "")
    return JSONResponse(
        status_code=422,
        content={
            "error": {
                "code": "schema_validation_failed",
                "message": "The request body or query did not pass validation.",
                "request_id": request_id,
                "retryable": False,
            }
        },
    )


async def _http_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
    request_id = getattr(request.state, "request_id", "")
    code = {
        404: "not_found",
        405: "method_not_allowed",
    }.get(exc.status_code, "invalid_request")
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {
                "code": code,
                "message": str(exc.detail) if exc.detail else "Request failed.",
                "request_id": request_id,
                "retryable": False,
            }
        },
    )


app = create_app()
