"""Findings list, detail, and dismissal (SPEC 20.1)."""

from __future__ import annotations

from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Header, Query, Request, Response

from app.api.deps import repo_or_404
from app.analyzers.registry import CHECKS_SUPPORTED
from app.core.errors import AppError
from app.schemas.models import Finding, FindingPage, FindingStatusUpdate
from app.services.audit_service import AuditService

router = APIRouter(prefix="/repositories/{repository_id}/findings", tags=["findings"])
SERVICE = AuditService()
SEVERITY_ORDER = {"high": 0, "medium": 1, "low": 2, "info": 3}

FindingStatusParam = Literal[
    "verified", "needs_review", "insufficient_evidence", "resolved", "dismissed"
]
SeverityParam = Literal["high", "medium", "low", "info"]
CheckIdParam = Literal[tuple(CHECKS_SUPPORTED)]  # type: ignore[valid-type]


@router.get("", response_model=FindingPage)
def list_findings(
    request: Request,
    repository_id: str,
    status: FindingStatusParam | None = Query(default=None),
    severity: SeverityParam | None = Query(default=None),
    check_id: CheckIdParam | None = Query(default=None),
    q: Annotated[str | None, Query(max_length=200)] = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    cursor: Annotated[int | None, Query(ge=0)] = None,
) -> FindingPage:
    state = repo_or_404(request, repository_id)
    items = list(state.findings.values())
    if status:
        items = [item for item in items if item.status == status]
    if severity:
        items = [item for item in items if item.severity == severity]
    if check_id:
        items = [item for item in items if item.check_id == check_id]
    if q:
        needle = q.lower()
        items = [
            item
            for item in items
            if needle in item.title.lower()
            or needle in item.summary.lower()
            or any(needle in path.lower() for path in item.affected_paths)
        ]
    items.sort(key=lambda item: (SEVERITY_ORDER.get(item.severity, 9), item.check_id, item.id))

    total = len(items)
    offset = cursor if cursor is not None else 0
    page = items[offset : offset + limit]
    next_cursor = str(offset + limit) if offset + limit < total else None
    return FindingPage(items=page, total=total, next_cursor=next_cursor)


def _etag(finding: Finding) -> str:
    """A representation tag that changes whenever the status changes."""
    return f'"{finding.id}.{finding.revision}"'


@router.get("/{finding_id}", response_model=Finding)
def get_finding(
    request: Request,
    repository_id: str,
    finding_id: str,
    response: Response,
) -> Finding:
    state = repo_or_404(request, repository_id)
    finding = SERVICE.get_finding(state, finding_id)
    response.headers["ETag"] = _etag(finding)
    return finding


@router.patch("/{finding_id}", response_model=Finding)
def update_finding(
    request: Request,
    repository_id: str,
    finding_id: str,
    payload: FindingStatusUpdate,
    response: Response,
    if_match: Annotated[str | None, Header(alias="If-Match")] = None,
) -> Finding:
    state = repo_or_404(request, repository_id)
    current = SERVICE.get_finding(state, finding_id)
    # If-Match is optional for compatibility, but a supplied value must match
    # the revision the client last saw.
    if if_match is not None and if_match.strip() not in ("*", _etag(current)):
        raise AppError(
            "precondition_failed",
            "The finding changed since you loaded it. Reload and try again.",
            412,
        )
    updated = SERVICE.set_status(state, finding_id, payload.status)
    request.app.state.store.persist(state)
    response.headers["ETag"] = _etag(updated)
    return updated
