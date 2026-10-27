import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { api, ApiError } from "../../lib/api";
import { checkLabel, formatNumber, relativeTime } from "../../lib/format";
import { useShell } from "../../lib/shell";
import { useAsync } from "../../lib/useAsync";
import { usePageTitle } from "../../lib/usePageTitle";
import type { FindingStatus } from "../../lib/types";
import {
  Button,
  Card,
  CardHeader,
  EmptyState,
  ErrorNotice,
  PageHeader,
  Spinner,
  Stat,
  StatusBadge,
} from "../../components/ui/Primitives";

const STATUS_ORDER: FindingStatus[] = [
  "verified",
  "needs_review",
  "insufficient_evidence",
  "resolved",
  "dismissed",
];

const secondaryLink =
  "inline-flex h-9 items-center rounded-control border border-line bg-surface px-4 text-[13px] font-medium text-ink transition-colors hover:border-line-strong hover:bg-surface-elevated";

export default function OverviewPage() {
  const { repository, reloadRepository } = useShell();
  const navigate = useNavigate();
  const overview = useAsync(() => api.overview(repository.id), [repository.id]);
  const [auditing, setAuditing] = useState(false);
  const [auditError, setAuditError] = useState<ApiError | null>(null);
  usePageTitle(`${repository.name} overview`);

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
      <div className="flex items-center gap-2 p-6 text-[13px] text-ink-muted sm:p-8">
        <Spinner className="text-accent-strong" /> Loading repository overview…
      </div>
    );
  }

  if (overview.state.status === "error" || !overview.state.data) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        {overview.state.error ? (
          <ErrorNotice error={overview.state.error} onRetry={overview.reload} />
        ) : null}
      </div>
    );
  }

  const data = overview.state.data;
  const byStatus = data.findings_by_status;
  const totalFindings = Object.values(byStatus).reduce((sum, value) => sum + value, 0);
  const activeFindings = data.findings_active_total;
  const verifiedCount = byStatus.verified ?? 0;
  const hasAudit = repository.last_audit_at !== null;
  const maxLanguage = Math.max(1, ...Object.values(data.languages));

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
            {hasAudit ? (
              <Button variant="primary" onClick={runAudit} loading={auditing}>
                Run audit
              </Button>
            ) : null}
            <Link to={`/r/${repository.id}/ask`} className={secondaryLink}>
              Ask about codebase
            </Link>
          </>
        }
      />

      <div className="space-y-6 p-4 sm:p-6 lg:p-8">
        {auditError ? <ErrorNotice error={auditError} onRetry={runAudit} /> : null}

        <section aria-labelledby="snapshot-heading">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <h2 id="snapshot-heading" className="eyebrow">
              Snapshot
            </h2>
            <span className="hidden font-hand text-[19px] leading-none text-ink-faint sm:inline">
              the honest numbers
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Stat
              label="Active findings"
              value={formatNumber(activeFindings)}
              hint={
                hasAudit
                  ? `${formatNumber(totalFindings)} all-time · last audit ${relativeTime(repository.last_audit_at)}`
                  : "no audit yet"
              }
              emphasis={hasAudit}
            />
            <Stat
              label="Verified"
              value={formatNumber(verifiedCount)}
              hint="supported by deterministic evidence"
            />
            <Stat
              label="Files indexed"
              value={formatNumber(data.file_count)}
              hint={`${data.docs_found} documentation files`}
            />
            <Stat
              label="API routes"
              value={formatNumber(data.routes.length)}
              hint="statically discoverable"
            />
          </div>
        </section>

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
              subtitle="Status reflects how strongly the evidence supports a finding, not how serious it is."
              actions={
                <Link
                  to={`/r/${repository.id}/findings`}
                  className="inline-flex h-8 items-center gap-1.5 rounded-full border border-line px-3 text-[12px] font-medium text-ink-muted transition-colors hover:border-line-strong hover:text-ink"
                >
                  View findings
                  <svg
                    viewBox="0 0 16 16"
                    className="h-3 w-3"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="m6 4 4 4-4 4" />
                  </svg>
                </Link>
              }
            />
            <div className="grid grid-cols-2 gap-px bg-line sm:grid-cols-3 lg:grid-cols-5">
              {STATUS_ORDER.map((status) => (
                <Link
                  key={status}
                  to={`/r/${repository.id}/findings?status=${status}`}
                  className="group bg-surface px-5 py-4 transition-colors hover:bg-surface-elevated"
                >
                  <StatusBadge status={status} />
                  <p className="mt-3 font-display text-[27px] font-semibold leading-none tabular-nums tracking-[-0.03em] text-ink">
                    {formatNumber(byStatus[status] ?? 0)}
                  </p>
                </Link>
              ))}
            </div>
          </Card>
        )}

        <div className="grid gap-6 xl:grid-cols-2">
          <Card padded={false} className="overflow-hidden">
            <CardHeader title="Detected languages" />
            {Object.keys(data.languages).length ? (
              <ul className="divide-y divide-line">
                {Object.entries(data.languages)
                  .sort(([, a], [, b]) => b - a)
                  .map(([language, count]) => (
                    <li key={language} className="px-5 py-3">
                      <div className="flex items-center justify-between gap-3 text-[13px]">
                        <span className="truncate text-ink">{language}</span>
                        <span className="shrink-0 font-mono text-2xs text-ink-muted">
                          {formatNumber(count)} files
                        </span>
                      </div>
                      <div className="mt-2 h-1 overflow-hidden rounded-full bg-subtle">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-ink/70 to-ink/20"
                          style={{ width: `${Math.max(2, Math.round((count / maxLanguage) * 100))}%` }}
                        />
                      </div>
                    </li>
                  ))}
              </ul>
            ) : (
              <p className="body-text px-5 py-4">No supported languages were detected.</p>
            )}
          </Card>

          <Card padded={false} className="overflow-hidden">
            <CardHeader title="Documentation files" />
            <ul className="scroll-region max-h-72 divide-y divide-line overflow-y-auto">
              {data.doc_files.length ? (
                data.doc_files.map((path) => (
                  <li key={path} className="px-5 py-2.5 font-mono text-2xs text-ink-muted">
                    {path}
                  </li>
                ))
              ) : (
                <li className="px-5 py-4 text-[13px] text-ink-muted">
                  No documentation files were indexed.
                </li>
              )}
            </ul>
          </Card>
        </div>

        <Card padded={false} className="overflow-hidden">
          <CardHeader
            title="Statically discovered API routes"
            subtitle="Read from source, without running the application."
          />
          {data.routes.length ? (
            <div className="scroll-region overflow-x-auto">
              <table className="w-full border-collapse text-[13px]">
                <thead>
                  <tr className="border-b border-line bg-subtle text-left font-mono text-2xs uppercase tracking-[0.1em] text-ink-faint">
                    <th className="px-5 py-2.5 font-medium">Method</th>
                    <th className="px-5 py-2.5 font-medium">Path</th>
                    <th className="px-5 py-2.5 font-medium">Handler</th>
                    <th className="px-5 py-2.5 font-medium">Location</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {data.routes.map((route) => (
                    <tr
                      key={`${route.method}-${route.path}-${route.start_line}`}
                      className="transition-colors hover:bg-surface-elevated/60"
                    >
                      <td className="whitespace-nowrap px-5 py-2.5 font-mono text-2xs text-accent-strong">
                        {route.method}
                      </td>
                      <td className="whitespace-nowrap px-5 py-2.5 font-mono text-2xs text-ink">
                        {route.path}
                      </td>
                      <td className="whitespace-nowrap px-5 py-2.5 font-mono text-2xs text-ink-muted">
                        {route.handler}
                      </td>
                      <td className="whitespace-nowrap px-5 py-2.5 font-mono text-2xs text-ink-faint">
                        {route.file}:{route.start_line}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="body-text px-5 py-4">
              No routes were discoverable. Route comparison is reported as inconclusive rather than
              clean.
            </p>
          )}
        </Card>

        <div className="grid gap-6 xl:grid-cols-2">
          <Card padded={false} className="overflow-hidden">
            <CardHeader
              title="Checks and coverage"
              subtitle="Every check reports its own result. Unrun checks are never counted as clean."
            />
            <ul className="divide-y divide-line">
              {data.checks_supported.map((checkId) => (
                <li key={checkId} className="flex items-center justify-between gap-4 px-5 py-2.5">
                  <span className="flex min-w-0 items-center gap-2 text-[13px] text-ink">
                    <svg
                      viewBox="0 0 16 16"
                      className="h-3 w-3 shrink-0 text-accent-strong"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M3 8.5 6.5 12 13 4.5" />
                    </svg>
                    <span className="truncate">{checkLabel(checkId)}</span>
                  </span>
                  <span className="truncate font-mono text-2xs text-ink-faint">{checkId}</span>
                </li>
              ))}
            </ul>
          </Card>

          <Card padded={false} className="overflow-hidden">
            <CardHeader
              title="Limitations"
              subtitle="Files or checks that could not be evaluated are reported, not guessed."
            />
            {data.limitations.length || data.routes_prefix_unresolved ? (
              <ul className="scroll-region max-h-72 divide-y divide-line overflow-y-auto">
                {data.routes_prefix_unresolved ? (
                  <li className="flex gap-2.5 px-5 py-3 text-2xs leading-5 text-ink-muted">
                    <span
                      aria-hidden="true"
                      className="mt-2 h-1 w-1 shrink-0 rounded-full bg-warn"
                    />
                    <span>
                      At least one router prefix could not be resolved statically, so the route list
                      above is incomplete. Documented routes that are not listed are reported as
                      insufficient evidence, never as missing.
                    </span>
                  </li>
                ) : null}
                {data.limitations.map((limitation, index) => (
                  <li
                    key={index}
                    className="flex gap-2.5 px-5 py-3 text-2xs leading-5 text-ink-muted"
                  >
                    <span
                      aria-hidden="true"
                      className="mt-2 h-1 w-1 shrink-0 rounded-full bg-warn"
                    />
                    <span>{limitation}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="body-text px-5 py-4">
                The most recent scan did not report any limitations.
              </p>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
