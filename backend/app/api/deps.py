"""Shared API dependencies."""

from __future__ import annotations

from fastapi import Request

from app.core.errors import AppError
from app.core.settings import Settings, get_settings
from app.services.store import RepositoryState, Store


def get_app_settings() -> Settings:
    return get_settings()


def get_store(request: Request) -> Store:
    return request.app.state.store


def session_id(request: Request) -> str:
    return request.state.session_id


def repo_or_404(request: Request, repository_id: str) -> RepositoryState:
    store: Store = request.app.state.store
    state = store.get(repository_id, request.state.session_id)
    if state is None:
        raise AppError("repository_not_found", "Repository workspace not found or expired.", 404)
    return state
