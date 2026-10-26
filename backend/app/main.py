"""RepoScribe application factory."""

from __future__ import annotations

import logging
import os
import sys
import time
import uuid
from collections import defaultdict, deque
from pathlib import Path, PurePosixPath

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.api import audits, findings, health, patches, provider, questions, repositories
from app.core.errors import AppError, app_error_handler, unhandled_error_handler
from app.core.security import MB
from app.core.settings import get_settings
from app.services.store import Store

COOKIE_NAME = "reposcribe_session"
API_PREFIX = "/api/v1"
RATE_LIMIT = 120
RATE_WINDOW_SECONDS = 60

# Single application logger. Initialized once per process — but the
# `logging` package already dedupes, so importing elsewhere is safe.
_LOGGER_NAME = "reposcribe"
_logger = logging.getLogger(_LOGGER_NAME)
if not _logger.handlers and not any(
    isinstance(h, logging.StreamHandler) for h in _logger.parent.handlers if h
):
    _handler = logging.StreamHandler(stream=sys.stderr)
    _handler.setFormatter(
        logging.Formatter(
            "%(asctime)s %(levelname)-5s %(message)s",
            datefmt="%Y-%m-%dT%H:%M:%S%z",
        )
    )
    _logger.addHandler(_handler)
    # Default to INFO; override with REPOSCRIBE_LOG_LEVEL.
    _logger.setLevel(os.environ.get("REPOSCRIBE_LOG_LEVEL", "INFO").upper())


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
            return await super().get_response("index.html", scope)
        if response.status_code == 404:
            if path == "api" or path.startswith("api/"):
                # Let the application's JSON error handler answer API typos.
                raise StarletteHTTPException(status_code=404)
            if self._is_client_route(path):
                return await super().get_response("index.html", scope)
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
    app = FastAPI(
        title="RepoScribe API",
        version="0.3.0",
        docs_url="/api/docs",
        openapi_url="/api/openapi.json",
    )
    app.state.store = Store(settings)
    app.state.rate = defaultdict(deque)

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
        existing = request.cookies.get(COOKIE_NAME)
        session = existing or f"sess_{uuid.uuid4().hex}"
        request.state.session_id = session
        started = time.monotonic()

        if request.url.path.startswith("/api") and request.method != "OPTIONS":
            # Liveness and provider-status poll at high frequency in production.
            # They must not drain the per-session request budget.
            if request.url.path not in ("/api/v1/health", "/api/v1/provider"):
                bucket = app.state.rate[session]
                now = time.monotonic()
                while bucket and now - bucket[0] > RATE_WINDOW_SECONDS:
                    bucket.popleft()
                if len(bucket) >= RATE_LIMIT:
                    _log_request(request, 429, int((time.monotonic() - started) * 1000))
                    return JSONResponse(
                        status_code=429,
                        content={
                            "error": {
                                "code": "provider_rate_limited",
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

        response = await call_next(request)
        duration_ms = int((time.monotonic() - started) * 1000)
        response.headers["X-Request-ID"] = request.state.request_id
        _log_request(request, response.status_code, duration_ms)
        if not existing:
            response.set_cookie(
                COOKIE_NAME,
                session,
                httponly=True,
                samesite="lax",
                secure=settings.app_env == "production",
                max_age=settings.workspace_ttl_minutes * 60,
            )
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
    _logger.info(
        "rid=%s method=%s path=%s status=%s duration_ms=%s",
        request.state.request_id,
        request.method,
        path_template,
        status,
        duration_ms,
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
