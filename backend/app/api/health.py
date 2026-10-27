"""Health endpoint (OPS-01, SPEC 20.1)."""

from __future__ import annotations

import os
import time

from fastapi import APIRouter, Depends

from app.api.deps import get_app_settings
from app.core.settings import Settings
from app.integrations.model_provider import provider_status
from app.schemas.models import HealthResponse, ProviderStatus

router = APIRouter(tags=["health"])
VERSION = "0.3.0"

# The workspace may not be writable, but that does not change between requests.
# The probe is cached for a short window instead of forever, so a workspace that
# becomes unwritable (a full disk, a revoked mount) is noticed within the TTL.
PROBE_TTL_SECONDS = 10.0

_probe_result: bool | None = None
_probe_checked_at: float = 0.0
_probe_root: str = ""


def _check_workspace_writable(settings: Settings) -> bool:
    global _probe_result, _probe_checked_at, _probe_root
    root = os.path.abspath(str(settings.workspace_root))
    now = time.monotonic()
    if (
        _probe_result is not None
        and _probe_root == root
        and (now - _probe_checked_at) < PROBE_TTL_SECONDS
    ):
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
        writable = True
    except OSError:
        writable = False
    _probe_result = writable
    _probe_checked_at = now
    _probe_root = root
    return writable


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
