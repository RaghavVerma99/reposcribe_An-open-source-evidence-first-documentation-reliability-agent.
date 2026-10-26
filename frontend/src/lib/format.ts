export function cn(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(" ");
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat().format(value);
}

export function relativeTime(iso: string | null | undefined): string {
  if (!iso) return "never";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "unknown";
  const seconds = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export const CHECK_LABELS: Record<string, string> = {
  "markdown.internal_link_exists": "Internal links",
  "docs.file_reference_exists": "File references",
  "fastapi.route_matches_docs": "API routes",
  "config.env_var_documented": "Configuration",
  "python.public_symbol_referenced": "Symbols",
  "docs.readme_checklist": "README checklist",
};

export function checkLabel(checkId: string): string {
  return CHECK_LABELS[checkId] ?? checkId;
}

export const STATUS_LABELS: Record<string, string> = {
  verified: "Verified",
  needs_review: "Needs review",
  insufficient_evidence: "Insufficient evidence",
  resolved: "Resolved",
  dismissed: "Dismissed",
};

export function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

export function severityLabel(severity: string): string {
  return severity.charAt(0).toUpperCase() + severity.slice(1);
}

export function statusMeaning(status: string): string {
  return STATUS_MEANINGS[status] ?? status;
}

export const STATUS_MEANINGS: Record<string, string> = {
  verified: "Proven by deterministic evidence within the check's stated scope.",
  needs_review: "Plausible mismatch that needs a human or semantic confirmation.",
  insufficient_evidence: "The tool could not safely reach a conclusion.",
  resolved: "Reported earlier, no longer reproduces against the current snapshot.",
  dismissed: "Dismissed by a reviewer.",
};

export const VALIDATION_LABELS: Record<string, string> = {
  passed: "Passed",
  failed: "Failed",
  not_run: "Not run",
  inconclusive: "Inconclusive",
};