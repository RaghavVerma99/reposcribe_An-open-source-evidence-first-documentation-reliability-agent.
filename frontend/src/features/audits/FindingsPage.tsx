import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { api } from "../../lib/api";
import { useShell } from "../../lib/shell";
import { useAsync } from "../../lib/useAsync";
import FindingCard from "../../components/findings/FindingCard";
import FilterBar from "../../components/findings/FilterBar";
import type { FindingFilters } from "../../components/findings/FilterBar";
import { Button, EmptyState, ErrorNotice, PageHeader, Spinner } from "../../components/ui/Primitives";

const EMPTY_FILTERS: FindingFilters = { status: "", severity: "", checkId: "", q: "" };

export default function FindingsPage() {
  const { repository } = useShell();
  const navigate = useNavigate();
  const [filters, setFilters] = useState<FindingFilters>(EMPTY_FILTERS);
  const [appliedQuery, setAppliedQuery] = useState("");
  const [cursor, setCursor] = useState<string | null>(null);
  const [history, setHistory] = useState<Array<string | null>>([]);

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

      <FilterBar filters={filters} onChange={setFilters} total={page.state.data?.total ?? 0} />

      <div className="space-y-3 p-6">
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
                <Button onClick={() => setFilters(EMPTY_FILTERS)}>Clear filters</Button>
              }
            />
          ) : (
            <EmptyState
              icon="spark"
              title="No audit has run for this repository yet"
              body="Run an audit from the top bar to check internal links, routes, configuration references, and documentation rules."
              action={
                <Link
                  to={`/r/${repository.id}`}
                  className="inline-flex h-8 items-center rounded-control bg-accent px-3 text-[13px] font-medium text-white transition-all hover:bg-accent-hover hover:shadow-glow"
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