"""API contract tests (SPEC 20)."""

from __future__ import annotations

from tests.conftest import make_zip


def _create_sample(client) -> str:
    response = client.post("/api/v1/repositories", data={"sample_id": "fastapi-users"})
    assert response.status_code == 201, response.text
    return response.json()["id"]


def test_health_reports_provider_and_workspace(client) -> None:
    response = client.get("/api/v1/health")
    body = response.json()
    assert response.status_code == 200
    assert body["status"] == "ok"
    assert body["workspace_writable"] is True
    assert body["provider"]["mode"] == "local_demo"
    assert body["provider"]["verified_contract"] is False
    assert response.headers["X-Request-ID"]


def test_provider_endpoint_is_labelled(client) -> None:
    body = client.get("/api/v1/provider").json()
    assert body["mode"] == "local_demo"
    assert "demo" in body["message"].lower()


def test_create_requires_input(client) -> None:
    response = client.post("/api/v1/repositories")
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "invalid_request"


def test_unknown_sample_is_rejected(client) -> None:
    response = client.post("/api/v1/repositories", data={"sample_id": "nope"})
    assert response.status_code == 400


def test_unknown_repository_returns_404(client) -> None:
    response = client.get("/api/v1/repositories/repo_missing")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "repository_not_found"


def test_overview_is_derived_from_real_files(client) -> None:
    repository_id = _create_sample(client)
    overview = client.get(f"/api/v1/repositories/{repository_id}/overview").json()
    assert overview["file_count"] >= 6
    assert "README.md" in overview["doc_files"]
    assert overview["languages"]["Python"] >= 3
    paths = {(route["method"], route["path"]) for route in overview["routes"]}
    assert ("GET", "/api/v2/users") in paths
    assert len(overview["checks_supported"]) == 6


def test_audit_reports_checks_and_summary(client) -> None:
    repository_id = _create_sample(client)
    audit = client.post(f"/api/v1/repositories/{repository_id}/audits").json()
    assert audit["status"] == "completed"
    assert len(audit["checks_run"]) == 6
    assert audit["summary"]["findings_total"] == len(audit["findings"])
    assert audit["summary"]["verified"] >= 5


def test_audit_rejects_unknown_check_ids(client) -> None:
    repository_id = _create_sample(client)
    response = client.post(
        f"/api/v1/repositories/{repository_id}/audits", json={"check_ids": ["nope.nope"]}
    )
    assert response.status_code == 400


def test_audit_can_be_scoped_to_checks(client) -> None:
    repository_id = _create_sample(client)
    audit = client.post(
        f"/api/v1/repositories/{repository_id}/audits",
        json={"check_ids": ["markdown.internal_link_exists"]},
    ).json()
    assert audit["checks_run"] == ["markdown.internal_link_exists"]
    assert {finding["check_id"] for finding in audit["findings"]} == {"markdown.internal_link_exists"}


def test_audit_is_retrievable_by_id(client) -> None:
    repository_id = _create_sample(client)
    audit = client.post(f"/api/v1/repositories/{repository_id}/audits").json()
    fetched = client.get(f"/api/v1/repositories/{repository_id}/audits/{audit['id']}")
    assert fetched.status_code == 200
    assert fetched.json()["id"] == audit["id"]


def test_findings_support_filters_and_pagination(client) -> None:
    repository_id = _create_sample(client)
    client.post(f"/api/v1/repositories/{repository_id}/audits")

    page = client.get(
        f"/api/v1/repositories/{repository_id}/findings", params={"limit": 2}
    ).json()
    assert len(page["items"]) == 2
    assert page["next_cursor"] == "2"
    assert page["total"] > 2

    verified = client.get(
        f"/api/v1/repositories/{repository_id}/findings", params={"status": "verified"}
    ).json()
    assert verified["items"]
    assert all(item["status"] == "verified" for item in verified["items"])

    searched = client.get(
        f"/api/v1/repositories/{repository_id}/findings", params={"q": "route"}
    ).json()
    assert all("route" in (item["title"] + item["summary"]).lower() for item in searched["items"])


