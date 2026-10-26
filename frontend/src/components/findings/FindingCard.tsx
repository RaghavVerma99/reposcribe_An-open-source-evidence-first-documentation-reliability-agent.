import { checkLabel } from "../../lib/format";
import type { Finding, Severity } from "../../lib/types";
import { Card, SeverityBadge, StatusBadge } from "../ui/Primitives";

const SEVERITY_RAIL: Record<Severity, string> = {
  high: "bg-danger/70",
  medium: "bg-warn/70",
  low: "bg-info/60",
  info: "bg-line-strong",
};

export default function FindingCard({ finding, onOpen }: { finding: Finding; onOpen: () => void }) {
  return (
    <Card
      as="article"
      className="group relative overflow-hidden py-4 pl-5 pr-4 transition-colors duration-150 hover:border-line-strong hover:bg-surface-elevated/70"
    >
      <span
        aria-hidden="true"
        className={`absolute inset-y-0 left-0 w-[2px] ${SEVERITY_RAIL[finding.severity]}`}
      />

      <div className="flex items-start justify-between gap-4">
        <button
          type="button"
          onClick={onOpen}
          className="min-w-0 flex-1 text-left"
          aria-label={`Open finding: ${finding.title}`}
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-faint">
              {checkLabel(finding.check_id)}
            </span>
            <span aria-hidden="true" className="text-line-strong">
              ·
            </span>
            <SeverityBadge severity={finding.severity} />
            <StatusBadge status={finding.status} />
          </div>
          <h3 className="mt-2.5 font-display text-[16px] font-semibold tracking-[-0.015em] text-ink">
            {finding.title}
          </h3>
          <p className="mt-1 line-clamp-2 text-[13px] leading-[21px] text-ink-muted">
            {finding.summary}
          </p>
        </button>

        <span
          aria-hidden="true"
          className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full border border-line text-ink-faint transition-all duration-150 group-hover:border-accent/40 group-hover:text-accent-strong"
        >
          <svg
            viewBox="0 0 16 16"
            className="h-3 w-3"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m6 4 4 4-4 4" />
          </svg>
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line pt-3 text-2xs text-ink-faint">
        <span className="font-mono">{finding.check_id}</span>
        {finding.affected_paths.slice(0, 2).map((path) => (
          <span key={path} className="inline-flex items-center gap-3 font-mono">
            <span aria-hidden="true" className="text-line-strong">
              ·
            </span>
            {path}
          </span>
        ))}
        {finding.affected_paths.length > 2 ? (
          <span className="inline-flex items-center gap-3">
            <span aria-hidden="true" className="text-line-strong">
              ·
            </span>
            +{finding.affected_paths.length - 2} more
          </span>
        ) : null}
      </div>
    </Card>
  );
}
