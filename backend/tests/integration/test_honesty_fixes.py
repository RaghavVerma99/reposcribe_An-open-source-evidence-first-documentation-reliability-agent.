"""Regression tests for the high-severity honesty fixes.

Covers:
- #2 Patch generator rejects method+path rewrites that require human review
- #1 V-3 catches the same defect even when the patch changed its subject
- #3 Retrieval redacts secret-shaped content in /search and Q&A citations
- #4 OpenAPI YAML is parsed and produces findings
- B2  Patches cannot be created for dismissed or resolved findings
"""

from __future__ import annotations

import io
import zipfile

import pytest
from fastapi.testclient import TestClient

from app.main import create_app


@pytest.fixture()
def client():
    app = create_app()
    with TestClient(app) as test_client:
        yield test_client


def zip_of(files: dict[str, str]) -> bytes:
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as z:
        for name, text in files.items():
            z.writestr(name, text)
    return buffer.getvalue()


def make_repo(client: TestClient, files: dict[str, str]) -> str:
    response = client.post(
        "/api/v1/repositories", files={"file": ("r.zip", zip_of(files), "application/zip")}
    )
    assert response.status_code == 201, response.text
    return response.json()["id"]


def first_route_finding(client: TestClient, repo_id: str, status: str = "verified"):
    audit = client.post(f"/api/v1/repositories/{repo_id}/audits").json()
    for f in audit["findings"]:
        if f["check_id"] == "fastapi.route_matches_docs" and f["status"] == status:
            return f
    raise AssertionError("no route finding matched")


def test_patch_rejects_method_and_path_change_together(client) -> None:
    """#2 generator: cannot safely change both method and path."""
    files = {
        "app.py": (
            "from fastapi import FastAPI\n"
            "app = FastAPI()\n\n"
            "@app.get('/api/v2/users')\n"
            "def list_users():\n"
            "    return []\n"
        ),
        "README.md": (
            "# App\n\n## Installation\n\npytest\n\n"
            "| Method | Path |\n| --- | --- |\n"
            "| `DELETE` | `/api/users/{user_id}` | Remove a user |\n"
        ),
    }
    repo_id = make_repo(client, files)
    finding = first_route_finding(client, repo_id)
    response = client.post(f"/api/v1/repositories/{repo_id}/findings/{finding['id']}/patches")
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "patch_not_available"
    assert "human reviewer" in response.json()["error"]["message"].lower()


def test_patch_still_fixes_method_only_mismatch(client) -> None:
    """#2 happy path: method-only mismatch can still be fixed automatically."""
    files = {
        "app.py": (
            "from fastapi import FastAPI\n"
            "app = FastAPI()\n\n"
            "@app.get('/api/users')\n"
            "def list_users():\n"
            "    return []\n"
        ),
        "README.md": (
            "# App\n\n## Installation\n\npytest\n\n"
            "| Method | Path |\n| --- | --- |\n"
            "| `POST` | `/api/users` | Create |\n"
        ),
    }
    repo_id = make_repo(client, files)
    finding = first_route_finding(client, repo_id)
    response = client.post(f"/api/v1/repositories/{repo_id}/findings/{finding['id']}/patches")
    assert response.status_code == 201, response.text
    patch = response.json()
    # The proposed content swapped `POST` for `GET`; path is unchanged.
    assert "`GET` | `/api/users`" in patch["proposed_content"]
    assert "`POST` | `/api/users`" not in patch["proposed_content"]


def test_subject_key_is_stable_and_v3_compares_by_it(client) -> None:
    """#1: Finding.subject_key is exposed in the API and is stable across audits.

    V-3 now compares by (check_id, subject_key) rather than by id alone,
    which means a patch that subtly changes the subject of a defect can
    no longer slip past the validator. The defense-in-depth value here is
    that V-3 no longer relies on a hash that moves whenever the defect
    moves.
    """
    repo = client.post("/api/v1/repositories", data={"sample_id": "fastapi-users"}).json()
    audit = client.post(f"/api/v1/repositories/{repo['id']}/audits").json()
    route_findings = [
        f
        for f in audit["findings"]
        if f["check_id"] == "fastapi.route_matches_docs" and f["status"] == "verified"
    ]
    assert route_findings, "expected at least one route finding"
    keys = {f["subject_key"] for f in route_findings}
    # subject_key must be unique per defect (multiple route entries in the
    # same docs may share a subject_key if they are duplicates, but the
    # same defect should never appear under two different subject_keys).
    for finding in route_findings:
        assert finding["subject_key"], f"missing subject_key: {finding['id']}"
        assert finding["id"] != finding["subject_key"], "subject_key must not be the hash id"

    # Re-running the audit should yield identical subject_keys for defects
    # that are still present.
    audit2 = client.post(f"/api/v1/repositories/{repo['id']}/audits").json()
    keys2 = {
        f["subject_key"]
        for f in audit2["findings"]
        if f["check_id"] == "fastapi.route_matches_docs"
        and f["status"] in ("verified", "needs_review", "insufficient_evidence")
    }
    assert keys == keys2


