"""Typed configuration loaded from the environment.

Secrets are never exposed through the API. Model provider defaults to the
labelled local demo mode until a real Alan contract is verified (SPEC 21.2).
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path


def _env(name: str, default: str = "") -> str:
    return os.environ.get(name, default).strip()


def _int(name: str, default: int) -> int:
    raw = _env(name)
    if not raw:
        return default
    try:
        return int(raw)
    except ValueError:
        return default


@dataclass(frozen=True)
class Settings:
    app_env: str = "development"
    frontend_origin: str = "http://localhost:5173"
    backend_port: int = 8000

    max_upload_mb: int = 20
    max_extracted_files: int = 5000
    max_file_mb: int = 2
    max_extracted_mb: int = 200
    workspace_root: Path = Path("./.reposcribe-workspaces")
    workspace_ttl_minutes: int = 120

    alan_api_key: str = ""
    alan_workflow_id: str = ""
    alan_base_url: str = ""

    model_provider: str = "local_demo"
    model_name: str = ""
    model_license: str = ""
    model_base_url: str = ""
    model_api_key: str = ""
    model_timeout_seconds: int = 30
    model_max_input_tokens: int = 32000

    sample_repo_dir: Path = field(default_factory=lambda: Path(__file__).resolve().parent.parent / "data" / "sample_repo")

    @property
    def alan_configured(self) -> bool:
        return bool(self.alan_api_key and self.alan_workflow_id and self.alan_base_url)

    @property
    def live_model_configured(self) -> bool:
        return bool(self.model_api_key and self.model_base_url and self.model_name)

    def ensure_workspace_root(self) -> Path:
        self.workspace_root.mkdir(parents=True, exist_ok=True)
        return self.workspace_root


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings(
        app_env=_env("APP_ENV", "development"),
        frontend_origin=_env("FRONTEND_ORIGIN", "http://localhost:5173"),
        backend_port=_int("BACKEND_PORT", 8000),
        max_upload_mb=_int("MAX_UPLOAD_MB", 20),
        max_extracted_files=_int("MAX_EXTRACTED_FILES", 5000),
        max_file_mb=_int("MAX_FILE_MB", 2),
        max_extracted_mb=_int("MAX_EXTRACTED_MB", 200),
        workspace_root=Path(_env("WORKSPACE_ROOT", "./.reposcribe-workspaces")),
        workspace_ttl_minutes=_int("WORKSPACE_TTL_MINUTES", 120),
        alan_api_key=_env("ALAN_API_KEY"),
        alan_workflow_id=_env("ALAN_WORKFLOW_ID"),
        alan_base_url=_env("ALAN_BASE_URL"),
        model_provider=_env("MODEL_PROVIDER", "local_demo"),
        model_name=_env("MODEL_NAME"),
        model_license=_env("MODEL_LICENSE"),
        model_base_url=_env("MODEL_BASE_URL"),
        model_api_key=_env("MODEL_API_KEY"),
        model_timeout_seconds=_int("MODEL_TIMEOUT_SECONDS", 30),
        model_max_input_tokens=_int("MODEL_MAX_INPUT_TOKENS", 32000),
    )
