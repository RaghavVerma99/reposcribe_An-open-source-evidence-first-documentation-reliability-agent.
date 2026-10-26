import { checkLabel, statusLabel } from "../../lib/format";
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
      className="group relative overflow-hidden p-4 pl-[15px] transition-colors duration-150 hover:border-line-strong"
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
          <h3 className="truncate text-[13px] font-semibold tracking-tight text-ink">{finding.title}</h3>
          <p className="mt-1 line-clamp-2 text-[13px] leading-5 text-ink-muted">{finding.summary}</p>
        </button>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <SeverityBadge severity={finding.severity} />
          <StatusBadge status={finding.status} />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line pt-2.5 text-2xs text-ink-faint">
        <span className="font-medium text-ink-muted">{checkLabel(finding.check_id)}</span>
        <span className="font-mono">{finding.check_id}</span>
        {finding.affected_paths.slice(0, 2).map((path) => (
          <span key={path} className="font-mono">
            {path}
          </span>
        ))}
        {finding.affected_paths.length > 2 ? <span>+{finding.affected_paths.length - 2}</span> : null}
      </div>

      {finding.status === "resolved" || finding.status === "dismissed" ? (
        <p className="mt-2 text-2xs text-ink-faint">{statusLabel(finding.status)} by reviewer action.</p>
      ) : null}
    </Card>
  );
}