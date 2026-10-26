"""Unit tests for the static parsers (T-03..T-07)."""

from __future__ import annotations

from app.analyzers.common import build_index, extract_doc_routes, parse_doc, parse_python, slugify_heading
from tests.conftest import write_repo

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


def test_syntax_error_is_recorded_not_raised() -> None:
    py_file = parse_python("app/broken.py", "def oops(:\n")
    assert py_file.parse_error is not None
    assert py_file.routes == []


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