"""Finding construction: stable IDs, bounded evidence, honest status."""

from __future__ import annotations

import hashlib
import time
from dataclasses import dataclass, field
from pathlib import Path

from app.analyzers.common import DocFile, RepoIndex, excerpt, read_text
from app.core.security import redact
from app.schemas.models import EvidenceRef, Finding, FindingStatus, Severity

MAX_EXCERPT_CHARS = 4000
# Upper bound per check. Without it a repository with thousands of broken links
# produces an audit response large enough to exhaust memory on both sides.
MAX_FINDINGS_PER_CHECK = 100


@dataclass
class AnalyzerResult:
    check_id: str
    findings: list[Finding] = field(default_factory=list)
    skipped: list[tuple[str, str]] = field(default_factory=list)
    limitations: list[str] = field(default_factory=list)
    # False when the analyzer stopped early (the audit time budget expired), so
    # the audit must not treat missing findings as resolved defects.
    complete: bool = True


def deadline_expired(deadline: float | None) -> bool:
    return deadline is not None and time.monotonic() >= deadline


def cap_findings(result: AnalyzerResult, limit: int = MAX_FINDINGS_PER_CHECK) -> AnalyzerResult:
    """Keep the response bounded and say so, instead of silently truncating."""
    total = len(result.findings)
    if total > limit:
        result.findings = result.findings[:limit]
        result.limitations.append(
            f"Only the first {limit} of {total} findings are shown for this check; "
            "fix those and run the audit again to see the rest."
        )
    return result


def finding_id(check_id: str, primary_path: str, subject_key: str) -> str:
    """Stable across runs: identity is check + path + subject, not line number."""
    digest = hashlib.sha256(f"{check_id}\x1f{primary_path}\x1f{subject_key}".encode()).hexdigest()
    return f"fnd_{digest[:12]}"


def doc_evidence(doc: DocFile, start_line: int, end_line: int | None = None) -> EvidenceRef:
    body = excerpt(doc.lines, start_line, end_line)
    return EvidenceRef(
        path=doc.path,
        start_line=start_line,
        end_line=min(len(doc.lines), end_line or start_line),
        excerpt=redact(body)[:MAX_EXCERPT_CHARS],
        role="documentation",
    )


def file_evidence(
    root: Path,
    path: str,
    start_line: int,
    end_line: int | None = None,
    role: str = "source",
    text: str | None = None,
) -> EvidenceRef:
    body = text if text is not None else (read_text(root / path) or "")
    lines = body.splitlines()
    resolved_end = min(len(lines), end_line or start_line)
    return EvidenceRef(
        path=path,
        start_line=start_line,
        end_line=resolved_end,
        excerpt=redact(excerpt(lines, start_line, resolved_end))[:MAX_EXCERPT_CHARS],
        role=role,  # type: ignore[arg-type]
    )


def make_finding(
    *,
    check_id: str,
    subject_key: str,
    title: str,
    summary: str,
    status: FindingStatus,
    severity: Severity,
    confidence_note: str,
    evidence: list[EvidenceRef],
    documentation_claim: str | None = None,
    observed_fact: str | None = None,
    limitations: list[str] | None = None,
    suggested_fix: str | None = None,
) -> Finding:
    primary = evidence[0].path if evidence else ""
    affected = sorted({item.path for item in evidence if item.path})
    return Finding(
        id=finding_id(check_id, primary, subject_key),
        check_id=check_id,
        subject_key=subject_key,
        title=title,
        summary=summary,
        status=status,
        severity=severity,
        confidence_note=confidence_note,
        documentation_claim=documentation_claim,
        observed_fact=observed_fact,
        evidence=evidence,
        limitations=limitations or [],
        suggested_fix=suggested_fix,
        affected_paths=affected,
    )


def index_skips(index: RepoIndex) -> list[tuple[str, str]]:
    return list(index.skipped)
