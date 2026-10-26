export type FindingStatus =
  | "verified"
  | "needs_review"
  | "insufficient_evidence"
  | "resolved"
  | "dismissed";

export type Severity = "high" | "medium" | "low" | "info";
export type EvidenceRole = "documentation" | "source" | "config" | "test" | "other";
export type ValidationOutcome = "passed" | "failed" | "not_run" | "inconclusive";
export type ProviderMode = "live" | "local_demo" | "unavailable";

export interface EvidenceRef {
  path: string;
  start_line: number | null;
  end_line: number | null;
  excerpt: string;
  role: EvidenceRole;
}

export interface Finding {
  id: string;
  check_id: string;
  subject_key: string;
  title: string;
  summary: string;
  status: FindingStatus;
  severity: Severity;
  confidence_note: string;
  documentation_claim: string | null;
  observed_fact: string | null;
  evidence: EvidenceRef[];
  limitations: string[];
  suggested_fix: string | null;
  affected_paths: string[];
}

export interface Repository {
  id: string;
  name: string;
  source: "sample" | "upload";
  status: "created" | "indexing" | "ready" | "failed";
  created_at: string;
  files_indexed: number;
  docs_found: number;
  findings_total: number;
  last_audit_at: string | null;
}

export interface RouteInfo {
  method: string;
  path: string;
  handler: string;
  file: string;
  start_line: number;
  end_line: number;
  prefix_resolved: boolean;
}

export interface RepositoryOverview {
  repository_id: string;
  name: string;
  source: "sample" | "upload";
  status: string;
  file_count: number;
  docs_found: number;
  doc_files: string[];
  languages: Record<string, number>;
  routes: RouteInfo[];
  checks_supported: string[];
  findings_by_status: Record<string, number>;
  last_audit_at: string | null;
  indexed_at: string | null;
  limitations: string[];
}

export interface AuditSummary {
  files_inspected: number;
  findings_total: number;
  verified: number;
  needs_review: number;
  insufficient_evidence: number;
  resolved: number;
  dismissed: number;
}

export interface AuditRun {
  id: string;
  repository_id: string;
  status: "completed" | "partial" | "failed";
  checks_run: string[];
  checks_skipped: string[];
  summary: AuditSummary;
  findings: Finding[];
  created_at: string;
}

export interface FindingPage {
  items: Finding[];
  total: number;
  next_cursor: string | null;
}

export interface PatchDraft {
  id: string;
  repository_id: string;
  finding_id: string;
  target_path: string;
  diff: string;
  rationale: string;
  limitations: string[];
  mode: string;
  original_content: string;
  proposed_content: string;
}

export interface ValidationStep {
  id: string;
  label: string;
  outcome: ValidationOutcome;
  detail: string;
}

export interface ValidationResult {
  patch_id: string;
  outcome: ValidationOutcome;
  steps: ValidationStep[];
  checked_at: string;
}

export interface PatchDetail {
  patch: PatchDraft;
  validation: ValidationResult | null;
}

export interface Citation {
  path: string;
  start_line: number | null;
  end_line: number | null;
  excerpt: string;
}

export interface GroundedAnswer {
  answer: string;
  citations: Citation[];
  limitations: string[];
  follow_up_suggestions: string[];
  mode: string;
}

export interface ProviderStatus {
  mode: ProviderMode;
  provider: string;
  model: string;
  state: "connected" | "not_configured" | "error";
  message: string;
  verified_contract: boolean;
}

export interface HealthResponse {
  status: "ok" | "degraded";
  app: string;
  version: string;
  workspace_writable: boolean;
  provider: ProviderStatus;
}

export interface SearchHit {
  path: string;
  start_line: number;
  end_line: number;
  excerpt: string;
  role: string;
}

export interface ApiErrorBody {
  error: { code: string; message: string; request_id: string; retryable: boolean };
}