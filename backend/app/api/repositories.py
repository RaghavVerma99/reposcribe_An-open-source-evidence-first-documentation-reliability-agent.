"""Repository intake, overview, search, and deletion (SPEC 20.1)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, File, Form, Request, Response, UploadFile

from app.api.deps import get_app_settings, get_store, repo_or_404, session_id
from app.core.errors import AppError
from app.core.security import MB
from app.core.settings import Settings
from app.schemas.models import Repository, RepositoryOverview, SearchHit, SearchResponse
from app.services.question_service import retrieve
from app.services.repository_service import RepositoryService
from app.services.store import Store

router = APIRouter(prefix="/repositories", tags=["repositories"])

UPLOAD_CHUNK_BYTES = 64 * 1024


def _service(settings: Settings, store: Store) -> RepositoryService:
    return RepositoryService(settings, store)


async def _read_upload_limited(upload: UploadFile, limit_bytes: int) -> bytes:
    """Read an upload in bounded chunks and fail before buffering past the cap."""
    chunks: list[bytes] = []
    total = 0
    while chunk := await upload.read(UPLOAD_CHUNK_BYTES):
        total += len(chunk)
        if total > limit_bytes:
            raise AppError(
                "payload_too_large",
                f"Upload exceeds the {limit_bytes // MB} MB limit.",
                413,
            )
        chunks.append(chunk)
    return b"".join(chunks)


@router.post("", response_model=Repository, status_code=201)
async def create_repository(
    request: Request,
    sample_id: str | None = Form(default=None),
    file: UploadFile | None = File(default=None),
    settings: Settings = Depends(get_app_settings),
    store: Store = Depends(get_store),
    sid: str = Depends(session_id),
) -> Repository:
    service = _service(settings, store)
    if file is not None:
        data = await _read_upload_limited(file, settings.max_upload_mb * MB)
        state = service.create_from_upload(sid, file.filename or "upload.zip", data)
    elif sample_id:
        state = service.create_from_sample(sid, sample_id)
    else:
        raise AppError("invalid_request", "Provide either a sample_id or a ZIP file.")
    return service.to_model(state)


@router.get("/{repository_id}", response_model=Repository)
def get_repository(
    request: Request,
    repository_id: str,
    settings: Settings = Depends(get_app_settings),
    store: Store = Depends(get_store),
) -> Repository:
    state = repo_or_404(request, repository_id)
    return _service(settings, store).to_model(state)


@router.post("/{repository_id}/index", response_model=Repository)
def reindex_repository(
    request: Request,
    repository_id: str,
    settings: Settings = Depends(get_app_settings),
    store: Store = Depends(get_store),
) -> Repository:
    state = repo_or_404(request, repository_id)
    service = _service(settings, store)
    service.reindex(state)
    return service.to_model(state)


@router.get("/{repository_id}/overview", response_model=RepositoryOverview)
def get_overview(
    request: Request,
    repository_id: str,
    settings: Settings = Depends(get_app_settings),
    store: Store = Depends(get_store),
) -> RepositoryOverview:
    state = repo_or_404(request, repository_id)
    return _service(settings, store).overview(state)


@router.get("/{repository_id}/search", response_model=SearchResponse)
def search_repository(
    request: Request,
    repository_id: str,
    q: str = "",
    limit: int = 8,
) -> SearchResponse:
    state = repo_or_404(request, repository_id)
    if state.index is None:
        raise AppError("internal_error", "Repository has not been indexed.", 500)
    if not q.strip():
        return SearchResponse(hits=[])
    bounded = max(1, min(limit, 20))
    chunks = retrieve(state.index, q, limit=bounded)
    return SearchResponse(
        hits=[
            SearchHit(
                path=chunk.path,
                start_line=chunk.start_line,
                end_line=chunk.end_line,
                excerpt=chunk.text,
                role=chunk.role,
            )
            for chunk in chunks
        ],
        truncated=len(chunks) == bounded,
    )


@router.delete("/{repository_id}", status_code=204)
def delete_repository(
    request: Request,
    repository_id: str,
    settings: Settings = Depends(get_app_settings),
    store: Store = Depends(get_store),
) -> Response:
    state = repo_or_404(request, repository_id)
    _service(settings, store).delete(state)
    return Response(status_code=204)
