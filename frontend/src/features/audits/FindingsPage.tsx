import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import { api } from "../../lib/api";
import { useShell } from "../../lib/shell";
import { useAsync } from "../../lib/useAsync";
import { usePageTitle } from "../../lib/usePageTitle";
import FindingCard from "../../components/findings/FindingCard";
import FilterBar from "../../components/findings/FilterBar";
import type { FindingFilters } from "../../components/findings/FilterBar";
import { Button, EmptyState, ErrorNotice, PageHeader, Spinner } from "../../components/ui/Primitives";

const EMPTY_FILTERS: FindingFilters = { status: "", severity: "", checkId: "", q: "" };

const URL_STATUSES = [
  "verified",
  "needs_review",
  "insufficient_evidence",
  "resolved",
  "dismissed",
] as const;

export default function FindingsPage() {
  const { repository } = useShell();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlQuery = searchParams.get("q") ?? "";
  const urlStatus = searchParams.get("status") ?? "";
  const initialStatus = (URL_STATUSES as readonly string[]).includes(urlStatus) ? urlStatus : "";
  const [filters, setFilters] = useState<FindingFilters>({
    ...EMPTY_FILTERS,
    q: urlQuery,
    status: initialStatus,
  });
  const [appliedQuery, setAppliedQuery] = useState(urlQuery);
  const [cursor, setCursor] = useState<string | null>(null);
  const [history, setHistory] = useState<Array<string | null>>([]);
  const filtersRef = useRef(filters);
  filtersRef.current = filters;
  usePageTitle(`${repository.name} findings`);

  // The global search and the overview status tiles navigate here with ?q= and
  // ?status=, including while this page is already mounted. Adopt the URL state
  // as the source of truth so a reload or a shared link restores the same view.
  // Other filters are local-only, so an external search resets them. Apply the
  // incoming query immediately so the previous query is never re-requested
  // against the new filters in between.
  useEffect(() => {
    const nextStatus = (URL_STATUSES as readonly string[]).includes(urlStatus) ? urlStatus : "";
    const current = filtersRef.current;
    if (current.q === urlQuery && current.status === nextStatus) return;
    setFilters({ ...EMPTY_FILTERS, q: urlQuery, status: nextStatus });
    setAppliedQuery(urlQuery);
    setCursor(null);
    setHistory([]);
  }, [urlQuery, urlStatus]);

  // Keep the address bar in step with user-driven filter changes. `replace`
  // avoids filling history with one entry per keystroke. External navigations
  // (global search, overview tiles) are handled by the adoption effect above,
  // so they can never be overwritten by a stale local filter update.
  function updateFilters(next: FindingFilters) {
    setFilters(next);
    const params = new URLSearchParams();
    if (next.q) params.set("q", next.q);
    if (next.status) params.set("status", next.status);
    setSearchParams(params, { replace: true });
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setAppliedQuery(filters.q);
      setCursor(null);
      setHistory([]);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [filters.q]);

  useEffect(() => {
    setCursor(null);
    setHistory([]);
  }, [filters.status, filters.severity, filters.checkId]);

  const page = useAsync(
    () =>
      api.findings(repository.id, {
        status: filters.status || undefined,
        severity: filters.severity || undefined,
        checkId: filters.checkId || undefined,
        q: appliedQuery || undefined,
        cursor: cursor ?? undefined,
      }),
    [repository.id, filters.status, filters.severity, filters.checkId, appliedQuery, cursor],
  );

  const hasAudit = repository.last_audit_at !== null;

  return (
    <div>
      <PageHeader
        title="Audit findings"
        subtitle="Severity is likely impact. Status is how strongly the evidence supports the finding. They are independent."
        meta={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-mono text-ink">{repository.name}</span>
            <span aria-hidden="true" className="text-line-strong">
              ·
            </span>
            <span className="font-mono">{repository.id}</span>
          </span>
        }
      />

      <FilterBar filters={filters} onChange={updateFilters} total={page.state.data?.total ?? 0} />

      <div className="space-y-3 p-4 sm:p-6 lg:p-8">
        {page.state.status === "loading" ? (
          <div className="flex items-center gap-2 text-[13px] text-ink-muted">
            <Spinner className="text-accent-strong" /> Loading findings…
          </div>
        ) : null}

        {page.state.status === "error" && page.state.error ? (
          <ErrorNotice error={page.state.error} onRetry={page.reload} />
        ) : null}

        {page.state.status === "success" && page.state.data ? (
          page.state.data.items.length ? (
            <>
              {page.state.data.items.map((finding) => (
                <FindingCard
                  key={finding.id}
                  finding={finding}
                  onOpen={() => navigate(`/r/${repository.id}/findings/${finding.id}`)}
                />
              ))}

              <div className="flex items-center justify-between pt-2">
                <Button
                  disabled={history.length === 0}
                  onClick={() => {
                    const previous = history[history.length - 1];
                    setHistory(history.slice(0, -1));
                    setCursor(previous);
                  }}
                >
                  Previous
                </Button>
                <span className="text-2xs text-ink-faint">Page size 50</span>
                <Button
                  disabled={!page.state.data.next_cursor}
                  onClick={() => {
                    setHistory([...history, cursor]);
                    setCursor(page.state.data?.next_cursor ?? null);
                  }}
                >
                  Next
                </Button>
              </div>
            </>
          ) : hasAudit ? (
            <EmptyState
              icon="doc"
              title="No findings match these filters"
              body="Clear the filters to see every finding from the last audit, or run a new audit to re-check the current snapshot."
              action={
                <Button onClick={() => updateFilters(EMPTY_FILTERS)}>Clear filters</Button>
              }
            />
          ) : (
            <EmptyState
              icon="spark"
              title="No audit has run for this repository yet"
              body="Run an audit from the repository overview to check internal links, routes, configuration references, and documentation rules."
              action={
                <Link
                  to={`/r/${repository.id}`}
                  className="inline-flex h-9 items-center rounded-control bg-accent px-4 text-[13px] font-semibold text-[#03140a] transition-all hover:bg-accent-hover"
                >
                  Go to overview
                </Link>
              }
            />
          )
        ) : null}
      </div>
    </div>
  );
}