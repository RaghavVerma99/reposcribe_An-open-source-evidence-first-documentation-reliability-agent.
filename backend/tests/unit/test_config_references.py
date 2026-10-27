"""CHK-04 regression tests: single-word variables must not be silently skipped."""

from __future__ import annotations

from pathlib import Path

from app.analyzers.common import build_index
from app.analyzers.config_references import ConfigReferenceAnalyzer
from tests.conftest import write_repo


def _subjects(root: Path) -> set[str]:
    index = build_index(root)
    result = ConfigReferenceAnalyzer().analyze(index)
    return {finding.subject_key for finding in result.findings}


def test_single_word_variables_in_a_configuration_section_are_reported(tmp_path) -> None:
    root = write_repo(
        tmp_path,
        {
            ".env.example": "DATABASE_URL=sqlite:///./app.db\n",
            "README.md": (
                "# Service\n\n"
                "## Configuration\n\n"
                "| Variable | Purpose |\n"
                "| --- | --- |\n"
                "| `PORT` | HTTP port |\n"
                "| `DEBUG` | Verbose logging |\n"
                "| `DATABASE_URL` | Database |\n"
            ),
        },
    )

    subjects = _subjects(root)

    assert "README.md:PORT" in subjects
    assert "README.md:DEBUG" in subjects
    # A variable that is actually defined must never be reported.
    assert not any("DATABASE_URL" in subject for subject in subjects)


def test_http_methods_and_media_types_are_not_variables(tmp_path) -> None:
    root = write_repo(
        tmp_path,
        {
            ".env.example": "DATABASE_URL=sqlite:///./app.db\n",
            "README.md": (
                "# Service\n\n"
                "## API\n\n"
                "| Method | Endpoint |\n"
                "| --- | --- |\n"
                "| `GET` | `/users` |\n"
                "| `POST` | `/users` |\n\n"
                "Responses are `JSON`.\n\n"
                "## Environment\n\n"
                "Set `PORT` before starting.\n"
            ),
        },
    )

    assert _subjects(root) == {"README.md:PORT"}


def test_single_word_assignment_is_reported_without_section_context(tmp_path) -> None:
    root = write_repo(
        tmp_path,
        {
            ".env.example": "DATABASE_URL=sqlite:///./app.db\n",
            "README.md": "# Service\n\n```\nDEBUG=true\n```\n",
        },
    )

    assert "README.md:DEBUG" in _subjects(root)


def test_multi_word_variable_is_reported_outside_a_configuration_section(tmp_path) -> None:
    root = write_repo(
        tmp_path,
        {
            ".env.example": "DATABASE_URL=sqlite:///./app.db\n",
            "README.md": "# Service\n\n## Notes\n\nSet `REDIS_URL` to cache responses.\n",
        },
    )

    assert "README.md:REDIS_URL" in _subjects(root)
