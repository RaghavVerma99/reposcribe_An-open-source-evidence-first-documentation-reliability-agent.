import type {
  ApiErrorBody,
  AuditRun,
  Finding,
  FindingPage,
  FindingStatus,
  GroundedAnswer,
  PatchDetail,
  PatchDraft,
  ProviderStatus,
  Repository,
  RepositoryOverview,
  ValidationResult,
} from "./types";

const BASE = "/api/v1";

export class ApiError extends Error {
  code: string;
  requestId: string;
  retryable: boolean;
  status: number;

  constructor(status: number, code: string, message: string, requestId: string, retryable: boolean) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.requestId = requestId;
    this.retryable = retryable;
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const isForm = init.body instanceof FormData;
  const response = await fetch(`${BASE}${path}`, {
    credentials: "same-origin",
    ...init,
    headers: isForm
      ? init.headers
      : { "Content-Type": "application/json", ...(init.headers ?? {}) },
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  const payload = text ? JSON.parse(text) : undefined;

  if (!response.ok) {
    const body = payload as ApiErrorBody | undefined;
    throw new ApiError(
      response.status,
      body?.error?.code ?? "unknown_error",
      body?.error?.message ?? `Request failed with status ${response.status}.`,
      body?.error?.request_id ?? response.headers.get("X-Request-ID") ?? "",
      body?.error?.retryable ?? false,
    );
  }
  return payload as T;
}

export const api = {
  provider: () => request<ProviderStatus>("/provider"),

  createSample: (sampleId = "fastapi-users") => {
    const form = new FormData();
    form.append("sample_id", sampleId);
    return request<Repository>("/repositories", { method: "POST", body: form });
  },

  upload: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return request<Repository>("/repositories", { method: "POST", body: form });
  },

  repository: (repositoryId: string) => request<Repository>(`/repositories/${repositoryId}`),
  reindex: (repositoryId: string) =>
    request<Repository>(`/repositories/${repositoryId}/index`, { method: "POST" }),
  overview: (repositoryId: string) =>
    request<RepositoryOverview>(`/repositories/${repositoryId}/overview`),
  deleteRepository: (repositoryId: string) =>
    request<void>(`/repositories/${repositoryId}`, { method: "DELETE" }),

  runAudit: (repositoryId: string, checkIds?: string[]) =>
    request<AuditRun>(`/repositories/${repositoryId}/audits`, {
      method: "POST",
      body: JSON.stringify(checkIds ? { check_ids: checkIds } : {}),
    }),

  findings: (
    repositoryId: string,
    params: { status?: string; severity?: string; checkId?: string; q?: string; cursor?: string; limit?: number } = {},
  ) => {
    const query = new URLSearchParams();
    if (params.status) query.set("status", params.status);
    if (params.severity) query.set("severity", params.severity);
    if (params.checkId) query.set("check_id", params.checkId);
    if (params.q) query.set("q", params.q);
    if (params.cursor) query.set("cursor", params.cursor);
    query.set("limit", String(params.limit ?? 50));
    return request<FindingPage>(`/repositories/${repositoryId}/findings?${query.toString()}`);
  },

  finding: (repositoryId: string, findingId: string) =>
    request<Finding>(`/repositories/${repositoryId}/findings/${findingId}`),

  updateFinding: (repositoryId: string, findingId: string, status: FindingStatus) =>
    request<Finding>(`/repositories/${repositoryId}/findings/${findingId}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),

  ask: (repositoryId: string, question: string) =>
    request<GroundedAnswer>(`/repositories/${repositoryId}/questions`, {
      method: "POST",
      body: JSON.stringify({ question }),
    }),

  createPatch: (repositoryId: string, findingId: string) =>
    request<PatchDraft>(`/repositories/${repositoryId}/findings/${findingId}/patches`, {
      method: "POST",
    }),

  patch: (repositoryId: string, patchId: string) =>
    request<PatchDetail>(`/repositories/${repositoryId}/patches/${patchId}`),

  validatePatch: (repositoryId: string, patchId: string) =>
    request<ValidationResult>(`/repositories/${repositoryId}/patches/${patchId}/validate`, {
      method: "POST",
    }),

  downloadUrl: (repositoryId: string, patchId: string, format: "patch" | "markdown") =>
    `${BASE}/repositories/${repositoryId}/patches/${patchId}/download?format=${format}`,
};