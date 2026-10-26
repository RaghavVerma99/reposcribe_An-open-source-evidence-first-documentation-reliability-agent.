"""Request/response models. These are the public contract (SPEC 9, 20)."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

FindingStatus = Literal[
    "verified", "needs_review", "insufficient_evidence", "resolved", "dismissed"
]
Severity = Literal["high", "medium", "low", "info"]
EvidenceRole = Literal["documentation", "source", "config", "test", "other"]
ValidationOutcome = Literal["passed", "failed", "not_run", "inconclusive"]
RepoStatus = Literal["created", "indexing", "ready", "failed"]
ProviderMode = Literal["live", "local_demo", "unavailable"]


class EvidenceRef(BaseModel):
    path: str
    start_line: int | None = None
    end_line: int | None = None
    excerpt: str
    role: EvidenceRole


class Finding(BaseModel):
    id: str
    check_id: str
    subject_key: str = Field(
        description="Stable identifier of the underlying defect: check + path + subject. "
        "Two findings with the same subject_key describe the same drift."
    )
    title: str
    summary: str
    status: FindingStatus
    severity: Severity
    confidence_note: str
    documentation_claim: str | None = None
    observed_fact: str | None = None
    evidence: list[EvidenceRef] = Field(default_factory=list)
    limitations: list[str] = Field(default_factory=list)
    suggested_fix: str | None = None
    affected_paths: list[str] = Field(default_factory=list)


class ManifestEntry(BaseModel):
    path: str
    size: int
    language: str
    is_doc: bool
    secret: bool = False
    sha256: str


class Repository(BaseModel):
    id: str
    name: str
    source: Literal["sample", "upload"]
    status: RepoStatus
    created_at: datetime
    files_indexed: int = 0
    docs_found: int = 0
    findings_total: int = 0
    last_audit_at: datetime | None = None


class RouteInfo(BaseModel):
    method: str
    path: str
    handler: str
    file: str
    start_line: int
    end_line: int
    prefix_resolved: bool = True


class RepositoryOverview(BaseModel):
    repository_id: str
    name: str
    source: Literal["sample", "upload"]
    status: RepoStatus
    file_count: int
    docs_found: int
    doc_files: list[str]
    languages: dict[str, int]
    routes: list[RouteInfo]
    checks_supported: list[str]
    findings_by_status: dict[str, int]
    last_audit_at: datetime | None = None
    indexed_at: datetime | None = None
    limitations: list[str] = Field(default_factory=list)


class AuditSummary(BaseModel):
    files_inspected: int
    findings_total: int
    verified: int = 0
    needs_review: int = 0
    insufficient_evidence: int = 0
    resolved: int = 0
    dismissed: int = 0


class AuditRun(BaseModel):
    id: str
    repository_id: str
    status: Literal["completed", "partial", "failed"]
    checks_run: list[str]
    checks_skipped: list[str]
    summary: AuditSummary
    findings: list[Finding]
    created_at: datetime


class PatchDraft(BaseModel):
    id: str
    repository_id: str
    finding_id: str
    target_path: str
    diff: str
    rationale: str
    limitations: list[str] = Field(default_factory=list)
    mode: str = "local_demo"
    original_content: str
    proposed_content: str


class ValidationStep(BaseModel):
    id: str
    label: str
    outcome: ValidationOutcome
    detail: str = ""


class ValidationResult(BaseModel):
    patch_id: str
    outcome: ValidationOutcome
    steps: list[ValidationStep]
    checked_at: datetime


class Citation(BaseModel):
    path: str
    start_line: int | None = None
    end_line: int | None = None
    excerpt: str = ""


class GroundedAnswer(BaseModel):
    answer: str
    citations: list[Citation] = Field(default_factory=list)
    limitations: list[str] = Field(default_factory=list)
    follow_up_suggestions: list[str] = Field(default_factory=list)
    mode: str = "local_demo"


class ProviderStatus(BaseModel):
    mode: ProviderMode
    provider: str
    model: str
    state: Literal["connected", "not_configured", "error"]
    message: str
    verified_contract: bool = False


class ApiErrorDetail(BaseModel):
    code: str
    message: str
    request_id: str = ""
    retryable: bool = False


class ErrorResponse(BaseModel):
    error: ApiErrorDetail


class HealthResponse(BaseModel):
    status: Literal["ok", "degraded"]
    app: str
    version: str
    workspace_writable: bool
    provider: ProviderStatus


class AuditRequest(BaseModel):
    check_ids: list[str] | None = None


class QuestionRequest(BaseModel):
    question: str = Field(min_length=1, max_length=500)


class FindingStatusUpdate(BaseModel):
    status: Literal["dismissed", "verified", "needs_review", "insufficient_evidence"]


class FindingPage(BaseModel):
    items: list[Finding]
    total: int
    next_cursor: str | None = None


class SearchHit(BaseModel):
    path: str
    start_line: int
    end_line: int
    excerpt: str
    role: str


class SearchResponse(BaseModel):
    hits: list[SearchHit]
    truncated: bool = False


class PatchDetail(BaseModel):
    patch: PatchDraft
    validation: ValidationResult | None = None
