import type { ButtonHTMLAttributes, ReactNode } from "react";

import { cn, severityLabel, statusLabel, statusMeaning } from "../../lib/format";
import type { ApiError } from "../../lib/api";
import type { FindingStatus, Severity } from "../../lib/types";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-accent text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.14)] hover:bg-accent-hover disabled:bg-line-strong disabled:text-ink-faint disabled:shadow-none",
  secondary:
    "border border-line bg-surface text-ink hover:border-line-strong hover:bg-subtle disabled:text-ink-faint",
  ghost: "text-ink-muted hover:bg-subtle hover:text-ink disabled:text-ink-faint",
  danger: "border border-danger/25 bg-danger-soft text-danger hover:border-danger/50",
};

export function Button({
  variant = "secondary",
  loading = false,
  children,
  className,
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; loading?: boolean }) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={cn(
        "inline-flex h-8 items-center justify-center gap-2 rounded-control px-3 text-[13px] font-medium transition-colors duration-150 disabled:cursor-not-allowed",
        VARIANTS[variant],
        className,
      )}
    >
      {loading ? <Spinner /> : null}
      {children}
    </button>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent opacity-80",
        className,
      )}
    />
  );
}

export function Card({
  children,
  className,
  as: Tag = "section",
}: {
  children: ReactNode;
  className?: string;
  as?: "section" | "article" | "div";
}) {
  return (
    <Tag className={cn("rounded-panel border border-line bg-surface shadow-panel", className)}>
      {children}
    </Tag>
  );
}

export function Badge({
  children,
  tone = "neutral",
  title,
  className,
}: {
  children: ReactNode;
  tone?: "neutral" | "accent" | "ok" | "warn" | "danger" | "info";
  title?: string;
  className?: string;
}) {
  const tones: Record<string, string> = {
    neutral: "border-line bg-subtle text-ink-muted",
    accent: "border-accent/30 bg-accent-soft text-accent-strong",
    ok: "border-ok/25 bg-ok-soft text-ok",
    warn: "border-warn/25 bg-warn-soft text-warn",
    danger: "border-danger/25 bg-danger-soft text-danger",
    info: "border-info/25 bg-info-soft text-info",
  };
  return (
    <span
      title={title}
      className={cn(
        "inline-flex h-5 items-center gap-1 rounded-full border px-2 text-2xs font-medium leading-none",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

const STATUS_TONES: Record<FindingStatus, "ok" | "warn" | "info" | "neutral"> = {
  verified: "ok",
  needs_review: "warn",
  insufficient_evidence: "info",
  resolved: "neutral",
  dismissed: "neutral",
};

const STATUS_DOTS: Record<FindingStatus, string> = {
  verified: "bg-ok",
  needs_review: "bg-warn",
  insufficient_evidence: "bg-info",
  resolved: "bg-ink-faint",
  dismissed: "bg-ink-faint",
};

/** Status and severity are separate concepts; both carry a text label. */
export function StatusBadge({ status }: { status: FindingStatus }) {
  return (
    <Badge tone={STATUS_TONES[status]} title={statusMeaning(status)}>
      <span aria-hidden="true" className={cn("h-1 w-1 rounded-full", STATUS_DOTS[status])} />
      {statusLabel(status)}
    </Badge>
  );
}

const SEVERITY_TONES: Record<Severity, "danger" | "warn" | "info" | "neutral"> = {
  high: "danger",
  medium: "warn",
  low: "info",
  info: "neutral",
};

export function SeverityBadge({ severity }: { severity: Severity }) {
  return (
    <Badge
      tone={SEVERITY_TONES[severity]}
      title={`Likely impact: ${severity}. Severity is impact, not confidence.`}
    >
      {severityLabel(severity)}
    </Badge>
  );
}

export function ErrorNotice({ error, onRetry }: { error: ApiError; onRetry?: () => void }) {
  return (
    <div
      role="alert"
      className="rounded-panel border border-danger/25 bg-danger-soft p-4 text-sm text-danger"
    >
      <p className="font-medium">{error.message}</p>
      <p className="mt-1 font-mono text-2xs text-danger/70">
        {error.code}
        {error.requestId ? ` · req ${error.requestId}` : ""}
        {error.retryable ? " · retryable" : ""}
      </p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 rounded-control border border-danger/35 px-2.5 py-1 text-xs font-medium transition-colors hover:border-danger/70 hover:bg-danger/10"
        >
          Retry
        </button>
      ) : null}
    </div>
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-panel border border-dashed border-line-strong bg-surface/60 px-6 py-12 text-center">
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-[13px] leading-6 text-ink-muted">{body}</p>
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-4 border-b border-line px-6 py-5">
      <div className="min-w-0">
        <h1 className="text-lg font-semibold tracking-[-0.01em] text-ink">{title}</h1>
        {subtitle ? <p className="mt-1 text-[13px] text-ink-muted">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="rounded-panel border border-line bg-surface px-4 py-3.5 shadow-panel">
      <p className="text-2xs font-medium uppercase tracking-[0.08em] text-ink-faint">{label}</p>
      <p className="mt-1.5 text-2xl font-semibold tabular-nums tracking-tight text-ink">{value}</p>
      {hint ? <p className="mt-1 text-2xs text-ink-faint">{hint}</p> : null}
    </div>
  );
}