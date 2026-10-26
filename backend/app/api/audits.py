"""Audit endpoints (SPEC 20.1)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Request

from app.api.deps import repo_or_404
from app.core.errors import AppError
from app.schemas.models import AuditRequest, AuditRun
from app.services.audit_service import AuditService

router = APIRouter(prefix="/repositories/{repository_id}/audits", tags=["audits"])
SERVICE = AuditService()


@router.post("", response_model=AuditRun)
def run_audit(
    request: Request,
    repository_id: str,
    payload: AuditRequest | None = None,
) -> AuditRun:
    state = repo_or_404(request, repository_id)
    check_ids = payload.check_ids if payload else None
    return SERVICE.run(state, check_ids)


@router.get("/{audit_id}", response_model=AuditRun)
def get_audit(request: Request, repository_id: str, audit_id: str) -> AuditRun:
    state = repo_or_404(request, repository_id)
    audit = state.audits.get(audit_id)
    if audit is None:
        raise AppError("audit_not_found", "Audit not found in this repository.", 404)
    return audit
