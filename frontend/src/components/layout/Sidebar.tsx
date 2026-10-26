import type { ReactNode } from "react";
import { Link, NavLink } from "react-router-dom";

import { cn } from "../../lib/format";

const iconProps = {
  viewBox: "0 0 16 16",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.4,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  className: "h-[15px] w-[15px]",
};

const ICONS: Record<string, ReactNode> = {
  overview: (
    <svg {...iconProps} aria-hidden="true">
      <rect x="2" y="2" width="5" height="5" rx="1.2" />
      <rect x="9" y="2" width="5" height="5" rx="1.2" />
      <rect x="2" y="9" width="5" height="5" rx="1.2" />
      <rect x="9" y="9" width="5" height="5" rx="1.2" />
    </svg>
  ),
  findings: (
    <svg {...iconProps} aria-hidden="true">
      <path d="M2.5 4h7M2.5 8h7M2.5 12h4.5" />
      <circle cx="12" cy="10.5" r="2.6" />
      <path d="m14 12.5 1.4 1.4" />
    </svg>
  ),
  ask: (
    <svg {...iconProps} aria-hidden="true">
      <path d="M13.5 9.2a2.3 2.3 0 0 1-2.3 2.3H6.4L3 14V4.3A2.3 2.3 0 0 1 5.3 2h5.9a2.3 2.3 0 0 1 2.3 2.3Z" />
    </svg>
  ),
  settings: (
    <svg {...iconProps} aria-hidden="true">
      <path d="M2.5 5h6M11.5 5H13.5M2.5 11h2M7.5 11h6" />
      <circle cx="10" cy="5" r="1.6" />
      <circle cx="6" cy="11" r="1.6" />
    </svg>
  ),
};

const NAV_ITEMS = [
  { to: "", label: "Overview", icon: "overview", end: true },
  { to: "findings", label: "Findings", icon: "findings" },
  { to: "ask", label: "Ask", icon: "ask" },
  { to: "settings", label: "Settings", icon: "settings" },
];

export default function Sidebar({
  repositoryId,
  repositoryName,
  onNavigate,
}: {
  repositoryId: string;
  repositoryName: string | null;
  onNavigate?: () => void;
}) {
  return (
    <div className="flex h-full w-[260px] shrink-0 flex-col border-r border-line bg-surface">
      <div className="flex items-center gap-3 px-5 py-5">
        <span
          aria-hidden="true"
          className="grid h-7 w-7 place-items-center rounded-[8px] bg-accent text-[12px] font-bold text-white shadow-[0_0_24px_-8px_rgba(99,102,241,0.95)]"
        >
          R
        </span>
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold tracking-tight text-ink">RepoScribe</p>
          <p className="truncate text-2xs text-ink-faint">Documentation that doesn&apos;t lie</p>
        </div>
      </div>

      <div className="mx-3 mb-5 rounded-control border border-line bg-subtle/70 px-3 py-2.5">
        <p className="text-2xs font-medium uppercase tracking-[0.08em] text-ink-faint">Repository</p>
        <p className="mt-1 truncate text-[13px] font-medium text-ink" title={repositoryName ?? repositoryId}>
          {repositoryName ?? "loading…"}
        </p>
        <p className="mt-0.5 truncate font-mono text-2xs text-ink-faint">{repositoryId}</p>
      </div>

      <nav aria-label="Repository sections" className="flex-1 space-y-1 px-3">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.label}
            to={item.to ? `/r/${repositoryId}/${item.to}` : `/r/${repositoryId}`}
            end={item.end}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                "relative flex items-center gap-2.5 rounded-control px-3 py-2 text-[13px] font-medium transition-colors duration-150",
                isActive
                  ? "bg-subtle text-ink"
                  : "text-ink-muted hover:bg-subtle/60 hover:text-ink",
              )
            }
          >
            {({ isActive }) => (
              <>
                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute left-0 top-1/2 h-4 w-[2px] -translate-y-1/2 rounded-full transition-opacity",
                    isActive ? "bg-accent opacity-100" : "opacity-0",
                  )}
                />
                <span className={cn("shrink-0", isActive ? "text-accent-strong" : "text-ink-faint")}>
                  {ICONS[item.icon]}
                </span>
                {item.label}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-line px-5 py-4">
        <Link
          to="/"
          className="group inline-flex items-center gap-1.5 text-2xs font-medium text-ink-muted transition-colors hover:text-ink"
        >
          <svg
            viewBox="0 0 16 16"
            className="h-3 w-3 transition-transform duration-150 group-hover:-translate-x-0.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M10 12 6 8l4-4" />
          </svg>
          Change repository
        </Link>
      </div>
    </div>
  );
}