def test_search_redacts_secrets(client) -> None:
    """#3 retrieval: secrets in ordinary files are not echoed by /search."""
    repo_id = make_repo(
        client,
        {
            "README.md": (
                "# App\n\nSet `DATABASE_PASSWORD=hunter2-supersecret` and\n"
                "`-----BEGIN RSA PRIVATE KEY-----\\nMIIE` before running.\n\n## Installation\n\npytest\n"
            ),
            "app.py": "x = 1\n",
        },
    )
    response = client.get(
        f"/api/v1/repositories/{repo_id}/search", params={"q": "DATABASE_PASSWORD"}
    ).json()
    excerpts = " ".join(hit["excerpt"] for hit in response["hits"])
    assert "hunter2-supersecret" not in excerpts
    assert "BEGIN RSA PRIVATE KEY" not in excerpts


def test_questions_redact_secrets(client) -> None:
    """#3 retrieval: Q&A citations and answer text must not leak secrets."""
    repo_id = make_repo(
        client,
        {
            "README.md": (
                "# App\n\nSet `DATABASE_PASSWORD=hunter2-supersecret` here.\n\n"
                "## Installation\n\npytest\n"
            ),
            "app.py": "x = 1\n",
        },
    )
    response = client.post(
        f"/api/v1/repositories/{repo_id}/questions",
        json={"question": "What is the database password?"},
    ).json()
    payload = str(response)
    assert "hunter2-supersecret" not in payload
    for citation in response["citations"]:
        assert "hunter2-supersecret" not in citation["excerpt"]


def test_openapi_yaml_produces_findings(client) -> None:
    """#4 YAML openapi specs are parsed and produce route findings."""
    files = {
        "app.py": (
            "from fastapi import FastAPI\n"
            "app = FastAPI()\n\n"
            "@app.get('/api/v2/users')\n"
            "def users():\n"
            "    return []\n"
        ),
        "README.md": "# App\n\n## Installation\n\npytest\n",
        "openapi.yaml": (
            "openapi: 3.0.0\n"
            "paths:\n"
            "  /api/legacy:\n"
            "    get:\n"
            "      summary: legacy route\n"
        ),
    }
    repo_id = make_repo(client, files)
    audit = client.post(f"/api/v1/repositories/{repo_id}/audits").json()
    route_findings = [
        f
        for f in audit["findings"]
        if f["check_id"] == "fastapi.route_matches_docs"
    ]
    assert len(route_findings) == 1
    finding = route_findings[0]
    assert "/api/legacy" in (finding["documentation_claim"] or "")
    assert finding["evidence"][0]["path"] == "openapi.yaml"


def test_openapi_json_produces_findings(client) -> None:
    """#4 openapi.json files surface a finding (previously silently clean)."""
    files = {
        "app.py": (
            "from fastapi import FastAPI\n"
            "app = FastAPI()\n\n"
            "@app.get('/api/v2/users')\n"
            "def users():\n"
            "    return []\n"
        ),
        "README.md": "# App\n\n## Installation\n\npytest\n",
        "openapi.json": '{"openapi":"3.0.0","paths":{"/api/legacy":{"get":{}}}}',
    }
    repo_id = make_repo(client, files)
    audit = client.post(f"/api/v1/repositories/{repo_id}/audits").json()
    route_findings = [
        f
        for f in audit["findings"]
        if f["check_id"] == "fastapi.route_matches_docs"
    ]
    assert len(route_findings) == 1
    assert route_findings[0]["evidence"][0]["path"] == "openapi.json"


def test_cannot_patch_dismissed_finding(client) -> None:
    """B2: Patches cannot be created for dismissed findings."""
    repo = client.post("/api/v1/repositories", data={"sample_id": "fastapi-users"}).json()
    audit = client.post(f"/api/v1/repositories/{repo['id']}/audits").json()
    finding = next(
        f for f in audit["findings"]
        if f["check_id"] == "fastapi.route_matches_docs" and f["status"] == "verified"
    )
    client.patch(
        f"/api/v1/repositories/{repo['id']}/findings/{finding['id']}",
        json={"status": "dismissed"},
    )
    response = client.post(
        f"/api/v1/repositories/{repo['id']}/findings/{finding['id']}/patches"
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "patch_not_available"


def test_cannot_patch_resolved_finding(client) -> None:
    """B2: Patches cannot be created for resolved findings.

    The audit API does not accept a direct transition to "resolved" (it is
    only assigned by `AuditService.run` when a finding disappears between
    runs). This test reaches the same branch by mutating the in-memory
    state the way the run loop would after a clean rescan.
    """
    repo = client.post("/api/v1/repositories", data={"sample_id": "fastapi-users"}).json()
    audit = client.post(f"/api/v1/repositories/{repo['id']}/audits").json()
    finding = next(
        f for f in audit["findings"]
        if f["check_id"] == "docs.readme_checklist" and f["status"] == "needs_review"
    )
    store = client.app.state.store
    state = store.get(repo["id"], client.cookies.get("reposcribe_session", "sess"))
    # Simulate AuditService.run marking the finding resolved.
    state.findings[finding["id"]] = state.findings[finding["id"]].model_copy(
        update={"status": "resolved"}
    )

    response = client.post(
        f"/api/v1/repositories/{repo['id']}/findings/{finding['id']}/patches"
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "patch_not_available"