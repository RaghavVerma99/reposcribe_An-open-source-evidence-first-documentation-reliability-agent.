"""Regression tests for hardening fixes that do not fit a single feature area."""

from __future__ import annotations

from datetime import timedelta
from pathlib import Path

import pytest

from app.services.store import utcnow
from tests.conftest import make_zip

README = "# App\n\n## Installation\n\npytest\n\nSee [missing](docs/missing.md).\n"
APP = "from fastapi import FastAPI\napp = FastAPI()\n"


def _create(client, files: dict[str, str]) -> dict:
    response = client.post(
        "/api/v1/repositories",
        files={"file": ("repo.zip", make_zip(files), "application/zip")},
    )
    assert response.status_code == 201, response.text
    return response.json()


def test_partial_audit_keeps_findings_from_checks_that_did_not_run(client) -> None:
    repo = _create(client, {"README.md": README, "app.py": APP})
    full = client.post(f"/api/v1/repositories/{repo['id']}/audits")
    assert full.status_code == 200, full.text
    full_body = full.json()
    link_finding = next(
        finding
        for finding in full_body["findings"]
        if finding["check_id"] == "markdown.internal_link_exists"
    )

    partial = client.post(
        f"/api/v1/repositories/{repo['id']}/audits",
        json={"check_ids": ["docs.readme_checklist"]},
    )
    assert partial.status_code == 200, partial.text
    body = partial.json()
    assert body["checks_run"] == ["docs.readme_checklist"]
    assert "markdown.internal_link_exists" not in body["checks_run"]

    preserved = next(finding for finding in body["findings"] if finding["id"] == link_finding["id"])
    assert preserved["status"] == link_finding["status"]
    assert preserved["status"] != "resolved"


def test_second_audit_for_same_repository_returns_409(client) -> None:
    repo = _create(client, {"README.md": README, "app.py": APP})
    state = client.app.state.store.get(repo["id"])
    assert state is not None

    # Simulate an audit already in flight without relying on timing.
    state.audit_lock.acquire()
    try:
        response = client.post(f"/api/v1/repositories/{repo['id']}/audits")
    finally:
        state.audit_lock.release()

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "audit_in_progress"
    assert response.json()["error"]["retryable"] is False


def test_workspace_ttl_uses_last_access_not_creation(settings, sample_state) -> None:
    service, state = sample_state
    store = service.store
    expired_cutoff = utcnow() - timedelta(minutes=settings.workspace_ttl_minutes + 1)

    state.created_at = expired_cutoff
    state.last_accessed_at = utcnow()
    store.register(state)

    assert store.get(state.id) is state

    state.last_accessed_at = expired_cutoff
    assert store.get(state.id) is None


def test_secret_files_do_not_count_as_indexed_or_inspected(client) -> None:
    repo = _create(
        client,
        {
            "README.md": "# App\n\n## Installation\n\npytest\n",
            "app.py": APP,
            ".env": "SECRET_KEY=never-indexed\n",
            "certs/private.pem": "-----BEGIN PRIVATE KEY-----\n",
        },
    )
    assert repo["files_indexed"] == 2

    overview = client.get(f"/api/v1/repositories/{repo['id']}/overview").json()
    assert overview["file_count"] == 2
    assert ".env" not in overview["doc_files"]

    audit = client.post(f"/api/v1/repositories/{repo['id']}/audits").json()
    assert audit["summary"]["files_inspected"] == 2


def test_single_service_spa_deep_links_and_api_404s(client) -> None:
    dist = Path(__file__).resolve().parents[3] / "frontend" / "dist"
    if not (dist / "index.html").is_file():
        pytest.skip("frontend/dist is not built")

    deep_link = client.get("/r/repo_unused/findings")
    assert deep_link.status_code == 200
    assert "text/html" in deep_link.headers["content-type"]

    api_404 = client.get("/api/v1/not-a-real-endpoint")
    assert api_404.status_code == 404
    assert api_404.headers["content-type"].startswith("application/json")
    assert api_404.json()["error"]["code"] == "not_found"

    missing_asset = client.get("/assets/not-a-real-asset.js")
    assert missing_asset.status_code == 404
    assert "text/html" not in missing_asset.headers["content-type"]
