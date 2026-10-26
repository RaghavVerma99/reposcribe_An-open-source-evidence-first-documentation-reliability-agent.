"""Safe export of a patch or revised Markdown file."""

from __future__ import annotations

from pathlib import Path

from app.schemas.models import PatchDraft


def patch_filename(patch: PatchDraft) -> str:
    stem = Path(patch.target_path).name
    return f"{stem}.patch"


def markdown_filename(patch: PatchDraft) -> str:
    return Path(patch.target_path).name


def export_patch(patch: PatchDraft) -> tuple[str, str, str]:
    return patch_filename(patch), patch.diff, "text/x-patch"


def export_markdown(patch: PatchDraft) -> tuple[str, str, str]:
    return markdown_filename(patch), patch.proposed_content, "text/markdown"
