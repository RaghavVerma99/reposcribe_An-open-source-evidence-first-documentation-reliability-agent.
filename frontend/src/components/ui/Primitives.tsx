import type { ButtonHTMLAttributes, ReactNode } from "react";

import {
  cn,
  severityLabel,
  statusLabel,
  statusMeaning,
} from "../../lib/format";
import type { ApiError } from "../../lib/api";
import type { FindingStatus, ProviderMode, Severity } from "../../lib/types";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-accent text-[#03140a] shadow-[0_0_0_1px_rgba(34,197,94,0.28),0_10px_28px_-18px_rgba(34,197,94,0.8)] hover:bg-accent-hover hover:shadow-[0_0_0_1px_rgba(74,222,128,0.42),0_12px_32px_-18px_rgba(74,222,128,0.8)] disabled:bg-line disabled:text-ink-faint disabled:shadow-none",
  secondary:
    "border border-line bg-surface text-ink hover:border-line-strong hover:bg-surface-elevated disabled:text-ink-faint",
  ghost: "text-ink-muted hover:bg-subtle hover:text-ink disabled:text-ink-faint",
  danger: "border border-danger/30 bg-danger-soft text-danger hover:border-danger/55",
};

export function Button({
  variant = "secondary",
  loading = false,
  size = "md",
  children,
  className,
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  loading?: boolean;
  size?: "sm" | "md";
}) {
  const sizeCls = size === "sm" ? "h-8 px-3 text-[12.5px]" : "h-9 px-4 text-[13px]";
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-control font-semibold tracking-[-0.005em] transition-all duration-150 disabled:cursor-not-allowed",
        sizeCls,
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
  padded = true,
}: {
  children: ReactNode;
  className?: string;
  as?: "section" | "article" | "div";
  padded?: boolean;
}) {
  return (
    <Tag
      className={cn(
        "rounded-panel border border-line bg-surface hairline",
        padded && "p-5",
        className,
      )}
    >
      {children}
    </Tag>
  );
}

export function CardHeader({
  title,
  subtitle,
  actions,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4",
        className,
      )}
    >
      <div className="min-w-0">
        <h3 className="text-h3 text-ink">{title}</h3>
        {subtitle ? <p className="mt-1 text-[12.5px] leading-5 text-ink-muted">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
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
        "inline-flex h-5 items-center gap-1.5 rounded-chip border px-2 text-2xs font-medium leading-none",
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

export function ProviderPill({
  mode,
  message,
  className,
}: {
  mode?: ProviderMode | null;
  message?: string;
  className?: string;
}) {
  if (!mode) return null;
  const label = mode === "live" ? "live provider" : mode === "unavailable" ? "provider unavailable" : "local demo";
  const tone =
    mode === "live"
      ? "border-ok/25 bg-ok-soft text-ok"
      : mode === "unavailable"
        ? "border-danger/25 bg-danger-soft text-danger"
        : "border-info/25 bg-info-soft text-info";
  const dot = mode === "live" ? "bg-ok" : mode === "unavailable" ? "bg-danger" : "bg-info";
  return (
    <span
      title={message}
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-chip border px-2.5 text-2xs font-medium",
        tone,
        className,
      )}
    >
      <span aria-hidden="true" className={cn("h-1 w-1 rounded-full", dot)} />
      {label}
    </span>
  );
}

export function ErrorNotice({
  error,
  onRetry,
  onDismiss,
}: {
  error: ApiError;
  onRetry?: () => void;
  onDismiss?: () => void;
}) {
  return (
    <div
      role="alert"
      className="relative rounded-panel border border-danger/30 bg-danger-soft p-4 pr-10 text-[13px] text-danger hairline"
    >
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss error"
          className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full text-danger/60 transition-colors hover:bg-danger/10 hover:text-danger"
        >
          <svg
            viewBox="0 0 16 16"
            className="h-3.5 w-3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M4.5 4.5 11.5 11.5M11.5 4.5 4.5 11.5" />
          </svg>
        </button>
      ) : null}
      <p className="font-medium leading-5">{error.message}</p>
      <p className="mt-1.5 font-mono text-2xs text-danger/70">
        {error.code}
        {error.requestId ? ` · req ${error.requestId}` : ""}
        {error.retryable ? " · retryable" : ""}
      </p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 rounded-control border border-danger/45 px-2.5 py-1 text-xs font-medium transition-colors hover:border-danger/70 hover:bg-danger/10"
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
  icon = "spark",
}: {
  title: string;
  body: string;
  action?: ReactNode;
  icon?: "spark" | "doc" | "shield";
}) {
  return (
    <div className="rounded-panel border border-dashed border-line-strong bg-surface/40 px-6 py-14 text-center">
      <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-full border border-line bg-subtle text-ink-muted">
        {icon === "spark" ? (
          <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M8 2v4M8 10v4M2 8h4M10 8h4M4 4l2.5 2.5M9.5 9.5 12 12M4 12l2.5-2.5M9.5 6.5 12 4" />
          </svg>
        ) : icon === "doc" ? (
          <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3.5 2.5h6L12.5 5.5v8a1 1 0 0 1-1 1H3.5a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1Z" />
            <path d="M9.5 2.5v3h3" />
          </svg>
        ) : (
          <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M8 1.75 13.5 4.25v6.5L8 13.25 2.5 10.75v-6.5Z" />
            <path d="M8 8 2.5 4.25M8 8l5.5-3.75M8 8v5.25" />
          </svg>
        )}
      </div>
      <h3 className="text-h3 text-ink">{title}</h3>
      <p className="body-text mx-auto mt-2 max-w-md">{body}</p>
      {action ? <div className="mt-6 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
  meta,
}: {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  meta?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-5 border-b border-line px-4 py-6 hairline sm:px-6 lg:px-8">
      <div className="min-w-0">
        <h1 className="text-h2 text-ink">{title}</h1>
        {subtitle ? <p className="body-text mt-2 max-w-3xl">{subtitle}</p> : null}
        {meta ? <div className="mt-3 font-mono text-2xs text-ink-faint">{meta}</div> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export function Stat({
  label,
  value,
  hint,
  emphasis = false,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  emphasis?: boolean;
}) {
  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-panel border border-line bg-surface px-5 py-5 hairline transition-colors duration-150 hover:border-line-strong",
        emphasis && "border-accent/25",
      )}
    >
      {emphasis ? (
        <span
          aria-hidden="true"
          className="absolute inset-x-5 top-0 h-px bg-gradient-to-r from-accent/80 via-accent/25 to-transparent"
        />
      ) : null}
      <p className="eyebrow">{label}</p>
      <p
        className={cn(
          "mt-2 text-[30px] font-semibold leading-none tabular-nums tracking-[-0.03em] text-ink",
          emphasis && "text-gradient",
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-2 text-2xs leading-4 text-ink-faint">{hint}</p> : null}
    </div>
  );
}
