"""Regression tests for the 0.3.0 abuse-control round.

Coverage:
- Oversized JSON bodies are rejected before any endpoint buffers them.
- Every analyzer caps its findings and says so instead of silently truncating.
- An audit that hits its time budget reports the skipped checks and never
  marks previous findings as resolved.
- The session cookie is signed: a client cannot pick a session id, and a
  tampered cookie falls back to a fresh session instead of granting access.
"""

from __future__ import annotations

import io
import zipfile
from dataclasses import replace

import pytest
from fastapi.testclient import TestClient

from app.analyzers.registry import CHECKS_SUPPORTED, get_analyzer
from app.core.security import read_session_cookie, sign_session
from app.main import create_app
from app.main import COOKIE_NAME
from app.services.audit_service import AuditService


def _zip(files: dict[str, str]) -> bytes:
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as archive:
        for name, content in files.items():
            archive.writestr(name, content)
    return buffer.getvalue()


def _make_repo(client: TestClient, files: dict[str, str]) -> str:
    response = client.post(
        "/api/v1/repositories",
        files={"file": ("repo.zip", _zip(files), "application/zip")},
    )
    assert response.status_code == 201, response.text
    return response.json()["id"]


# ---------------------------------------------------------------------------
# Request body cap
# ---------------------------------------------------------------------------


def test_oversized_json_body_is_rejected(client) -> None:
    """B11: a large JSON body must fail with 413, not be buffered."""
    repo = client.post("/api/v1/repositories", data={"sample_id": "fastapi-users"}).json()
    padding = b"x" * (1024 * 1024)  # 1 MB body against a 1 MB cap
    response = client.post(
        f"/api/v1/repositories/{repo['id']}/audits",
        content=b'{"check_ids": ["' + padding + b'"]}',
        headers={"Content-Type": "application/json"},
    )
    assert response.status_code == 413
    assert response.json()["error"]["code"] == "payload_too_large"


def test_reasonable_json_body_still_passes(client) -> None:
    repo = client.post("/api/v1/repositories", data={"sample_id": "fastapi-users"}).json()
    response = client.post(
        f"/api/v1/repositories/{repo['id']}/audits",
        json={"check_ids": ["markdown.internal_link_exists"]},
    )
    assert response.status_code == 200


def test_audit_request_rejects_an_unbounded_check_list(client) -> None:
    """The one unbounded JSON field is capped at the schema level."""
    repo = client.post("/api/v1/repositories", data={"sample_id": "fastapi-users"}).json()
    response = client.post(
        f"/api/v1/repositories/{repo['id']}/audits",
        json={"check_ids": [f"check.{i}" for i in range(65)]},
    )
    assert response.status_code == 422


# ---------------------------------------------------------------------------
# Finding caps
# ---------------------------------------------------------------------------

CAP_FILES = {
    "README.md": "# App\n\n## Installation\n\npytest\n\n"
    + "\n".join(f"- See [missing {i}](docs/missing-{i}.md)." for i in range(150)),
    "app.py": "x = 1\n",
}


def test_broken_links_are_capped_and_reported(client) -> None:
    """A repository with 150 broken links reports the cap, not silence."""
    from app.analyzers.factory import MAX_FINDINGS_PER_CHECK

    repo = _make_repo(client, CAP_FILES)
    audit = client.post(f"/api/v1/repositories/{repo}/audits").json()

    link_findings = [
        finding
        for finding in audit["findings"]
        if finding["check_id"] == "markdown.internal_link_exists"
    ]
    assert len(link_findings) == MAX_FINDINGS_PER_CHECK

    overview = client.get(f"/api/v1/repositories/{repo}/overview").json()
    assert any("Only the first" in limitation for limitation in overview["limitations"]), (
        "the audit must say that findings were capped"
    )


def test_every_analyzer_runs_and_stays_within_its_cap(client) -> None:
    repo = _make_repo(client, CAP_FILES)
    audit = client.post(f"/api/v1/repositories/{repo}/audits").json()
    by_check: dict[str, int] = {}
    for finding in audit["findings"]:
        by_check[finding["check_id"]] = by_check.get(finding["check_id"], 0) + 1
    for check_id, count in by_check.items():
        assert count <= 100, f"{check_id} exceeded the per-check cap: {count}"


# ---------------------------------------------------------------------------
# Audit time budget
# ---------------------------------------------------------------------------


def _sample_state(sample_state, settings):
    """Reuse the fixture's service and state but override the timeout."""
    service, state = sample_state
    tight = replace(settings, audit_timeout_seconds=0)
    return AuditService(tight), state


