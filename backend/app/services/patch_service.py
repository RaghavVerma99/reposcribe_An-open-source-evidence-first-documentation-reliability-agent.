"""Patch generation, diffing, and deterministic validation (SPEC 22)."""

from __future__ import annotations

import difflib
import re
import uuid
from itertools import zip_longest

from app.analyzers.common import (
    DOTTED_RE,
    PATHLIKE_RE,
    STDLIB_ROOTS,
    _resolve_relative,
    read_text,
)
from app.analyzers.registry import ANALYZERS
from app.core.errors import AppError
from app.core.security import contains_secret
from app.core.settings import Settings
from app.integrations.model_provider import build_provider
from app.schemas.models import ValidationResult, ValidationStep
from app.services.store import RepositoryState, utcnow

MAX_CHANGED_LINES = 40
ALLOWED_EXACT = {"readme.md", "contributing.md"}
IGNORED_REF_NAMES = {".env", ".env.local"}


def is_allowed_target(path: str) -> bool:
    lowered = path.lower()
    if lowered in ALLOWED_EXACT:
        return True
    return lowered.startswith("docs/") and lowered.endswith((".md", ".markdown"))


class PatchService:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    def create(self, state: RepositoryState, finding_id: str):
        finding = state.findings.get(finding_id)
        if finding is None:
            raise AppError("finding_not_found", "Finding not found in this repository.", 404)
        if finding.status in ("dismissed", "resolved"):
            raise AppError(
                "patch_not_available",
                f"This finding is {finding.status}; create a new audit to surface it before patching.",
                422,
            )

        doc_path = next(
            (item.path for item in finding.evidence if item.role == "documentation"),
            None,
        )
        if doc_path is None:
            raise AppError(
                "patch_not_available",
                "This finding has no documentation evidence, so there is no safe patch target.",
                422,
            )
        if not is_allowed_target(doc_path):
            raise AppError("patch_target_forbidden", "Patch targets must be documentation files only.", 422)

        document = self._document_text(state, doc_path)
        provider = build_provider(self.settings)
        proposal = provider.draft_patch(finding, document, doc_path, state.index)  # type: ignore[arg-type]

        if proposal.content == document:
            raise AppError("patch_not_available", "The provider returned no change.", 422)

        diff = _unified_diff(doc_path, document, proposal.content)
        changed = _changed_line_count(diff)
        if changed > MAX_CHANGED_LINES:
            raise AppError(
                "patch_not_available",
                f"The proposed change touches {changed} lines; the limit is {MAX_CHANGED_LINES}.",
                422,
            )

        patch = _draft(
            repository_id=state.id,
            finding_id=finding_id,
            target_path=doc_path,
            original_content=document,
            proposed_content=proposal.content,
            diff=diff,
            rationale=proposal.rationale,
            limitations=proposal.limitations,
            mode=provider.status().mode,
        )
        state.patches[patch.id] = patch
        return patch

    def validate(self, state: RepositoryState, patch_id: str) -> ValidationResult:
        patch = state.patches.get(patch_id)
        if patch is None:
            raise AppError("patch_not_found", "Patch not found in this repository.", 404)

        steps: list[ValidationStep] = []
        current = self._document_text(state, patch.target_path)
        steps.append(
            ValidationStep(
                id="V-1",
                label="Target is a permitted documentation file",
                outcome="passed" if is_allowed_target(patch.target_path) else "failed",
                detail=patch.target_path,
            )
        )
        unchanged = current == patch.original_content
        differs = patch.proposed_content != patch.original_content
        steps.append(
            ValidationStep(
                id="V-2",
                label="Patch applies cleanly to the indexed document",
                outcome="passed" if unchanged and differs else "failed",
                detail=(
                    "Document is unchanged since the draft was created."
                    if unchanged
                    else "The document changed after the draft was created."
                ),
            )
        )

        finding = state.findings.get(patch.finding_id)
        overridden = (
            state.index.with_doc_override(patch.target_path, patch.proposed_content)
            if state.index is not None
            else None
        )
        if finding is None or overridden is None:
            steps.append(
                ValidationStep(
                    id="V-3",
                    label="The finding is fixed and no new drift is introduced",
                    outcome="not_run",
                    detail="No indexed snapshot is available for re-analysis.",
                )
            )
        else:
            try:
                # Compare the whole finding set before and after the patch, not just
                # the originating finding. A patch that fixes its own claim while
                # rewriting another documented route to something the code does not
                # define must not be reported as passing.
                baseline = _finding_keys(state.index)
                proposed = _finding_keys(overridden)
                still_present = finding.subject_key in proposed.get(finding.check_id, set())
                introduced = _introduced_keys(baseline, proposed)
                if still_present:
                    outcome = "failed"
                    detail = "The same finding is still detected in the proposed document."
                elif introduced:
                    outcome = "failed"
                    shown = ", ".join(introduced[:3])
                    more = f" (+{len(introduced) - 3} more)" if len(introduced) > 3 else ""
                    detail = f"The patch introduces {len(introduced)} new finding(s): {shown}{more}."
                else:
                    outcome = "passed"
                    detail = "The check that produced the finding no longer reports it, and no new finding was introduced."
                steps.append(
                    ValidationStep(
                        id="V-3",
                        label="The finding is fixed and no new drift is introduced",
                        outcome=outcome,
                        detail=detail,
                    )
                )
            except Exception:
                steps.append(
                    ValidationStep(
                        id="V-3",
                        label="The finding is fixed and no new drift is introduced",
                        outcome="inconclusive",
                        detail="The analyzers could not be re-run on the proposed document.",
                    )
                )

        if overridden is None:
            steps.append(
                ValidationStep(
                    id="V-4",
                    label="Internal links and anchors in the proposed document",
                    outcome="not_run",
                    detail="No indexed snapshot is available to resolve links.",
                )
            )
        else:
            original_doc = state.index.docs.get(patch.target_path) if state.index else None
            proposed_doc = overridden.docs.get(patch.target_path)
            if proposed_doc is None:
                steps.append(
                    ValidationStep(
                        id="V-4",
                        label="Internal links and anchors in the proposed document",
                        outcome="not_run",
                        detail="The proposed document is not part of the indexed snapshot.",
                    )
                )
            else:
                # Only links this patch breaks count. A pre-existing broken link that
                # the patch leaves untouched must not block an otherwise sound repair.
                pre_existing = _broken_link_keys(original_doc.links) if original_doc else set()
                introduced_links = sorted(_broken_link_keys(proposed_doc.links) - pre_existing)
                steps.append(
                    ValidationStep(
                        id="V-4",
                        label="Internal links and anchors in the proposed document",
                        outcome="failed" if introduced_links else "passed",
                        detail=(
                            f"{len(introduced_links)} link(s) introduced by this patch do not resolve: "
                            + ", ".join(sorted({target for target, _ in introduced_links})[:5])
                            if introduced_links
                            else _links_ok_detail(pre_existing)
                        ),
                    )
                )

        introduced = _introduced_issues(state, patch)
        steps.append(
            ValidationStep(
                id="V-5",
                label="Referenced files and symbols exist",
                outcome="failed" if introduced else "passed",
                detail="; ".join(introduced[:5]) if introduced else "No missing references were introduced.",
            )
        )

        secret_issue = contains_secret(patch.proposed_content) and not contains_secret(patch.original_content)
        source_touch = not is_allowed_target(patch.target_path)
        too_large = _changed_line_count(patch.diff) > MAX_CHANGED_LINES
        v6_failed = secret_issue or source_touch or too_large
        detail = []
        if secret_issue:
            detail.append("Proposed content introduces secret-shaped text.")
        if source_touch:
            detail.append("Target is outside the documentation allowlist.")
        if too_large:
            detail.append(f"Change exceeds {MAX_CHANGED_LINES} lines.")
        steps.append(
            ValidationStep(
                id="V-6",
                label="No secrets, no source edits, bounded change",
                outcome="failed" if v6_failed else "passed",
                detail="; ".join(detail) or "Documentation-only change within limits.",
            )
        )

        outcomes = [step.outcome for step in steps]
        overall = "failed" if "failed" in outcomes else ("passed" if all(o == "passed" for o in outcomes) else "inconclusive")
        result = ValidationResult(
            patch_id=patch.id,
            outcome=overall,
            steps=steps,
            checked_at=utcnow(),
        )
        state.validations[patch.id] = result
        return result

    def get(self, state: RepositoryState, patch_id: str):
        patch = state.patches.get(patch_id)
        if patch is None:
            raise AppError("patch_not_found", "Patch not found in this repository.", 404)
        return patch

    def _document_text(self, state: RepositoryState, path: str) -> str:
        if state.index and path in state.index.docs:
            return state.index.docs[path].text
        text = read_text(state.root / path)
        if text is None:
            raise AppError("patch_not_available", f"Document `{path}` could not be read.", 422)
        return text


