import type { ButtonHTMLAttributes, ReactNode } from "react";

import {
  cn,
  severityLabel,
  statusLabel,
  statusMeaning,
} from "../../lib/format";
import type { ApiError } from "../../lib/api";
import type { FindingStatus, Severity } from "../../lib/types";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-accent text-white shadow-glow hover:bg-accent-hover hover:shadow-[0_0_0_1px_rgba(124,127,245,0.6),0_0_36px_-8px_rgba(124,127,245,0.7)] disabled:bg-line-strong disabled:text-ink-faint disabled:shadow-none",
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
        "inline-flex items-center justify-center gap-2 rounded-control font-medium transition-all duration-150 disabled:cursor-not-allowed",
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

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "animate-pulse rounded-[6px] bg-subtle/70 [background-image:linear-gradient(90deg,transparent,rgba(255,255,255,0.04),transparent)] [background-size:200%_100%]",
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
  glow = false,
}: {
  children: ReactNode;
  className?: string;
  as?: "section" | "article" | "div";
  padded?: boolean;
  glow?: boolean;
}) {
  return (
    <Tag
      className={cn(
        "rounded-panel border border-line bg-surface hairline",
        padded && "p-5",
        glow && "shadow-accent",
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
        "flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3.5",
        className,
      )}
    >
      <div className="min-w-0">
        <h3 className="text-h3 text-ink">{title}</h3>
        {subtitle ? <p className="mt-0.5 text-[12.5px] text-ink-muted">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function Divider({ className }: { className?: string }) {
  return (
    <div role="separator" aria-orientation="horizontal" className={cn("h-px bg-line", className)} />
  );
}

export function DashedDivider({ className }: { className?: string }) {
  return (
    <div
      role="separator"
      aria-orientation="horizontal"
      className={cn("dashed-hairline h-px", className)}
    />
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
    ok: "border-ok/30 bg-ok-soft text-ok",
    warn: "border-warn/30 bg-warn-soft text-warn",
    danger: "border-danger/30 bg-danger-soft text-danger",
    info: "border-info/30 bg-info-soft text-info",
  };
  return (
    <span
      title={title}
      className={cn(
        "inline-flex h-5 items-center gap-1 rounded-chip border px-2 text-2xs font-medium leading-none",
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

/** A small toggleable pill used for filters and prompt chips. */
export function Chip({
  active = false,
  onClick,
  children,
  className,
}: {
  active?: boolean;
  onClick?: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-chip border px-3 text-[12.5px] font-medium transition-colors duration-150",
        active
          ? "border-accent/45 bg-accent-soft text-accent-strong"
          : "border-line bg-surface text-ink-muted hover:border-line-strong hover:text-ink",
        className,
      )}
    >
      {active ? (
        <span aria-hidden="true" className="h-1 w-1 rounded-full bg-accent-strong" />
      ) : null}
      {children}
    </button>
  );
}

const SPOTLIGHT_TONES: Record<string, { bg: string; ring: string; dot: string; text: string }> = {
  accent: {
    bg: "border-accent/30 bg-accent-soft text-accent-strong",
    ring: "shadow-[0_0_28px_-8px_rgba(99,102,241,0.6)]",
    dot: "bg-accent-strong shadow-[0_0_8px_rgba(124,127,245,0.7)]",
    text: "text-accent-strong",
  },
  info: {
    bg: "border-info/30 bg-info-soft text-info",
    ring: "shadow-[0_0_28px_-8px_rgba(34,211,238,0.6)]",
    dot: "bg-info shadow-[0_0_8px_rgba(34,211,238,0.7)]",
    text: "text-info",
  },
  warn: {
    bg: "border-warn/30 bg-warn-soft text-warn",
    ring: "shadow-[0_0_28px_-8px_rgba(245,158,11,0.6)]",
    dot: "bg-warn shadow-[0_0_8px_rgba(245,158,11,0.7)]",
    text: "text-warn",
  },
  ok: {
    bg: "border-ok/30 bg-ok-soft text-ok",
    ring: "shadow-[0_0_28px_-8px_rgba(16,185,129,0.6)]",
    dot: "bg-ok shadow-[0_0_8px_rgba(16,185,129,0.7)]",
    text: "text-ok",
  },
};

/** A glowing colored disc used for the four workflow steps and badge icons. */
export function Spotlight({ tone, children }: { tone: keyof typeof SPOTLIGHT_TONES; children: ReactNode }) {
  const t = SPOTLIGHT_TONES[tone];
  return (
    <span
      className={cn(
        "relative grid h-7 w-7 place-items-center rounded-full border",
        t.bg,
        t.ring,
      )}
    >
      <span aria-hidden="true" className={cn("absolute inset-0 m-auto h-1 w-1 rounded-full", t.dot)} />
      <span className="relative">{children}</span>
    </span>
  );
}

const OUTCOME_TONE_CLASSES: Record<string, { border: string; bg: string; text: string; dot: string }> = {
  ok: {
    border: "border-ok/30",
    bg: "bg-ok-soft",
    text: "text-ok",
    dot: "bg-ok",
  },
  warn: {
    border: "border-warn/30",
    bg: "bg-warn-soft",
    text: "text-warn",
    dot: "bg-warn",
  },
  danger: {
    border: "border-danger/30",
    bg: "bg-danger-soft",
    text: "text-danger",
    dot: "bg-danger",
  },
  pulse: {
    border: "border-line",
    bg: "bg-surface",
    text: "text-ink",
    dot: "bg-info",
  },
};

export function StatusPill({
  tone,
  children,
  pulsing = false,
}: {
  tone: keyof typeof OUTCOME_TONE_CLASSES;
  children: ReactNode;
  pulsing?: boolean;
}) {
  const t = OUTCOME_TONE_CLASSES[tone];
  return (
    <Badge
      tone="neutral"
      className={cn("gap-1.5", t.border, t.bg, t.text)}
    >
      <span className="relative inline-block h-1.5 w-1.5">
        <span className={cn("absolute inset-0 rounded-full", t.dot)} />
        {pulsing ? <span aria-hidden="true" className="pulse-dot" /> : null}
      </span>
      {children}
    </Badge>
  );
}

export function ErrorNotice({
  error,
  onRetry,
}: {
  error: ApiError;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="rounded-panel border border-danger/30 bg-danger-soft p-4 text-[13px] text-danger hairline"
    >
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
    <div className="rounded-panel border border-dashed border-line-strong bg-surface/50 px-6 py-14 text-center">
      <div className="mx-auto mb-3 flex h-9 w-9 items-center justify-center rounded-full border border-line bg-subtle text-ink-muted">
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
    <header className="flex flex-wrap items-start justify-between gap-4 border-b border-line px-6 py-5 hairline">
      <div className="min-w-0">
        <h1 className="text-h2 text-ink">{title}</h1>
        {subtitle ? <p className="body-text mt-1 max-w-2xl">{subtitle}</p> : null}
        {meta ? <div className="mt-2 text-2xs text-ink-faint">{meta}</div> : null}
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
        "rounded-panel border border-line bg-surface px-4 py-4 hairline",
        emphasis && "shadow-accent border-accent/40",
      )}
    >
      <p className="text-2xs font-medium uppercase tracking-[0.08em] text-ink-faint">{label}</p>
      <p
        className={cn(
          "mt-1.5 text-[28px] font-semibold leading-none tabular-nums tracking-[-0.015em] text-ink",
          emphasis && "text-gradient",
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-1.5 text-2xs text-ink-faint">{hint}</p> : null}
    </div>
  );
}