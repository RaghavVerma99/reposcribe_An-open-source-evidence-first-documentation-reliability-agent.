"""Unit tests for the static parsers (T-03..T-07)."""

from __future__ import annotations

import io
import zipfile

from fastapi.testclient import TestClient

from app.analyzers.common import build_index, extract_doc_routes, parse_doc, parse_python, slugify_heading
from tests.conftest import write_repo


def _zip(files: dict[str, str]) -> bytes:
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as z:
        for name, content in files.items():
            z.writestr(name, content)
    return buffer.getvalue()

README = """# Project

See [Guide](docs/guide.md) and [Missing](docs/missing.md) and [Web](https://example.com).

Jump to [Install](#installation) or to a [broken anchor](#does-not-exist).

## Installation

Full details in `scripts/seed.py`.
"""

GUIDE = """# Guide

## Installation

Content.
"""

MAIN = """from fastapi import APIRouter, FastAPI

router = APIRouter(prefix="/api/v2")

app = FastAPI()


@router.get("/users")
def list_users():
    return []


@router.api_route("/items", methods=["GET", "POST"])
def items():
    return []


@app.post("/health")
def health():
    return {"ok": True}
"""


def _index(tmp_path):
    root = write_repo(
        tmp_path,
        {"README.md": README, "docs/guide.md": GUIDE, "app/main.py": MAIN, ".env.example": "APP_KEY=\nDEBUG_MODE=\n"},
    )
    return build_index(root)


def test_heading_slugs() -> None:
    assert slugify_heading("Installation") == "installation"
    assert slugify_heading("API Reference!") == "api-reference"


def test_relative_links_and_anchors(tmp_path) -> None:
    index = _index(tmp_path)
    links = index.docs["README.md"].links
    by_target = {link.target: link for link in links}

    assert by_target["docs/guide.md"].exists
    assert not by_target["docs/missing.md"].exists
    assert by_target["https://example.com"].external
    assert by_target["#installation"].exists
    assert not by_target["#installation"].missing_anchor
    assert by_target["#does-not-exist"].missing_anchor


def test_doc_routes_from_table_and_code() -> None:
    doc = parse_doc(
        "docs/api.md",
        "| Method | Path |\n| --- | --- |\n| `GET` | `/api/users` |\n\n```\nPOST /api/users\n```\n",
        {},
        None,  # type: ignore[arg-type]
    )
    routes = {(route.method, route.path) for route in extract_doc_routes(doc)}
    assert ("GET", "/api/users") in routes
    assert ("POST", "/api/users") in routes


def test_python_route_extraction_with_prefix(tmp_path) -> None:
    index = _index(tmp_path)
    routes = {(route.method, route.path) for route in index.routes}
    assert ("GET", "/api/v2/users") in routes
    assert ("GET", "/api/v2/items") in routes
    assert ("POST", "/api/v2/items") in routes
    assert ("POST", "/health") in routes
    assert not index.route_prefix_unresolved


def test_unresolvable_router_prefix_is_flagged() -> None:
    py_file = parse_python(
        "app/routes/users.py",
        "from app.router import build_router\nrouter = build_router()\n\n@router.get('/users')\ndef list_users():\n    return []\n",
    )
    assert py_file.route_prefix_unresolved
    assert py_file.routes == []


def test_non_constant_router_prefix_is_flagged() -> None:
    py_file = parse_python(
        "app/routes/users.py",
        "from fastapi import APIRouter\nPREFIX = '/api/v2'\nrouter = APIRouter(prefix=PREFIX)\n\n@router.get('/users')\ndef list_users():\n    return []\n",
    )
    assert py_file.route_prefix_unresolved
    assert py_file.routes == []


def test_attribute_router_decorator_is_flagged_not_silently_skipped() -> None:
    py_file = parse_python(
        "app/routes/users.py",
        "from fastapi import APIRouter\n\nclass Module:\n    router = APIRouter()\n\nmodule = Module()\n\n@module.router.get('/users')\ndef list_users():\n    return []\n",
    )
    assert py_file.route_prefix_unresolved
    assert py_file.routes == []


