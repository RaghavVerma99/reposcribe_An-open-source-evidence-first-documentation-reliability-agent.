"""Regression tests for the correctness and hardening fixes in this pass.

Coverage:
- Cross-module router prefixes are resolved (routes mounted from another
  module are compared at their real path, not their local path).
- A router mounted from an unlocatable module is reported as unresolved
  instead of being compared as if it were bare.
- The rate limit cannot be bypassed by rotating the session cookie, and idle
  buckets are swept.
- Citations without line numbers are verified against retrieved evidence.
- Download filenames are safe for a Content-Disposition header.
- The workspace probe is cached for a short window, not forever.
"""

from __future__ import annotations

import io
import zipfile

import pytest
from fastapi.testclient import TestClient

from app.analyzers.common import build_index
from app.core.errors import AppError
from app.main import create_app
from app.services.question_service import _verify_citations
from app.integrations.model_provider import Chunk
from app.schemas.models import Citation, GroundedAnswer


def _zip(files: dict[str, str]) -> bytes:
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as archive:
        for name, content in files.items():
            archive.writestr(name, content)
    return buffer.getvalue()


# --------------------------------------------------------------------------
# Cross-module router prefixes
# --------------------------------------------------------------------------

CROSS_MODULE_FILES = {
    "README.md": (
        "# App\n\n## Installation\n\npytest\n\n"
        "| Method | Path |\n| --- | --- |\n| `GET` | `/api/v1/users` |\n"
    ),
    "app/main.py": (
        "from fastapi import FastAPI\n"
        "from app.routes import router\n\n"
        "app = FastAPI()\n"
        "app.include_router(router, prefix='/api')\n"
    ),
    "app/routes.py": (
        "from fastapi import APIRouter\n\n"
        "router = APIRouter(prefix='/v1')\n\n"
        "@router.get('/users')\n"
        "def list_users():\n"
        "    return []\n"
    ),
}


def test_cross_module_prefix_is_applied(tmp_path) -> None:
    """`include_router(router, prefix='/api')` must move the mounted routes.

    Before this fix the route was compared as `/v1/users`, so a correctly
    documented `/api/v1/users` was reported as missing.
    """
    for name, content in CROSS_MODULE_FILES.items():
        target = tmp_path / name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding="utf-8")

    index = build_index(tmp_path)
    assert ("GET", "/api/v1/users") in {(r.method, r.path) for r in index.routes}
    assert not index.route_prefix_unresolved


def test_cross_module_prefix_does_not_poison_unrelated_routes(tmp_path) -> None:
    """Importing a router must not mark the whole repository as unresolved.

    Before this fix, any file that merely included a router was flagged, which
    downgraded every route finding in the repository to `insufficient_evidence`.
    """
    for name, content in CROSS_MODULE_FILES.items():
        target = tmp_path / name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding="utf-8")

    index = build_index(tmp_path)
    assert index.route_prefix_unresolved is False
    assert all(route.prefix_resolved for route in index.routes)


def test_documented_cross_module_route_produces_no_finding(client) -> None:
    """End to end: a correct documented route must not be reported as drift."""
    repo = client.post(
        "/api/v1/repositories",
        files={"file": ("cross.zip", _zip(CROSS_MODULE_FILES), "application/zip")},
    ).json()
    audit = client.post(f"/api/v1/repositories/{repo['id']}/audits").json()
    route_findings = [
        finding
        for finding in audit["findings"]
        if finding["check_id"] == "fastapi.route_matches_docs"
    ]
    assert route_findings == [], route_findings


def test_unlocatable_mounted_router_is_unresolved(tmp_path) -> None:
    """A router mounted from a module that is not in the repository is unknown."""
    files = {
        "app/main.py": (
            "from fastapi import FastAPI\n"
            "from third_party import router\n\n"
            "app = FastAPI()\n"
            "app.include_router(router, prefix='/api')\n"
        ),
    }
    for name, content in files.items():
        target = tmp_path / name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding="utf-8")

    index = build_index(tmp_path)
    assert index.route_prefix_unresolved is True


def test_overview_reports_an_unresolved_router_prefix(client) -> None:
    """The overview must say when the route list is incomplete."""
    files = {
        "README.md": "# App\n\n## Installation\n\npytest\n",
        "app/main.py": (
            "from fastapi import FastAPI\n"
            "from third_party import router\n\n"
            "app = FastAPI()\n"
            "app.include_router(router, prefix='/api')\n"
        ),
    }
    repo = client.post(
        "/api/v1/repositories",
        files={"file": ("unresolved.zip", _zip(files), "application/zip")},
    ).json()
    overview = client.get(f"/api/v1/repositories/{repo['id']}/overview").json()
    assert overview["routes_prefix_unresolved"] is True

    # A repository with only resolvable routers reports a complete route list.
    clean = client.post("/api/v1/repositories", data={"sample_id": "fastapi-users"}).json()
    clean_overview = client.get(f"/api/v1/repositories/{clean['id']}/overview").json()
    assert clean_overview["routes_prefix_unresolved"] is False