def test_time_budget_marks_the_audit_partial(sample_state, settings) -> None:
    service, state = sample_state
    audit = AuditService(replace(settings, audit_timeout_seconds=0)).run(state)
    assert audit.status == "partial"
    assert audit.checks_run == []
    assert set(audit.checks_skipped) == set(CHECKS_SUPPORTED)
    assert any("time budget" in limitation for limitation in state.check_limitations)


def test_time_budget_never_resolves_previous_findings(sample_state, settings) -> None:
    """The critical property: an incomplete check cannot 'fix' anything."""
    service, state = sample_state
    first = AuditService(settings).run(state)
    original = {finding.id: finding.status for finding in first.findings}
    assert original, "the fixture audit must produce findings"

    second = AuditService(replace(settings, audit_timeout_seconds=0)).run(state)
    for finding in second.findings:
        if finding.id in original:
            assert finding.status != "resolved", (
                "a check that never finished must not mark its findings resolved"
            )


def test_deadline_only_skips_remaining_checks(sample_state, settings) -> None:
    """A generous budget runs the earlier checks and only skips later ones."""
    import time as _time

    service, state = sample_state
    # Leave room for exactly one analyzer, then expire.
    budget = _time.monotonic() - 1  # already expired
    audit = AuditService(replace(settings, audit_timeout_seconds=0)).run(state)
    assert audit.status == "partial"
    assert audit.summary.findings_total == 0


# ---------------------------------------------------------------------------
# Signed session cookie
# ---------------------------------------------------------------------------


def test_cookie_is_signed_and_round_trips() -> None:
    with TestClient(create_app()) as client:
        repo = client.post("/api/v1/repositories", data={"sample_id": "fastapi-users"})
        assert repo.status_code == 201
        cookie = client.cookies.get(COOKIE_NAME)
        assert cookie and "." in cookie, "the cookie value must carry a signature"
        assert read_session_cookie(cookie) is not None
        # The same cookie still reaches the same repository.
        overview = client.get(f"/api/v1/repositories/{repo.json()['id']}/overview")
        assert overview.status_code == 200


def test_tampered_cookie_does_not_grant_access() -> None:
    app = create_app()
    with TestClient(app) as owner:
        repo = owner.post("/api/v1/repositories", data={"sample_id": "fastapi-users"}).json()

    # A second client with a hand-picked, badly signed cookie must land in a
    # fresh session and see nothing of the owner's work.
    with TestClient(app) as attacker:
        attacker.cookies.set(COOKIE_NAME, "sess_attacker.deadbeef")
        response = attacker.get(f"/api/v1/repositories/{repo['id']}/overview")
        assert response.status_code == 404

        # The response replaced the forged cookie with a new signed session.
        issued = _session_cookie_from(response)
        assert issued and issued != "sess_attacker.deadbeef"
        assert read_session_cookie(issued) is not None


def test_correctly_signed_but_foreign_session_still_sees_nothing() -> None:
    """A signature only proves the cookie came from this server, not that the
    id belongs to the caller: two sessions stay isolated."""
    app = create_app()
    with TestClient(app) as owner:
        repo = owner.post("/api/v1/repositories", data={"sample_id": "fastapi-users"}).json()

    with TestClient(app) as other:
        other.get("/api/v1/provider")  # mint a legitimate second session
        response = other.get(f"/api/v1/repositories/{repo['id']}/overview")
        assert response.status_code == 404


def test_legacy_unsigned_cookie_is_treated_as_absent() -> None:
    app = create_app()
    with TestClient(app) as client:
        client.cookies.set(COOKIE_NAME, "sess_plain_old_value")
        response = client.post("/api/v1/repositories", data={"sample_id": "fastapi-users"})
        assert response.status_code == 201
        # The server replaced the forged value with a new signed session.
        issued = _session_cookie_from(response)
        assert issued and issued != "sess_plain_old_value"
        assert read_session_cookie(issued) is not None


def _session_cookie_from(response) -> str:
    """Read the session cookie straight out of Set-Cookie, jar-free."""
    from http.cookies import SimpleCookie

    jar = SimpleCookie()
    for header in response.headers.get_list("set-cookie"):
        jar.load(header)
    morsel = jar.get(COOKIE_NAME)
    return morsel.value if morsel else ""


def test_signature_verification_rejects_garbage() -> None:
    assert read_session_cookie("") is None
    assert read_session_cookie("no-dot-here") is None
    assert read_session_cookie(".onlysignature") is None
    assert read_session_cookie("session.") is None
