import { CHECK_LABELS } from "../../lib/format";

export interface FindingFilters {
  status: string;
  severity: string;
  checkId: string;
  q: string;
}

const FIELD =
  "mt-1 h-8 w-full rounded-control border border-line bg-subtle px-2.5 text-[13px] text-ink transition-colors placeholder:text-ink-faint hover:border-line-strong focus:border-accent/70";
const LABEL = "block text-2xs font-medium uppercase tracking-[0.08em] text-ink-faint";

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

  return (
    <div className="flex flex-wrap items-end gap-3 border-b border-line bg-canvas px-6 py-4">
      <div className="min-w-[220px] flex-1">
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

      <div className="min-w-[130px]">
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

      <div className="min-w-[110px]">
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

      <div className="min-w-[150px]">
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

      <p className="pb-2 text-2xs text-ink-faint">
        <span className="font-mono text-ink-muted">{total}</span> finding{total === 1 ? "" : "s"}
      </p>
    </div>
  );
}