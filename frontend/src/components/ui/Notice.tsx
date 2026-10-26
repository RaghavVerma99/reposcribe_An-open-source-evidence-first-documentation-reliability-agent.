import type { ReactNode } from "react";

import { cn } from "../../lib/format";

/** Centred screen for full-page states (loading, error, not-found). */
export default function Notice({
  title,
  body,
  action,
  tone = "neutral",
}: {
  title: string;
  body: string;
  action?: ReactNode;
  tone?: "neutral" | "danger";
}) {
  return (
    <div className="flex min-h-[70vh] items-center justify-center px-6 py-16">
      <div className="w-full max-w-md rounded-panel border border-line bg-surface p-8 text-center shadow-panel">
        <span
          aria-hidden="true"
          className={cn(
            "mx-auto mb-5 flex h-11 w-11 items-center justify-center rounded-full border border-dashed",
            tone === "danger"
              ? "border-danger/40 bg-danger-soft text-danger"
              : "border-line-strong bg-subtle text-ink-muted",
          )}
        >
          <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="8" cy="8" r="6.25" />
            <path d="M8 5v3.5M8 11h.01" strokeLinecap="round" />
          </svg>
        </span>
        <p className="eyebrow mb-2">RepoScribe</p>
        <h2 className={cn("text-h3", tone === "danger" ? "text-danger" : "text-ink")}>{title}</h2>
        <p className="body-text mt-2">{body}</p>
        {action ? <div className="mt-6">{action}</div> : null}
      </div>
    </div>
  );
}
