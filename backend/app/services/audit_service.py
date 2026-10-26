"""Audit orchestration: run analyzers, normalize findings, keep stable history."""

from __future__ import annotations

import uuid

from app.analyzers.factory import AnalyzerResult, make_finding
from app.analyzers.registry import CHECKS_SUPPORTED, get_analyzer
from app.core.errors import AppError
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
    def run(self, state: RepositoryState, check_ids: list[str] | None = None) -> AuditRun:
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

        for check_id in selected:
            analyzer = get_analyzer(check_id)
            if analyzer is None:
                checks_skipped.append(check_id)
                continue
            try:
                result: AnalyzerResult = analyzer.analyze(state.index)
            except Exception as exc:  # a broken analyzer must not sink the audit
                checks_skipped.append(check_id)
                limitations.append(f"{check_id} could not run: {type(exc).__name__}.")
                continue
            checks_run.append(check_id)
            limitations.extend(result.limitations)
            for path, reason in result.skipped:
                limitations.append(f"{path} skipped: {reason}")
            for finding in result.findings:
                if finding.id in state.dismissed:
                    finding = finding.model_copy(update={"status": "dismissed"})
                findings[finding.id] = finding

        for finding_id, previous_finding in previous.items():
            if finding_id in findings:
                continue
            if previous_finding.status in ("resolved", "dismissed"):
                findings[finding_id] = previous_finding
                continue
            findings[finding_id] = previous_finding.model_copy(update={"status": "resolved"})

        summary = AuditSummary(
            files_inspected=state.index.scanned_files,
            findings_total=len(findings),
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
        state.limitations = deduped[:200]
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
        else:
            state.dismissed.discard(finding_id)
        updated = finding.model_copy(update={"status": status})
        state.findings[finding_id] = updated
        for audit in state.audits.values():
            audit.findings = [updated if item.id == finding_id else item for item in audit.findings]
            audit.summary = _recount(audit.findings, audit.summary.files_inspected)
        return updated


def _sort_key(finding: Finding):
    severity_order = {"high": 0, "medium": 1, "low": 2, "info": 3}
    return (severity_order.get(finding.severity, 9), finding.check_id, finding.id)


def _recount(findings: list[Finding], files_inspected: int) -> AuditSummary:
    return AuditSummary(
        files_inspected=files_inspected,
        findings_total=len(findings),
        verified=sum(1 for f in findings if f.status == "verified"),
        needs_review=sum(1 for f in findings if f.status == "needs_review"),
        insufficient_evidence=sum(1 for f in findings if f.status == "insufficient_evidence"),
        resolved=sum(1 for f in findings if f.status == "resolved"),
        dismissed=sum(1 for f in findings if f.status == "dismissed"),
    )


__all__ = ["AuditService", "CHECK_LABELS", "make_finding"]
