import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { api, ApiError } from "../../lib/api";
import { checkLabel, formatNumber, relativeTime } from "../../lib/format";
import { useShell } from "../../lib/shell";
import { useAsync } from "../../lib/useAsync";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorNotice,
  PageHeader,
  Spinner,
  Stat,
} from "../../components/ui/Primitives";

export default function OverviewPage() {
  const { repository, reloadRepository } = useShell();
  const navigate = useNavigate();
  const overview = useAsync(() => api.overview(repository.id), [repository.id]);
  const [auditing, setAuditing] = useState(false);
  const [auditError, setAuditError] = useState<ApiError | null>(null);

  async function runAudit() {
    setAuditing(true);
    setAuditError(null);
    try {
      await api.runAudit(repository.id);
      reloadRepository();
      navigate(`/r/${repository.id}/findings`);
    } catch (caught) {
      setAuditError(caught as ApiError);
    } finally {
      setAuditing(false);
    }
  }

  if (overview.state.status === "loading") {
    return (
      <div className="flex items-center gap-2 p-8 text-sm text-ink-muted">
        <Spinner className="text-accent" /> Loading repository overviewâ€¦
      </div>
    );
  }

  if (overview.state.status === "error" || !overview.state.data) {
    return (
      <div className="p-6">
        {overview.state.error ? (
          <ErrorNotice error={overview.state.error} onRetry={overview.reload} />
        ) : null}
      </div>
    );
  }

  const data = overview.state.data;
  const byStatus = data.findings_by_status;
  const totalFindings = Object.values(byStatus).reduce((sum, value) => sum + value, 0);
  const hasAudit = repository.last_audit_at !== null;

  return (
    <div>
      <PageHeader
        title="Repository overview"
        subtitle={`${data.source === "sample" ? "Bundled sample repository" : "Uploaded ZIP"} Â· indexed ${relativeTime(
          data.indexed_at,
        )}`}
        actions={
          <>
            <Button variant="primary" onClick={runAudit} loading={auditing}>
              Run audit
            </Button>
            <Link
              to={`/r/${repository.id}/ask`}
              className="inline-flex h-8 items-center rounded-control border border-line bg-surface px-3 text-[13px] font-medium text-ink transition-colors hover:border-line-strong hover:bg-subtle"
            >
              Ask about codebase
            </Link>
          </>
        }
      />

      <div className="space-y-6 p-6">
        {auditError ? <ErrorNotice error={auditError} onRetry={runAudit} /> : null}

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Stat label="Files inspected" value={formatNumber(data.file_count)} hint={`${data.docs_found} documentation files`} />
          <Stat label="API routes found" value={formatNumber(data.routes.length)} hint="statically discoverable" />
          <Stat label="Checks supported" value={formatNumber(data.checks_supported.length)} hint="deterministic analyzers" />
          <Stat
            label="Findings"
            value={formatNumber(totalFindings)}
            hint={hasAudit ? `last audit ${relativeTime(repository.last_audit_at)}` : "no audit yet"}
          />
        </div>

        {!hasAudit ? (
          <EmptyState
            title="No audit has run for this repository yet"
            body="Run an audit to check links, routes, configuration references, and supported documentation rules. RepoScribe inspects the files it has indexed and reports only what the evidence supports."
            action={
              <Button variant="primary" onClick={runAudit} loading={auditing}>
                Run audit
              </Button>
            }
          />
        ) : (
          <Card className="p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-[13px] font-semibold tracking-tight text-ink">Findings by status</h2>
              <Link
                to={`/r/${repository.id}/findings`}
                className="text-xs font-medium text-accent hover:underline"
              >
                View findings
              </Link>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {["verified", "needs_review", "insufficient_evidence", "resolved", "dismissed"].map((status) => (
                <Link key={status} to={`/r/${repository.id}/findings`}>
                  <Badge tone={status === "verified" ? "ok" : status === "needs_review" ? "warn" : "neutral"}>
                    {status.replace(/_/g, " ")}: {byStatus[status] ?? 0}
                  </Badge>
                </Link>
              ))}
            </div>
          </Card>
        )}

        <div className="grid gap-6 xl:grid-cols-2">
          <Card className="overflow-hidden">
            <div className="border-b border-line px-4 py-3">
              <h2 className="text-[13px] font-semibold tracking-tight text-ink">Detected languages</h2>
            </div>
            <ul className="divide-y divide-line">
              {Object.entries(data.languages)
                .sort(([, a], [, b]) => b - a)
                .map(([language, count]) => (
                  <li key={language} className="flex items-center justify-between px-4 py-2 text-sm">
                    <span className="text-ink">{language}</span>
                    <span className="font-mono text-2xs text-ink-muted">{count}</span>
                  </li>
                ))}
            </ul>
          </Card>

          <Card className="overflow-hidden">
            <div className="border-b border-line px-4 py-3">
              <h2 className="text-[13px] font-semibold tracking-tight text-ink">Documentation files</h2>
            </div>
            <ul className="divide-y divide-line">
              {data.doc_files.length ? (
                data.doc_files.map((path) => (
                  <li key={path} className="px-4 py-2 font-mono text-2xs text-ink-muted">
                    {path}
                  </li>
                ))
              ) : (
                <li className="px-4 py-3 text-sm text-ink-muted">No documentation files were indexed.</li>
              )}
            </ul>
          </Card>
        </div>

        <Card className="overflow-hidden">
          <div className="border-b border-line px-4 py-3">
            <h2 className="text-[13px] font-semibold tracking-tight text-ink">Statically discovered API routes</h2>
          </div>
          {data.routes.length ? (
            <div className="scroll-region overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-subtle text-left text-2xs uppercase tracking-wide text-ink-faint">
                    <th className="px-4 py-2 font-medium">Method</th>
                    <th className="px-4 py-2 font-medium">Path</th>
                    <th className="px-4 py-2 font-medium">Handler</th>
                    <th className="px-4 py-2 font-medium">Location</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {data.routes.map((route) => (
                    <tr key={`${route.method}-${route.path}-${route.start_line}`}>
                      <td className="px-4 py-2 font-mono text-2xs text-accent-strong">{route.method}</td>
                      <td className="px-4 py-2 font-mono text-2xs text-ink">{route.path}</td>
                      <td className="px-4 py-2 font-mono text-2xs text-ink-muted">{route.handler}</td>
                      <td className="px-4 py-2 font-mono text-2xs text-ink-faint">
                        {route.file}:{route.start_line}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="px-4 py-3 text-sm text-ink-muted">
              No routes were discoverable. Route comparison is reported as inconclusive rather than clean.
            </p>
          )}
        </Card>

        <Card className="overflow-hidden">
          <div className="border-b border-line px-4 py-3">
            <h2 className="text-[13px] font-semibold tracking-tight text-ink">Checks and coverage</h2>
          </div>
          <ul className="divide-y divide-line">
            {data.checks_supported.map((checkId) => (
              <li key={checkId} className="flex items-center justify-between px-4 py-2 text-sm">
                <span className="text-ink">{checkLabel(checkId)}</span>
                <span className="font-mono text-2xs text-ink-faint">{checkId}</span>
              </li>
            ))}
          </ul>
        </Card>

        {data.limitations.length ? (
          <Card className="overflow-hidden">
            <div className="border-b border-line px-4 py-3">
              <h2 className="text-[13px] font-semibold tracking-tight text-ink">Scan limitations</h2>
              <p className="mt-1 text-2xs text-ink-muted">
                Files or checks that could not be evaluated. These are reported instead of guessing.
              </p>
            </div>
            <ul className="max-h-64 divide-y divide-line overflow-y-auto">
              {data.limitations.map((limitation, index) => (
                <li key={index} className="px-4 py-2 text-2xs text-ink-muted">
                  {limitation}
                </li>
              ))}
            </ul>
          </Card>
        ) : null}
      </div>
    </div>
  );
}