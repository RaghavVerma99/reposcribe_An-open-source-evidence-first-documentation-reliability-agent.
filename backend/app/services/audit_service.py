"""Audit orchestration: run analyzers, normalize findings, keep stable history."""

from __future__ import annotations

import time
import uuid
from collections.abc import Iterable

from app.analyzers.factory import AnalyzerResult, deadline_expired, make_finding
from app.analyzers.registry import CHECKS_SUPPORTED, get_analyzer
from app.core.errors import AppError
from app.core.settings import Settings, get_settings
from app.schemas.models import AuditRun, AuditSummary, Finding
from app.services.store import RepositoryState, utcnow

CHECK_LABELS = {
    "markdown.internal_link_exists": "internal links",
    "docs.file_reference_exists": "file references",
    "fastapi.route_matches_docs": "API routes",
    "config.env_var_documented": "configuration",
    "python.public_symbol_referenced": "symbols",
    "docs.readme_checklist": "README checklist",
}


class AuditService:
    def __init__(self, settings: Settings | None = None) -> None:
        self.settings = settings or get_settings()

    def run(self, state: RepositoryState, check_ids: list[str] | None = None) -> AuditRun:
        if not state.audit_lock.acquire(blocking=False):
            raise AppError(
                "audit_in_progress",
                "An audit is already running for this repository.",
                409,
            )
        try:
            return self._run(state, check_ids)
        finally:
            state.audit_lock.release()

    def _run(self, state: RepositoryState, check_ids: list[str] | None = None) -> AuditRun:
        if state.index is None:
            raise AppError("internal_error", "Repository has not been indexed.", 500)

        selected = check_ids or list(CHECKS_SUPPORTED)
        unknown = [check for check in selected if check not in CHECKS_SUPPORTED]
        if unknown:
            raise AppError("invalid_request", f"Unsupported check id(s): {', '.join(unknown)}.")

        previous = dict(state.findings)
        findings: dict[str, Finding] = {}
        checks_run: list[str] = []
        checks_skipped: list[str] = []
        limitations: list[str] = []
        deadline = time.monotonic() + self.settings.audit_timeout_seconds

        for check_id in selected:
            analyzer = get_analyzer(check_id)
            if analyzer is None:
                checks_skipped.append(check_id)
                continue
            if deadline_expired(deadline):
                checks_skipped.append(check_id)
                limitations.append(
                    f"{check_id} was skipped because the audit time budget of "
                    f"{self.settings.audit_timeout_seconds} seconds expired."
                )
                continue
            try:
                result: AnalyzerResult = analyzer.analyze(state.index, deadline=deadline)
            except Exception as exc:  # a broken analyzer must not sink the audit
                checks_skipped.append(check_id)
                limitations.append(f"{check_id} could not run: {type(exc).__name__}.")
                continue
            if not result.complete:
                # The check stopped at the time budget. Counting it as "run"
                # would let the resolution logic below dismiss findings the
                # check never reached, so it is recorded as skipped.
                checks_skipped.append(check_id)
                limitations.append(
                    f"{check_id} stopped at the audit time budget; its findings are incomplete."
                )
            else:
                checks_run.append(check_id)
            limitations.extend(result.limitations)
            limitations.extend(result.limitations)
            for path, reason in result.skipped:
                limitations.append(f"{path} skipped: {reason}")
            for finding in result.findings:
                if finding.id in state.dismissed:
                    finding = finding.model_copy(update={"status": "dismissed"})
                findings[finding.id] = finding

        # A finding can only be marked resolved by a check that actually ran to
        # completion. During a partial audit (an analyzer failed or stopped at
        # the time budget), findings from checks outside that scope keep their
        # previous status instead of being reported as fixed.
        rerun_checks = set(checks_run)
        for finding_id, previous_finding in previous.items():
            if finding_id in findings:
                continue
            if previous_finding.check_id not in rerun_checks:
                findings[finding_id] = previous_finding
                continue
            if previous_finding.status in ("resolved", "dismissed"):
                findings[finding_id] = previous_finding
                continue
            findings[finding_id] = previous_finding.model_copy(update={"status": "resolved"})

        summary = AuditSummary(
            files_inspected=state.index.scanned_files,
            findings_total=len(findings),
            findings_active_total=_active_total(findings.values()),
            verified=sum(1 for f in findings.values() if f.status == "verified"),
            needs_review=sum(1 for f in findings.values() if f.status == "needs_review"),
            insufficient_evidence=sum(1 for f in findings.values() if f.status == "insufficient_evidence"),
            resolved=sum(1 for f in findings.values() if f.status == "resolved"),
            dismissed=sum(1 for f in findings.values() if f.status == "dismissed"),
        )
        run = AuditRun(
            id=f"aud_{uuid.uuid4().hex[:12]}",
            repository_id=state.id,
            status="partial" if checks_skipped else "completed",
            checks_run=checks_run,
            checks_skipped=checks_skipped,
            summary=summary,
            findings=sorted(findings.values(), key=_sort_key),
            created_at=utcnow(),
        )
        state.audits[run.id] = run
        state.findings = findings
        deduped = list(dict.fromkeys(limitations))
        state.check_limitations = deduped[:200]
        return run

    def get_finding(self, state: RepositoryState, finding_id: str) -> Finding:
        finding = state.findings.get(finding_id)
        if finding is None:
            raise AppError("finding_not_found", "Finding not found in this repository.", 404)
        return finding

    def set_status(self, state: RepositoryState, finding_id: str, status: str) -> Finding:
        finding = self.get_finding(state, finding_id)
        if status not in ("dismissed", "verified", "needs_review", "insufficient_evidence"):
            raise AppError("invalid_request", "Unsupported status transition.")
        if status == "dismissed":
            state.dismissed.add(finding_id)
            # Remember what the reviewer dismissed. Reopening restores this
            # instead of downgrading a verified defect to needs_review.
            previous = (
                finding.status
                if finding.status != "dismissed"
                else finding.status_before_dismissal
            )
            update = {
                "status": "dismissed",
                "status_before_dismissal": previous,
                "revision": finding.revision + 1,
            }
        else:
            state.dismissed.discard(finding_id)
            update = {
                "status": status,
                "status_before_dismissal": None,
                "revision": finding.revision + 1,
            }
        updated = finding.model_copy(update=update)
        state.findings[finding_id] = updated
        for audit in state.audits.values():
            audit.findings = [updated if item.id == finding_id else item for item in audit.findings]
            audit.summary = _recount(audit.findings, audit.summary.files_inspected)
        return updated


def _sort_key(finding: Finding):
    severity_order = {"high": 0, "medium": 1, "low": 2, "info": 3}
    return (severity_order.get(finding.severity, 9), finding.check_id, finding.id)


def _active_total(findings: Iterable[Finding]) -> int:
    """Findings that still need attention, excluding resolved and dismissed."""
    return sum(1 for finding in findings if finding.status not in ("resolved", "dismissed"))


def _recount(findings: list[Finding], files_inspected: int) -> AuditSummary:
    return AuditSummary(
        files_inspected=files_inspected,
        findings_total=len(findings),
        findings_active_total=_active_total(findings),
        verified=sum(1 for f in findings if f.status == "verified"),
        needs_review=sum(1 for f in findings if f.status == "needs_review"),
        insufficient_evidence=sum(1 for f in findings if f.status == "insufficient_evidence"),
        resolved=sum(1 for f in findings if f.status == "resolved"),
        dismissed=sum(1 for f in findings if f.status == "dismissed"),
    )


__all__ = ["AuditService", "CHECK_LABELS", "make_finding"]