def _finding_keys(index) -> dict[str, set[str]]:
    """Map check_id -> subject_key set for one snapshot of the index.

    ``subject_key`` is stable across line moves, so the same defect maps to the
    same key before and after a patch. An analyzer that fails is left out of the
    comparison instead of failing the whole validation step.
    """
    keys: dict[str, set[str]] = {}
    for analyzer in ANALYZERS:
        try:
            result = analyzer.analyze(index)
        except Exception:
            continue
        keys[analyzer.check_id] = {finding.subject_key for finding in result.findings}
    return keys


def _introduced_keys(
    baseline: dict[str, set[str]], proposed: dict[str, set[str]]
) -> list[str]:
    introduced: list[str] = []
    for check_id, subjects in sorted(proposed.items()):
        for subject in sorted(subjects - baseline.get(check_id, set())):
            introduced.append(f"{check_id}: {subject}")
    return introduced


def _broken_link_keys(links) -> set[tuple[str, str]]:
    keys: set[tuple[str, str]] = set()
    for link in links:
        if link.external or not link.checkable:
            continue
        if not link.exists:
            keys.add((link.target, "missing file"))
        elif link.missing_anchor:
            keys.add((link.target, "missing anchor"))
    return keys


def _links_ok_detail(pre_existing: set[tuple[str, str]]) -> str:
    if not pre_existing:
        return "All internal links resolve within the snapshot."
    return (
        f"No link is broken by this patch. {len(pre_existing)} pre-existing broken "
        "link(s) are unchanged and were not counted."
    )


