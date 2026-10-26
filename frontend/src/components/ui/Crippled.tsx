import type { ReactNode } from "react";

import { cn } from "../../lib/format";

/** Centred screen for states that replace the whole page. */
export default function Crippled({
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
    <div className="flex min-h-[60vh] items-center justify-center p-8">
      <div className="w-full max-w-md rounded-panel border border-line bg-surface p-8 text-center shadow-panel">
        <span
          aria-hidden="true"
          className={cn(
            "mx-auto mb-4 flex h-9 w-9 items-center justify-center rounded-full border",
            tone === "danger" ? "border-danger/30 bg-danger-soft text-danger" : "border-line bg-subtle text-ink-muted",
          )}
        >
          <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="8" cy="8" r="6.25" />
            <path d="M8 5v3.5M8 11h.01" strokeLinecap="round" />
          </svg>
        </span>
        <h2 className={cn("text-base font-semibold", tone === "danger" ? "text-danger" : "text-ink")}>{title}</h2>
        <p className="mt-2 text-[13px] leading-6 text-ink-muted">{body}</p>
        {action ? <div className="mt-5">{action}</div> : null}
      </div>
    </div>
  );
}