def test_finding_can_be_dismissed(client) -> None:
    repository_id = _create_sample(client)
    audit = client.post(f"/api/v1/repositories/{repository_id}/audits").json()
    finding_id = audit["findings"][0]["id"]

    updated = client.patch(
        f"/api/v1/repositories/{repository_id}/findings/{finding_id}",
        json={"status": "dismissed"},
    )
    assert updated.status_code == 200
    assert updated.json()["status"] == "dismissed"

    unknown = client.patch(
        f"/api/v1/repositories/{repository_id}/findings/fnd_missing",
        json={"status": "dismissed"},
    )
    assert unknown.status_code == 404


def test_reopen_restores_the_status_held_before_dismissal(client) -> None:
    repository_id = _create_sample(client)
    audit = client.post(f"/api/v1/repositories/{repository_id}/audits").json()
    finding = next(item for item in audit["findings"] if item["status"] == "verified")

    dismissed = client.patch(
        f"/api/v1/repositories/{repository_id}/findings/{finding['id']}",
        json={"status": "dismissed"},
    ).json()
    assert dismissed["status"] == "dismissed"
    assert dismissed["status_before_dismissal"] == "verified"

    reopened = client.patch(
        f"/api/v1/repositories/{repository_id}/findings/{finding['id']}",
        json={"status": dismissed["status_before_dismissal"]},
    ).json()
    assert reopened["status"] == "verified"
    assert reopened["status_before_dismissal"] is None


def test_patch_enforces_the_current_etag(client) -> None:
    repository_id = _create_sample(client)
    audit = client.post(f"/api/v1/repositories/{repository_id}/audits").json()
    finding = audit["findings"][0]

    detail = client.get(f"/api/v1/repositories/{repository_id}/findings/{finding['id']}")
    assert detail.status_code == 200
    etag = detail.headers["etag"]
    assert etag == f'"{finding["id"]}.{finding["revision"]}"'

    stale = client.patch(
        f"/api/v1/repositories/{repository_id}/findings/{finding['id']}",
        json={"status": "dismissed"},
        headers={"If-Match": f'"{finding["id"]}.{finding["revision"] + 1}"'},
    )
    assert stale.status_code == 412
    assert stale.json()["error"]["code"] == "precondition_failed"

    updated = client.patch(
        f"/api/v1/repositories/{repository_id}/findings/{finding['id']}",
        json={"status": "dismissed"},
        headers={"If-Match": etag},
    )
    assert updated.status_code == 200
    assert updated.json()["revision"] == finding["revision"] + 1
    assert updated.headers["etag"] != etag


def test_active_findings_exclude_resolved_and_dismissed(client) -> None:
    repository_id = _create_sample(client)
    audit = client.post(f"/api/v1/repositories/{repository_id}/audits").json()
    total = len(audit["findings"])
    assert audit["summary"]["findings_active_total"] == total

    finding_id = audit["findings"][0]["id"]
    client.patch(
        f"/api/v1/repositories/{repository_id}/findings/{finding_id}",
        json={"status": "dismissed"},
    )

    overview = client.get(f"/api/v1/repositories/{repository_id}/overview").json()
    assert overview["findings_active_total"] == total - 1

    repository = client.get(f"/api/v1/repositories/{repository_id}").json()
    assert repository["findings_total"] == total
    assert repository["findings_active_total"] == total - 1


