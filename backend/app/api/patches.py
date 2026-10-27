"""Patch draft, detail, validation, and download (SPEC 20.1, 22)."""

from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends, Query, Request, Response

from app.api.deps import get_app_settings, repo_or_404
from app.core.settings import Settings
from app.schemas.models import PatchDetail, PatchDraft, ValidationResult
from app.services.export_service import export_markdown, export_patch
from app.services.patch_service import PatchService
from app.services.repository_service import RepositoryService

router = APIRouter(tags=["patches"])


@router.post(
    "/repositories/{repository_id}/findings/{finding_id}/patches",
    response_model=PatchDraft,
    status_code=201,
)
def create_patch(
    request: Request,
    repository_id: str,
    finding_id: str,
    settings: Settings = Depends(get_app_settings),
) -> PatchDraft:
    state = repo_or_404(request, repository_id)
    store = request.app.state.store
    RepositoryService(settings, store).ensure_index(state)
    patch = PatchService(settings).create(state, finding_id)
    store.persist(state)
    return patch


@router.get("/repositories/{repository_id}/patches/{patch_id}", response_model=PatchDetail)
def get_patch(
    request: Request,
    repository_id: str,
    patch_id: str,
    settings: Settings = Depends(get_app_settings),
) -> PatchDetail:
    state = repo_or_404(request, repository_id)
    service = PatchService(settings)
    patch = service.get(state, patch_id)
    return PatchDetail(patch=patch, validation=state.validations.get(patch_id))


@router.post(
    "/repositories/{repository_id}/patches/{patch_id}/validate",
    response_model=ValidationResult,
)
def validate_patch(
    request: Request,
    repository_id: str,
    patch_id: str,
    settings: Settings = Depends(get_app_settings),
) -> ValidationResult:
    state = repo_or_404(request, repository_id)
    store = request.app.state.store
    RepositoryService(settings, store).ensure_index(state)
    result = PatchService(settings).validate(state, patch_id)
    store.persist(state)
    return result


@router.get("/repositories/{repository_id}/patches/{patch_id}/download")
def download_patch(
    request: Request,
    repository_id: str,
    patch_id: str,
    format: Literal["patch", "markdown"] = Query(default="patch"),
    settings: Settings = Depends(get_app_settings),
) -> Response:
    state = repo_or_404(request, repository_id)
    patch = PatchService(settings).get(state, patch_id)
    filename, content, media_type = export_patch(patch) if format == "patch" else export_markdown(patch)
    return Response(
        content=content,
        media_type=media_type,
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "X-Content-Type-Options": "nosniff",
        },
    )
