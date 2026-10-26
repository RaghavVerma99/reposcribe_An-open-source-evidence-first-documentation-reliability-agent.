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
  CardHeader,
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
      <div className="flex items-center gap-2 p-8 text-[13px] text-ink-muted">
        <Spinner className="text-accent-strong" /> Loading repository overview…
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
  const verifiedCount = byStatus.verified ?? 0;
  const hasAudit = repository.last_audit_at !== null;

  return (
    <div>
      <PageHeader
        title="Repository overview"
        subtitle={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-mono text-ink">{repository.name}</span>
            <span aria-hidden="true" className="text-line-strong">
              ·
            </span>
            {data.source === "sample" ? "Bundled sample" : "Uploaded ZIP"}
            <span aria-hidden="true" className="text-line-strong">
              ·
            </span>
            indexed {relativeTime(data.indexed_at)}
          </span>
        }
        actions={
          <>
            <Button variant="primary" onClick={runAudit} loading={auditing}>
              Run audit
            </Button>
            <Link
              to={`/r/${repository.id}/ask`}
              className="inline-flex h-9 items-center rounded-control border border-line bg-surface px-4 text-[13px] font-medium text-ink transition-colors hover:border-line-strong hover:bg-surface-elevated"
            >
              Ask about codebase
            </Link>
          </>
        }
      />

      <div className="space-y-6 p-6">
        {auditError ? <ErrorNotice error={auditError} onRetry={runAudit} /> : null}

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Stat
            label="Findings"
            value={formatNumber(totalFindings)}
            hint={hasAudit ? `last audit ${relativeTime(repository.last_audit_at)}` : "no audit yet"}
            emphasis={hasAudit}
          />
          <Stat
            label="Verified"
            value={formatNumber(verifiedCount)}
            hint="supported by deterministic evidence"
          />
          <Stat
            label="Files inspected"
            value={formatNumber(data.file_count)}
            hint={`${data.docs_found} documentation files`}
          />
          <Stat
            label="API routes"
            value={formatNumber(data.routes.length)}
            hint="statically discoverable"
          />
        </div>

        {!hasAudit ? (
          <EmptyState
            icon="spark"
            title="No audit has run for this repository yet"
            body="Run an audit to check links, routes, configuration references, and supported documentation rules. RepoScribe inspects the files it has indexed and reports only what the evidence supports."
            action={
              <Button variant="primary" onClick={runAudit} loading={auditing}>
                Run audit
              </Button>
            }
          />
        ) : (
          <Card padded={false} className="overflow-hidden">
            <CardHeader
              title="Findings by status"
              actions={
                <Link
                  to={`/r/${repository.id}/findings`}
                  className="text-[12.5px] font-medium text-accent-strong hover:underline"
                >
                  View findings
                </Link>
              }
            />
            <div className="flex flex-wrap gap-2 px-5 pb-5 pt-4">
              {["verified", "needs_review", "insufficient_evidence", "resolved", "dismissed"].map((status) => (
                <Link key={status} to={`/r/${repository.id}/findings`}>
                  <Badge tone={status === "verified" ? "ok" : status === "needs_review" ? "warn" : "neutral"}>
                    <span
                      aria-hidden="true"
                      className={
                        status === "verified"
                          ? "h-1 w-1 rounded-full bg-ok"
                          : status === "needs_review"
                            ? "h-1 w-1 rounded-full bg-warn"
                            : "h-1 w-1 rounded-full bg-ink-faint"
                      }
                    />
                    {status.replace(/_/g, " ")}: {byStatus[status] ?? 0}
                  </Badge>
                </Link>
              ))}
            </div>
          </Card>
        )}

        <div className="grid gap-6 xl:grid-cols-2">
          <Card padded={false} className="overflow-hidden">
            <CardHeader title="Detected languages" />
            <ul className="divide-y divide-line">
              {Object.entries(data.languages)
                .sort(([, a], [, b]) => b - a)
                .map(([language, count]) => (
                  <li key={language} className="flex items-center justify-between px-5 py-2.5 text-[13px]">
                    <span className="text-ink">{language}</span>
                    <span className="font-mono text-2xs text-ink-muted">{count}</span>
                  </li>
                ))}
            </ul>
          </Card>

          <Card padded={false} className="overflow-hidden">
            <CardHeader title="Documentation files" />
            <ul className="max-h-72 divide-y divide-line overflow-y-auto">
              {data.doc_files.length ? (
                data.doc_files.map((path) => (
                  <li key={path} className="px-5 py-2.5 font-mono text-2xs text-ink-muted">
                    {path}
                  </li>
                ))
              ) : (
                <li className="px-5 py-4 text-[13px] text-ink-muted">No documentation files were indexed.</li>
              )}
            </ul>
          </Card>
        </div>

        <Card padded={false} className="overflow-hidden">
          <CardHeader title="Statically discovered API routes" />
          {data.routes.length ? (
            <div className="scroll-region overflow-x-auto">
              <table className="w-full border-collapse text-[13px]">
                <thead>
                  <tr className="bg-subtle text-left text-2xs uppercase tracking-[0.08em] text-ink-faint">
                    <th className="px-5 py-2 font-medium">Method</th>
                    <th className="px-5 py-2 font-medium">Path</th>
                    <th className="px-5 py-2 font-medium">Handler</th>
                    <th className="px-5 py-2 font-medium">Location</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {data.routes.map((route) => (
                    <tr key={`${route.method}-${route.path}-${route.start_line}`}>
                      <td className="px-5 py-2 font-mono text-2xs text-accent-strong">{route.method}</td>
                      <td className="px-5 py-2 font-mono text-2xs text-ink">{route.path}</td>
                      <td className="px-5 py-2 font-mono text-2xs text-ink-muted">{route.handler}</td>
                      <td className="px-5 py-2 font-mono text-2xs text-ink-faint">
                        {route.file}:{route.start_line}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="px-5 py-4 body-text">
              No routes were discoverable. Route comparison is reported as inconclusive rather than clean.
            </p>
          )}
        </Card>

        <Card padded={false} className="overflow-hidden">
          <CardHeader title="Checks and coverage" />
          <ul className="divide-y divide-line">
            {data.checks_supported.map((checkId) => (
              <li key={checkId} className="flex items-center justify-between px-5 py-2.5 text-[13px]">
                <span className="text-ink">{checkLabel(checkId)}</span>
                <span className="font-mono text-2xs text-ink-faint">{checkId}</span>
              </li>
            ))}
          </ul>
        </Card>

        {data.limitations.length ? (
          <Card padded={false} className="overflow-hidden">
            <CardHeader
              title="Scan limitations"
              subtitle="Files or checks that could not be evaluated. These are reported instead of guessed."
            />
            <ul className="max-h-64 divide-y divide-line overflow-y-auto">
              {data.limitations.map((limitation, index) => (
                <li key={index} className="px-5 py-2.5 text-2xs text-ink-muted">
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