def test_finding_status_payload_is_validated(client) -> None:
    repository_id = _create_sample(client)
    audit = client.post(f"/api/v1/repositories/{repository_id}/audits").json()
    finding_id = audit["findings"][0]["id"]
    response = client.patch(
        f"/api/v1/repositories/{repository_id}/findings/{finding_id}",
        json={"status": "banana"},
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "schema_validation_failed"


def test_patch_flow_over_http(client) -> None:
    repository_id = _create_sample(client)
    audit = client.post(f"/api/v1/repositories/{repository_id}/audits").json()
    finding = next(
        item
        for item in audit["findings"]
        if item["check_id"] == "fastapi.route_matches_docs" and item["status"] == "verified"
    )

    created = client.post(
        f"/api/v1/repositories/{repository_id}/findings/{finding['id']}/patches"
    )
    assert created.status_code == 201, created.text
    patch = created.json()
    assert patch["target_path"].endswith(".md")
    assert "/api/v2/users" in patch["diff"]

    detail = client.get(f"/api/v1/repositories/{repository_id}/patches/{patch['id']}").json()
    assert detail["validation"] is None

    validation = client.post(
        f"/api/v1/repositories/{repository_id}/patches/{patch['id']}/validate"
    ).json()
    assert validation["outcome"] == "passed"
    assert [step["id"] for step in validation["steps"]] == ["V-1", "V-2", "V-3", "V-4", "V-5", "V-6"]

    downloaded = client.get(
        f"/api/v1/repositories/{repository_id}/patches/{patch['id']}/download",
        params={"format": "markdown"},
    )
    assert downloaded.status_code == 200
    assert "/api/v2/users" in downloaded.text
    assert "attachment" in downloaded.headers["content-disposition"]

    missing = client.get(f"/api/v1/repositories/{repository_id}/patches/pat_missing")
    assert missing.status_code == 404


def test_questions_are_grounded_in_evidence(client) -> None:
    repository_id = _create_sample(client)
    response = client.post(
        f"/api/v1/repositories/{repository_id}/questions",
        json={"question": "Which endpoints does this service expose?"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["mode"] == "local_demo"
    assert body["citations"]
    assert body["citations"][0]["path"]
    assert "language model" in " ".join(body["limitations"]).lower()


def test_question_without_evidence_says_so(client) -> None:
    repository_id = _create_sample(client)
    body = client.post(
        f"/api/v1/repositories/{repository_id}/questions",
        json={"question": "zzzqqq unrelated nonsense token"},
    ).json()
    assert body["citations"] == []
    assert "couldn't find" in body["answer"].lower() or "could not" in body["answer"].lower()


def test_search_is_bounded(client) -> None:
    repository_id = _create_sample(client)
    body = client.get(
        f"/api/v1/repositories/{repository_id}/search", params={"q": "users", "limit": 100}
    ).json()
    assert len(body["hits"]) <= 20
    for hit in body["hits"]:
        assert hit["start_line"] >= 1
        assert hit["end_line"] >= hit["start_line"]


def test_delete_then_gone(client) -> None:
    repository_id = _create_sample(client)
    assert client.delete(f"/api/v1/repositories/{repository_id}").status_code == 204
    assert client.get(f"/api/v1/repositories/{repository_id}").status_code == 404


def test_upload_zip_round_trip(client) -> None:
    payload = make_zip(
        {
            "project/README.md": "# Uploaded\n\n## Installation\n\npytest\n",
            "project/app/main.py": "from fastapi import FastAPI\napp = FastAPI()\n",
        }
    )
    created = client.post(
        "/api/v1/repositories", files={"file": ("project.zip", payload, "application/zip")}
    )
    assert created.status_code == 201
    body = created.json()
    assert body["source"] == "upload"
    overview = client.get(f"/api/v1/repositories/{body['id']}/overview").json()
    assert "README.md" in overview["doc_files"]


def test_reindex_is_idempotent(client) -> None:
    repository_id = _create_sample(client)
    first = client.post(f"/api/v1/repositories/{repository_id}/index").json()
    second = client.post(f"/api/v1/repositories/{repository_id}/index").json()
    assert first["files_indexed"] == second["files_indexed"]
    assert second["status"] == "ready"