import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { api, ApiError } from "../../lib/api";
import type { Repository } from "../../lib/types";
import { relativeTime } from "../../lib/format";
import { Button, Badge, ErrorNotice } from "../ui/Primitives";

export default function TopBar({
  repository,
  onMenu,
  onAudited,
}: {
  repository: Repository;
  onMenu: () => void;
  onAudited: () => void;
}) {
  const navigate = useNavigate();
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  async function runAudit() {
    setRunning(true);
    setError(null);
    try {
      await api.runAudit(repository.id);
      onAudited();
      navigate(`/r/${repository.id}/findings`);
    } catch (caught) {
      setError(caught as ApiError);
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="sticky top-0 z-30 border-b border-line bg-canvas/80 backdrop-blur-xl">
      <div className="flex items-center justify-between gap-3 px-4 py-3 lg:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={onMenu}
            aria-label="Open navigation"
            className="grid h-8 w-8 place-items-center rounded-control border border-line bg-surface text-ink-muted transition-colors hover:border-line-strong hover:text-ink lg:hidden"
          >
            <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
              <path d="M2.5 4.5h11M2.5 8h11M2.5 11.5h11" strokeLinecap="round" />
            </svg>
          </button>
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold tracking-tight text-ink">{repository.name}</p>
            <p className="truncate text-2xs text-ink-faint">
              {repository.source === "sample" ? "Bundled sample" : "Uploaded ZIP"}
              <span className="mx-1.5 text-line-strong">/</span>
              {repository.files_indexed} files
              <span className="mx-1.5 text-line-strong">/</span>
              last audit {relativeTime(repository.last_audit_at)}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Badge tone={repository.status === "ready" ? "ok" : "warn"}>
            <span
              aria-hidden="true"
              className={
                repository.status === "ready"
                  ? "h-1 w-1 rounded-full bg-ok"
                  : "h-1 w-1 animate-pulse rounded-full bg-warn"
              }
            />
            {repository.status}
          </Badge>
          <Button variant="primary" loading={running} onClick={runAudit}>
            {running ? "Auditing…" : "Run audit"}
          </Button>
        </div>
      </div>
      {error ? (
        <div className="px-4 pb-3 lg:px-6">
          <ErrorNotice error={error} onRetry={runAudit} />
        </div>
      ) : null}
    </div>
  );
}