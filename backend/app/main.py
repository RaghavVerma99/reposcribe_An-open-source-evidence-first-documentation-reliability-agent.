"""RepoScribe application factory."""

from __future__ import annotations

import time
import uuid
from collections import defaultdict, deque
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.api import audits, findings, health, patches, provider, questions, repositories
from app.core.errors import AppError, app_error_handler, unhandled_error_handler
from app.core.settings import get_settings
from app.services.store import Store

COOKIE_NAME = "reposcribe_session"
RATE_LIMIT = 120
RATE_WINDOW_SECONDS = 60


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="RepoScribe API",
        version="0.2.0",
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

        if request.url.path.startswith("/api") and request.method != "OPTIONS":
            # Liveness and provider-status poll at high frequency in production.
            # They must not drain the per-session request budget.
            if request.url.path in ("/api/v1/health", "/api/v1/provider"):
                response = await call_next(request)
                response.headers["X-Request-ID"] = request.state.request_id
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
            bucket = app.state.rate[session]
            now = time.monotonic()
            while bucket and now - bucket[0] > RATE_WINDOW_SECONDS:
                bucket.popleft()
            if len(bucket) >= RATE_LIMIT:
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
                    headers={"Retry-After": str(RATE_WINDOW_SECONDS), "X-Request-ID": request.state.request_id},
                )
            bucket.append(now)

        response = await call_next(request)
        response.headers["X-Request-ID"] = request.state.request_id
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
        app.include_router(module.router, prefix="/api/v1")

    dist = Path(__file__).resolve().parents[2] / "frontend" / "dist"
    if dist.is_dir():
        app.mount("/", StaticFiles(directory=dist, html=True), name="ui")

    return app


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
