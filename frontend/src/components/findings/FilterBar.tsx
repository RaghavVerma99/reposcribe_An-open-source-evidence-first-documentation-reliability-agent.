import { CHECK_LABELS } from "../../lib/format";

export interface FindingFilters {
  status: string;
  severity: string;
  checkId: string;
  q: string;
}

const FIELD =
  "mt-1.5 h-9 w-full rounded-control border border-line bg-surface px-3 text-[13px] text-ink transition-colors placeholder:text-ink-faint hover:border-line-strong focus:border-accent/45 focus:bg-surface-elevated";
const LABEL =
  "block font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-ink-faint";

export default function FilterBar({
  filters,
  onChange,
  total,
}: {
  filters: FindingFilters;
  onChange: (next: FindingFilters) => void;
  total: number;
}) {
  function update(patch: Partial<FindingFilters>) {
    onChange({ ...filters, ...patch });
  }

  const hasFilters = Boolean(filters.status || filters.severity || filters.checkId || filters.q);

  return (
    <div className="grid gap-3 border-b border-line bg-canvas/90 px-4 py-4 backdrop-blur-xl sm:grid-cols-2 sm:px-6 lg:sticky lg:top-14 lg:z-20 lg:grid-cols-[minmax(200px,1fr)_150px_140px_180px_auto] lg:items-end lg:px-8">
      <div>
        <label htmlFor="finding-search" className={LABEL}>
          Search
        </label>
        <input
          id="finding-search"
          type="search"
          value={filters.q}
          maxLength={200}
          placeholder="Title, summary, or path"
          onChange={(event) => update({ q: event.target.value })}
          className={FIELD}
        />
      </div>

      <div>
        <label htmlFor="filter-status" className={LABEL}>
          Status
        </label>
        <select
          id="filter-status"
          value={filters.status}
          onChange={(event) => update({ status: event.target.value })}
          className={FIELD}
        >
          <option value="">All</option>
          <option value="verified">Verified</option>
          <option value="needs_review">Needs review</option>
          <option value="insufficient_evidence">Insufficient evidence</option>
          <option value="resolved">Resolved</option>
          <option value="dismissed">Dismissed</option>
        </select>
      </div>

      <div>
        <label htmlFor="filter-severity" className={LABEL}>
          Severity
        </label>
        <select
          id="filter-severity"
          value={filters.severity}
          onChange={(event) => update({ severity: event.target.value })}
          className={FIELD}
        >
          <option value="">All</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
          <option value="info">Info</option>
        </select>
      </div>

      <div>
        <label htmlFor="filter-check" className={LABEL}>
          Check
        </label>
        <select
          id="filter-check"
          value={filters.checkId}
          onChange={(event) => update({ checkId: event.target.value })}
          className={FIELD}
        >
          <option value="">All</option>
          {Object.entries(CHECK_LABELS).map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center justify-between gap-3 lg:justify-end lg:pb-1.5">
        <p className="text-2xs text-ink-faint">
          <span className="font-mono text-ink-muted">{total}</span> finding
          {total === 1 ? "" : "s"}
        </p>
        {hasFilters ? (
          <button
            type="button"
            onClick={() => onChange({ status: "", severity: "", checkId: "", q: "" })}
            className="inline-flex h-7 items-center rounded-full border border-line px-2.5 text-[11px] font-medium text-ink-muted transition-colors hover:border-line-strong hover:text-ink"
          >
            Clear
          </button>
        ) : null}
      </div>
    </div>
  );
}
