"""Safe export of a patch or revised Markdown file."""

from __future__ import annotations

import re
from pathlib import Path

from app.schemas.models import PatchDraft

# A download filename ends up in a Content-Disposition header, so it must not
# contain quotes, path separators, control characters, or non-ASCII bytes that
# a header cannot carry.
UNSAFE_FILENAME_RE = re.compile(r"[^A-Za-z0-9._-]+")
FALLBACK_NAME = "document"


def safe_filename(name: str, fallback: str = FALLBACK_NAME) -> str:
    """Reduce a repository path to a safe, ASCII download filename."""
    stem = Path(name).name
    cleaned = UNSAFE_FILENAME_RE.sub("_", stem).strip("._-")
    return cleaned[:80] or fallback


def patch_filename(patch: PatchDraft) -> str:
    return f"{safe_filename(patch.target_path)}.patch"


def markdown_filename(patch: PatchDraft) -> str:
    return safe_filename(patch.target_path, fallback="document.md")


def export_patch(patch: PatchDraft) -> tuple[str, str, str]:
    return patch_filename(patch), patch.diff, "text/x-patch"


def export_markdown(patch: PatchDraft) -> tuple[str, str, str]:
    return markdown_filename(patch), patch.proposed_content, "text/markdown"