def test_local_nested_router_prefix_is_combined(tmp_path) -> None:
    """`router.include_router(sub)` must add the parent router's prefix."""
    files = {
        "app/main.py": (
            "from fastapi import APIRouter\n\n"
            "router = APIRouter(prefix='/api')\n"
            "sub = APIRouter(prefix='/v1')\n\n"
            "router.include_router(sub)\n\n"
            "@sub.get('/users')\n"
            "def list_users():\n"
            "    return []\n"
        ),
    }
    for name, content in files.items():
        target = tmp_path / name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding="utf-8")

    index = build_index(tmp_path)
    assert ("GET", "/api/v1/users") in {(r.method, r.path) for r in index.routes}


# --------------------------------------------------------------------------
# Rate limiting
# --------------------------------------------------------------------------


def test_rate_limit_survives_cookie_rotation() -> None:
    """Rotating the unsigned session cookie must not reset the budget."""
    app = create_app()
    with TestClient(app) as client:
        statuses = []
        for _ in range(140):
            client.cookies.clear()
            statuses.append(client.get("/api/v1/repositories/repo_missing").status_code)
        assert 429 in statuses, "the rate limit was bypassed by rotating the cookie"
        # The limiter is keyed on the client address, so one bucket is tracked.
        assert len(app.state.rate) == 1


def test_rate_limit_buckets_are_swept() -> None:
    """Idle buckets must not accumulate forever."""
    from app.main import _sweep_rate_buckets

    buckets = {"a": __import__("collections").deque([1.0]), "b": __import__("collections").deque()}
    _sweep_rate_buckets(buckets, 2.0)
    assert "b" not in buckets
    assert "a" in buckets


def test_rate_limit_error_code_is_not_provider_specific(client) -> None:
    for _ in range(140):
        client.get("/api/v1/repositories/repo_missing")
    response = client.get("/api/v1/repositories/repo_missing")
    assert response.status_code == 429
    assert response.json()["error"]["code"] == "rate_limited"


# --------------------------------------------------------------------------
# Citation verification
# --------------------------------------------------------------------------


def test_citation_without_lines_is_verified_against_evidence() -> None:
    """A citation with no line range is accepted only if its path was retrieved."""
    chunks = [Chunk(path="README.md", start_line=10, end_line=20, text="evidence")]
    answer = GroundedAnswer(
        answer="text",
        citations=[Citation(path="README.md", start_line=None, end_line=None, excerpt="")],
    )
    verified = _verify_citations(answer, chunks)
    assert len(verified.citations) == 1
    assert verified.citations[0].start_line == 10
    assert verified.citations[0].end_line == 20


def test_citation_for_an_unretrieved_path_is_dropped() -> None:
    chunks = [Chunk(path="README.md", start_line=10, end_line=20, text="evidence")]
    answer = GroundedAnswer(
        answer="text",
        citations=[Citation(path="other.md", start_line=None, end_line=None, excerpt="")],
    )
    verified = _verify_citations(answer, chunks)
    assert verified.citations == []
    assert any("removed" in limitation for limitation in verified.limitations)


def test_citation_line_range_is_clamped_to_the_retrieved_excerpt() -> None:
    chunks = [Chunk(path="README.md", start_line=10, end_line=20, text="evidence")]
    answer = GroundedAnswer(
        answer="text",
        citations=[Citation(path="README.md", start_line=1, end_line=999, excerpt="")],
    )
    verified = _verify_citations(answer, chunks)
    assert verified.citations[0].start_line == 10
    assert verified.citations[0].end_line == 20


# --------------------------------------------------------------------------
# Export filenames
# --------------------------------------------------------------------------


@pytest.mark.parametrize(
    "target, expected",
    [
        ("docs/api.md", "api.md.patch"),
        ('docs/we"ird.md', "we_ird.md.patch"),
        ("docs/café.md", "caf_.md.patch"),
        ("docs/../../etc/passwd", "passwd.patch"),
    ],
)
def test_download_filename_is_header_safe(target: str, expected: str) -> None:
    from app.services.export_service import patch_filename, safe_filename
    from app.schemas.models import PatchDraft

    patch = PatchDraft(
        id="pat_x",
        repository_id="repo_x",
        finding_id="fnd_x",
        target_path=target,
        diff="",
        rationale="",
        original_content="",
        proposed_content="",
    )
    assert patch_filename(patch) == expected
    assert '"' not in safe_filename(target)


# --------------------------------------------------------------------------
# Health probe
# --------------------------------------------------------------------------


def test_workspace_probe_is_cached_but_not_for_the_process_lifetime(client) -> None:
    """The probe result is reused inside the TTL and re-checked afterwards."""
    from app.api import health as health_module

    health_module._probe_result = None  # type: ignore[attr-defined]
    health_module._probe_checked_at = 0.0  # type: ignore[attr-defined]

    client.get("/api/v1/health")
    first = health_module._probe_checked_at  # type: ignore[attr-defined]
    client.get("/api/v1/health")
    assert health_module._probe_checked_at == first  # type: ignore[attr-defined]

    # Past the TTL the workspace is probed again instead of trusting a stale
    # result forever.
    health_module._probe_checked_at = first - (health_module.PROBE_TTL_SECONDS + 1)  # type: ignore[attr-defined]
    client.get("/api/v1/health")
    assert health_module._probe_checked_at > first  # type: ignore[attr-defined]
    assert health_module._probe_result is True  # type: ignore[attr-defined]