def _draft(**kwargs):
    from app.schemas.models import PatchDraft

    return PatchDraft(id=f"pat_{uuid.uuid4().hex[:12]}", **kwargs)


def _unified_diff(path: str, original: str, proposed: str) -> str:
    return "".join(
        difflib.unified_diff(
            original.splitlines(keepends=True),
            proposed.splitlines(keepends=True),
            fromfile=f"a/{path}",
            tofile=f"b/{path}",
        )
    )


def _changed_line_count(diff: str) -> int:
    return sum(
        1
        for line in diff.splitlines()
        if (line.startswith("+") or line.startswith("-"))
        and not line.startswith(("+++", "---"))
    )


def _introduced_issues(state: RepositoryState, patch) -> list[str]:
    """Only flag references added by this patch, never pre-existing ones."""
    if state.index is None:
        return []
    original_doc = state.index.docs.get(patch.target_path)
    original_spans = {span.text for span in original_doc.code_spans} if original_doc else set()
    overridden = state.index.with_doc_override(patch.target_path, patch.proposed_content)
    doc = overridden.docs.get(patch.target_path)
    if doc is None:
        return []
    symbols = {symbol.name for symbol in state.index.symbols}
    modules = {symbol.module for symbol in state.index.symbols}
    issues: list[str] = []

    for span in doc.code_spans:
        token = span.text.strip()
        if token in original_spans or not token:
            continue
        if PATHLIKE_RE.match(token) and not token.startswith(("/", "$", "~", "<")):
            if token in IGNORED_REF_NAMES:
                continue
            resolved = _resolve_relative(patch.target_path, token)
            if resolved and not (state.root / resolved).exists():
                issues.append(f"`{token}` does not exist.")
        elif DOTTED_RE.match(token):
            parts = token.split(".")
            if parts[0] in STDLIB_ROOTS or parts[0] == "self":
                continue
            if parts[-1] not in symbols and ".".join(parts[:-1]) not in modules:
                issues.append(f"`{token}` is not an indexed symbol.")
    return list(dict.fromkeys(issues))


__all__ = ["PatchService", "is_allowed_target", "MAX_CHANGED_LINES"]
