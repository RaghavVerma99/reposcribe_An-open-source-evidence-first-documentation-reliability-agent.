"""Health endpoint (OPS-01, SPEC 20.1)."""

from __future__ import annotations

import os

from fastapi import APIRouter, Depends

from app.api.deps import get_app_settings
from app.core.settings import Settings
from app.integrations.model_provider import provider_status
from app.schemas.models import HealthResponse

router = APIRouter(tags=["health"])
VERSION = "0.1.0"


@router.get("/health", response_model=HealthResponse)
def health(settings: Settings = Depends(get_app_settings)) -> HealthResponse:
    try:
        settings.ensure_workspace_root()
        probe = settings.workspace_root / ".healthcheck"
        probe.write_text("ok", encoding="utf-8")
        probe.unlink(missing_ok=True)
        writable = True
    except OSError:
        writable = False

    provider = provider_status(settings)
    status = "ok" if writable else "degraded"
    return HealthResponse(
        status=status,
        app=settings.app_env,
        version=VERSION,
        workspace_writable=writable,
        provider=provider,
    )
