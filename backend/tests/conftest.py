from __future__ import annotations

import io
import zipfile
from pathlib import Path

import pytest
from fastapi.testclient import TestClient


@pytest.fixture(autouse=True)
def _isolated_state(tmp_path, monkeypatch):
    """Give every test its own SQLite file and workspace directory."""
    monkeypatch.setenv("WORKSPACE_ROOT", str(tmp_path / "workspaces"))
    monkeypatch.setenv("REPOSCRIBE_DB_PATH", str(tmp_path / "state.db"))
    from app.core import settings as settings_module

    settings_module.get_settings.cache_clear()
    yield
    settings_module.get_settings.cache_clear()


@pytest.fixture()
def settings(tmp_path, monkeypatch):
    monkeypatch.setenv("WORKSPACE_ROOT", str(tmp_path / "workspaces"))
    monkeypatch.setenv("REPOSCRIBE_DB_PATH", str(tmp_path / "state.db"))
    monkeypatch.setenv("MODEL_PROVIDER", "local_demo")
    from app.core import settings as settings_module

    settings_module.get_settings.cache_clear()
    yield settings_module.get_settings()
    settings_module.get_settings.cache_clear()


@pytest.fixture()
def client(settings):
    from app.main import create_app

    app = create_app()
    with TestClient(app) as test_client:
        yield test_client


def write_repo(root: Path, files: dict[str, str]) -> Path:
    for relative, content in files.items():
        target = root / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding="utf-8")
    return root


def make_zip(files: dict[str, str]) -> bytes:
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as archive:
        for name, content in files.items():
            archive.writestr(name, content)
    return buffer.getvalue()


@pytest.fixture()
def sample_state(settings):
    """A ready-to-audit sample repository, bypassing the HTTP layer."""
    from app.main import create_app
    from app.services.repository_service import RepositoryService

    app = create_app()
    service = RepositoryService(settings, app.state.store)
    return service, service.create_from_sample("sess_fixture")