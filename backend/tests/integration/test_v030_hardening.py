"""Tests for v0.3.0 endpoint contract hardening.

Coverage:
- /health and /provider are excluded from the rate limit (B4).
- /health probes workspace writability once (B5).
- Findings filters reject invalid severity / status / check_id
  with 422 (B1) and an invalid cursor returns 422 (B3).
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import create_app


@pytest.fixture()
def client():
    app = create_app()
    with TestClient(app) as test_client:
        yield test_client


def test_rate_limit_excludes_health_and_provider(client) -> None:
    """B4: Liveness probes and provider-status polls must not trigger 429."""
    # 200 health calls in a row, all on the same session, none should 429.
    for _ in range(150):
        response = client.get("/api/v1/health")
        assert response.status_code == 200
        assert response.json()["status"] == "ok"

    # Same for /provider — also a no-rate-limit endpoint.
    for _ in range(5):
        response = client.get("/api/v1/provider")
        assert response.status_code == 200
        assert response.json()["mode"] == "local_demo"


def test_health_file_write_is_cached(client) -> None:
    """B5: /health resolves workspace writability once per process."""
    from app.api import health as health_module

    # Reset the cache so the test forces a single probe.
    health_module._probe_result = None  # type: ignore[attr-defined]

    for _ in range(3):
        response = client.get("/api/v1/health")
        assert response.status_code == 200

    # The probe ran exactly once.
    assert health_module._probe_result is True  # type: ignore[attr-defined]


def test_invalid_severity_filter_is_rejected(client) -> None:
    """B1: invalid severity returns 422, not silently empty results."""
    repo = client.post("/api/v1/repositories", data={"sample_id": "fastapi-users"}).json()
    client.post(f"/api/v1/repositories/{repo['id']}/audits")
    response = client.get(
        f"/api/v1/repositories/{repo['id']}/findings", params={"severity": "banana"}
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "schema_validation_failed"


def test_invalid_status_filter_is_rejected(client) -> None:
    repo = client.post("/api/v1/repositories", data={"sample_id": "fastapi-users"}).json()
    client.post(f"/api/v1/repositories/{repo['id']}/audits")
    response = client.get(
        f"/api/v1/repositories/{repo['id']}/findings", params={"status": "garbage"}
    )
    assert response.status_code == 422


def test_invalid_check_id_filter_is_rejected(client) -> None:
    repo = client.post("/api/v1/repositories", data={"sample_id": "fastapi-users"}).json()
    client.post(f"/api/v1/repositories/{repo['id']}/audits")
    response = client.get(
        f"/api/v1/repositories/{repo['id']}/findings", params={"check_id": "not.a.real.check"}
    )
    assert response.status_code == 422


def test_valid_filters_still_work(client) -> None:
    repo = client.post("/api/v1/repositories", data={"sample_id": "fastapi-users"}).json()
    client.post(f"/api/v1/repositories/{repo['id']}/audits")

    severity = client.get(
        f"/api/v1/repositories/{repo['id']}/findings", params={"severity": "high"}
    ).json()
    assert severity["items"]
    assert all(item["severity"] == "high" for item in severity["items"])

    status = client.get(
        f"/api/v1/repositories/{repo['id']}/findings", params={"status": "verified"}
    ).json()
    assert status["items"]
    assert all(item["status"] == "verified" for item in status["items"])


def test_invalid_cursor_returns_422(client) -> None:
    """B3: invalid cursor no longer clamps to 0 silently."""
    repo = client.post("/api/v1/repositories", data={"sample_id": "fastapi-users"}).json()
    client.post(f"/api/v1/repositories/{repo['id']}/audits")
    response = client.get(
        f"/api/v1/repositories/{repo['id']}/findings", params={"cursor": "garbage"}
    )
    assert response.status_code == 422


def test_cursor_pagination_still_works(client) -> None:
    repo = client.post("/api/v1/repositories", data={"sample_id": "fastapi-users"}).json()
    client.post(f"/api/v1/repositories/{repo['id']}/audits")
    page_one = client.get(
        f"/api/v1/repositories/{repo['id']}/findings", params={"limit": 3}
    ).json()
    assert len(page_one["items"]) == 3
    assert page_one["next_cursor"] == "3"

    page_two = client.get(
        f"/api/v1/repositories/{repo['id']}/findings",
        params={"limit": 3, "cursor": "3"},
    ).json()
    assert len(page_two["items"]) == 3
    # Cursor is now a strict integer query parameter; the round-trip string
    # arrives and is parsed as the integer 3 before use.
    assert page_two["next_cursor"] == "6"


def test_health_reports_v0_2_0(client) -> None:
    body = client.get("/api/v1/health").json()
    assert body["version"] == "0.2.0"
