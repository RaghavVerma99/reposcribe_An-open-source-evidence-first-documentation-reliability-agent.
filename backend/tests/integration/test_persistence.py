"""Persistence, restart recovery, and audit deltas."""

from __future__ import annotations

import shutil

import pytest

from app.core.errors import AppError
from app.services.audit_service import AuditService
from app.services.repository_service import RepositoryService
from app.services.store import Store, sweep_orphan_workspaces
from tests.conftest import make_zip

FILES = {
    "README.md": "# Project\n\nSee [missing](docs/missing.md).\n",
    "docs/guide.md": "# Guide\n",
    "app/main.py": "from fastapi import FastAPI\n\napp = FastAPI()\n",
}


def _store_with_repo(settings, session: str = "sess_persist"):
    store = Store(settings)
    service = RepositoryService(settings, store)
    state = service.create_from_upload(session, "repo.zip", make_zip(FILES))
    return store, service, state


def test_state_and_history_survive_a_new_store(settings) -> None:
    store, _, state = _store_with_repo(settings, "sess_restart")
    audit = AuditService(settings).run(state)
    store.persist(state)

    # A new process constructs a new Store against the same SQLite file.
    restored_store = Store(settings)
    restored = restored_store.get(state.id, "sess_restart")
    assert restored is not None
    assert restored.name == state.name
    assert restored.session_id == "sess_restart"
    assert restored.findings
    assert audit.id in restored.audits
    assert restored.audits[audit.id].summary.findings_total >= 1

    # The index is not stored; it is rebuilt from the workspace on first use.
    overview = RepositoryService(settings, restored_store).overview(restored)
    assert overview.file_count == len(FILES)
    assert overview.findings_by_status


def test_second_audit_reports_fixed_findings(settings) -> None:
    store, service, state = _store_with_repo(settings, "sess_delta")
    first = AuditService(settings).run(state)
    assert first.delta is None
    assert any(
        finding.check_id == "markdown.internal_link_exists"
        for finding in first.findings
        if finding.status not in ("resolved", "dismissed")
    )

    (state.root / "README.md").write_text(
        "# Project\n\nSee [guide](docs/guide.md).\n", encoding="utf-8"
    )
    service.reindex(state)
    second = AuditService(settings).run(state)

    assert second.delta is not None
    assert second.delta.fixed >= 1
    assert second.delta.added == 0
    assert second.delta.previous_audit_id == first.id
    assert all(
        finding.check_id != "markdown.internal_link_exists"
        for finding in second.findings
        if finding.status not in ("resolved", "dismissed")
    )


def test_finding_status_persists_across_restart(settings) -> None:
    store, _, state = _store_with_repo(settings, "sess_status")
    AuditService(settings).run(state)
    finding_id = next(iter(state.findings))

    AuditService(settings).set_status(state, finding_id, "dismissed")
    store.persist(state)

    restored = Store(settings).get(state.id, "sess_status")
    assert restored is not None
    assert restored.findings[finding_id].status == "dismissed"
    assert restored.findings[finding_id].revision == 1
    assert restored.dismissed == {finding_id}


def test_session_cookie_survives_a_restart(monkeypatch, settings) -> None:
    monkeypatch.setenv("SESSION_SECRET", "test-session-secret")
    from app.core import settings as settings_module
    from app.main import create_app
    from fastapi.testclient import TestClient

    settings_module.get_settings.cache_clear()

    app1 = create_app()
    with TestClient(app1) as first:
        created = first.post("/api/v1/repositories", data={"sample_id": "fastapi-users"})
        assert created.status_code == 201
        repository_id = created.json()["id"]
        cookie = first.cookies.get("reposcribe_session")
        assert cookie

    # A second app is a new process: new Store, same database and secret.
    app2 = create_app()
    with TestClient(app2) as second:
        second.cookies.set("reposcribe_session", cookie)
        fetched = second.get(f"/api/v1/repositories/{repository_id}")
        assert fetched.status_code == 200
        assert fetched.json()["id"] == repository_id


def test_orphan_sweep_keeps_persisted_workspaces(settings) -> None:
    store, _, state = _store_with_repo(settings, "sess_keep")
    orphan = settings.workspace_root / "repo_without_owner"
    orphan.mkdir(parents=True)

    removed = sweep_orphan_workspaces(settings, keep=store.ids())

    assert orphan.name in removed
    assert state.workspace.is_dir()


def test_history_survives_a_missing_workspace(settings) -> None:
    store, _, state = _store_with_repo(settings, "sess_missing")
    audit = AuditService(settings).run(state)
    store.persist(state)

    shutil.rmtree(state.workspace)

    restored_store = Store(settings)
    restored = restored_store.get(state.id, "sess_missing")
    assert restored is not None
    assert audit.id in restored.audits
    with pytest.raises(AppError) as raised:
        RepositoryService(settings, restored_store).overview(restored)
    assert raised.value.status_code == 410