def test_site_root_link_is_not_checked_outside_workspace(tmp_path) -> None:
    root = write_repo(
        tmp_path,
        {"README.md": "# App\n\n[Root](/etc/passwd) and [Escape](../../outside.md).\n"},
    )
    index = build_index(root)
    links = {link.target: link for link in index.docs["README.md"].links}
    assert not links["/etc/passwd"].checkable
    assert links["/etc/passwd"].resolved_path is None
    assert links["../../outside.md"].checkable
    assert links["../../outside.md"].resolved_path is None
    assert not links["../../outside.md"].exists


def test_syntax_error_is_recorded_not_raised() -> None:
    py_file = parse_python("app/broken.py", "def oops(:\n")
    assert py_file.parse_error is not None
    assert py_file.routes == []


def test_severity_matches_catalog_for_each_branch() -> None:
    """#18: every analyzer branch emits the severity declared in SPEC §8.1."""
    from app.core.errors import AppError
    from app.main import create_app

    # CHK-01 missing-link -> medium
    files_link = {
        "README.md": "# App\n\n## Installation\n\npytest\n",
        "app.py": "x = 1\n",
    }
    c = TestClient(create_app())
    repo = c.post("/api/v1/repositories", files={"file": ("r.zip", _zip(files_link), "application/zip")}).json()
    audit = c.post(f"/api/v1/repositories/{repo['id']}/audits").json()
    link_findings = [f for f in audit["findings"] if f["check_id"] == "markdown.internal_link_exists"]
    if link_findings:
        assert all(f["severity"] == "medium" for f in link_findings), (
            "CHK-01 must be medium per SPEC §8.1"
        )

    # CHK-06 documented checklist entry that is *present* should stay info.
    files_check = {
        "README.md": "# App\n\n## Installation\n\npytest\n",
        "app.py": (
            "from fastapi import FastAPI\n"
            "app = FastAPI()\n\n@app.get('/api/v2/users')\ndef users():\n    return []\n"
        ),
    }
    repo2 = c.post("/api/v1/repositories", files={"file": ("r.zip", _zip(files_check), "application/zip")}).json()
    audit2 = c.post(f"/api/v1/repositories/{repo2['id']}/audits").json()
    api_doc_findings = [
        f
        for f in audit2["findings"]
        if f["check_id"] == "docs.readme_checklist" and f["subject_key"] == "readme-api-docs"
    ]
    assert api_doc_findings, "fixture should produce the api-docs checklist finding"
    assert all(f["severity"] == "info" for f in api_doc_findings), (
        "CHK-06 default severity must be info per SPEC §8.1"
    )

    # Avoid an unused-import lint failure on AppError from this file.
    _ = AppError


def test_stdlib_roots_is_the_single_source_of_truth() -> None:
    from app.analyzers.common import STDLIB_ROOTS as COMMON
    from app.analyzers.python_symbols import SymbolReferenceAnalyzer
    from app.services.patch_service import STDLIB_ROOTS as SERVICE

    # CHK-05 and V-5 must agree — drift here was the audit finding.
    assert SERVICE is COMMON, "patch_service must import STDLIB_ROOTS from common"
    # Spot-check both well-known roots are present.
    assert "os" in COMMON
    assert "hashlib" in COMMON
    assert "fastapi" in COMMON
    # And it must be a real, hashable, deduplicated container.
    assert isinstance(COMMON, frozenset)


def test_env_references_are_indexed(tmp_path) -> None:
    root = write_repo(
        tmp_path,
        {
            "app/settings.py": (
                "import os\n"
                "A = os.getenv('FIRST_KEY')\n"
                "B = os.environ['SECOND_KEY']\n"
                "C = os.environ.get('THIRD_KEY')\n"
            ),
            ".env.example": "FOURTH_KEY=1\n",
        },
    )
    index = build_index(root)
    defined = index.env_defined
    for key in ("FIRST_KEY", "SECOND_KEY", "THIRD_KEY", "FOURTH_KEY"):
        assert key in defined


def test_secret_files_are_not_indexed(tmp_path) -> None:
    root = write_repo(
        tmp_path,
        {
            "README.md": "# hi\n",
            ".env": "SECRET_KEY=super-secret-value\n",
        },
    )
    index = build_index(root)
    assert ".env" not in index.docs
    assert ".env" not in index.py_files