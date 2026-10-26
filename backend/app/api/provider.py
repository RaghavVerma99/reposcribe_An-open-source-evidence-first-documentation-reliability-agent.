"""Provider status endpoint (UI-09)."""

from __future__ import annotations

from fastapi import APIRouter, Depends

from app.api.deps import get_app_settings
from app.core.settings import Settings
from app.integrations.model_provider import provider_status
from app.schemas.models import ProviderStatus

router = APIRouter(tags=["provider"])


@router.get("/provider", response_model=ProviderStatus)
def get_provider(settings: Settings = Depends(get_app_settings)) -> ProviderStatus:
    return provider_status(settings)
