"""Health endpoint (OPS-01, SPEC 20.1)."""

from __future__ import annotations

import os

from fastapi import APIRouter, Depends

from app.api.deps import get_app_settings
from app.core.settings import Settings
from app.integrations.model_provider import provider_status
from app.schemas.models import HealthResponse, ProviderStatus

router = APIRouter(tags=["health"])
VERSION = "0.2.0"

# Background-up probe: the workspace may not be writable, but that does not
# change between requests within a single process lifetime. Cache once.
_probe_result: bool | None = None


def _check_workspace_writable(settings: Settings) -> bool:
    global _probe_result
    if _probe_result is not None:
        return _probe_result
    try:
        workspace = settings.ensure_workspace_root()
        probe = workspace / ".healthcheck"
        fd = os.open(probe, os.O_WRONLY | os.O_CREAT, 0o600)
        try:
            os.write(fd, b"ok")
        finally:
            os.close(fd)
        probe.unlink(missing_ok=True)
        _probe_result = True
    except OSError:
        _probe_result = False
    return _probe_result


@router.get("/health", response_model=HealthResponse)
def health(settings: Settings = Depends(get_app_settings)) -> HealthResponse:
    writable = _check_workspace_writable(settings)
    provider = provider_status(settings)
    status = "ok" if writable else "degraded"
    return HealthResponse(
        status=status,
        app=settings.app_env,
        version=VERSION,
        workspace_writable=writable,
        provider=provider,
    )
