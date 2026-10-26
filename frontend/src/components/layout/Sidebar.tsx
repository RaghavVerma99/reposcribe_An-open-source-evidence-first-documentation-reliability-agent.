import type { ReactNode } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";

import { cn } from "../../lib/format";

const iconProps = {
  viewBox: "0 0 16 16",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  className: "h-[15px] w-[15px]",
};

const ICONS: Record<string, ReactNode> = {
  home: (
    <svg {...iconProps} aria-hidden="true">
      <path d="M2.5 7.2 8 2.7l5.5 4.5V13a1 1 0 0 1-1 1H10V10H6v4H3.5a1 1 0 0 1-1-1Z" />
    </svg>
  ),
  findings: (
    <svg {...iconProps} aria-hidden="true">
      <path d="M3 3.5h7l3 3V12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z" />
      <circle cx="6" cy="9" r="1.25" />
      <path d="m7.6 10.5 2.4 2.4" />
    </svg>
  ),
  ask: (
    <svg {...iconProps} aria-hidden="true">
      <path d="M3 3.25h10a1.25 1.25 0 0 1 1.25 1.25v5A1.25 1.25 0 0 1 13 10.75H7.5L4 13.5v-2.75H3A1.25 1.25 0 0 1 1.75 9.5v-5A1.25 1.25 0 0 1 3 3.25Z" />
    </svg>
  ),
  settings: (
    <svg {...iconProps} aria-hidden="true">
      <circle cx="8" cy="8" r="2" />
      <path d="M8 1.6v2.2M8 12.2v2.2M14.4 8h-2.2M3.8 8H1.6M12.7 3.3l-1.6 1.6M4.9 11.1l-1.6 1.6M12.7 12.7l-1.6-1.6M4.9 4.9 3.3 3.3" />
    </svg>
  ),
};

type NavItem = {
  to: string;
  label: string;
  icon: string;
  end?: boolean;
};

function sidebarItems(repositoryId: string): NavItem[] {
  return [
    { to: `/r/${repositoryId}`, label: "Overview", icon: "home", end: true },
    { to: `/r/${repositoryId}/findings`, label: "Findings", icon: "findings" },
    { to: `/r/${repositoryId}/ask`, label: "Ask RepoScribe", icon: "ask" },
    { to: `/r/${repositoryId}/settings`, label: "Settings", icon: "settings" },
  ];
}

function BrandMark({ size = 34 }: { size?: number }) {
  return (
    <div
      aria-hidden="true"
      style={{ width: size, height: size }}
      className="relative grid shrink-0 place-items-center rounded-[11px] border border-line bg-ink text-canvas shadow-[inset_0_1px_0_rgba(255,255,255,0.4)]"
    >
      <span className="font-display text-[12px] font-extrabold tracking-[-0.06em]">RS</span>
      <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full border-2 border-canvas bg-accent" />
    </div>
  );
}

function NavRow({
  item,
  forceActive = false,
  onNavigate,
}: {
  item: NavItem;
  forceActive?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          "group relative flex items-center gap-2.5 rounded-control px-2.5 py-2 text-[13px] font-medium transition-colors duration-150",
          isActive || forceActive
            ? "bg-subtle text-ink"
            : "text-ink-muted hover:bg-surface hover:text-ink",
        )
      }
    >
      {({ isActive }) => (
        <>
          <span
            aria-hidden="true"
            className={cn(
              "absolute inset-y-1.5 left-0 w-[2px] rounded-full bg-accent transition-opacity duration-150",
              isActive || forceActive ? "opacity-100" : "opacity-0",
            )}
          />
          <span
            className={cn(
              "shrink-0 transition-colors",
              isActive || forceActive ? "text-accent-strong" : "text-ink-faint group-hover:text-ink-muted",
            )}
          >
            {ICONS[item.icon]}
          </span>
          <span className="truncate">{item.label}</span>
        </>
      )}
    </NavLink>
  );
}

export default function Sidebar({
  repositoryId,
  repositoryName,
  repositorySource,
  onNavigate,
}: {
  repositoryId: string;
  repositoryName: string;
  repositorySource: "sample" | "upload";
  onNavigate?: () => void;
}) {
  const location = useLocation();
  const isPatch = location.pathname.includes("/patches/");
  const items = sidebarItems(repositoryId);

  return (
    <div className="flex h-full w-[252px] shrink-0 flex-col border-r border-line bg-canvas">
      <div className="flex items-center gap-2.5 px-4 pb-4 pt-5">
        <BrandMark />
        <div className="min-w-0">
          <p className="truncate font-display text-[15px] font-semibold tracking-[-0.02em] text-ink">
            RepoScribe
          </p>
          <p className="truncate font-mono text-2xs uppercase tracking-[0.1em] text-ink-faint">
            Documentation reliability
          </p>
        </div>
      </div>

      <div className="px-3 pb-4">
        <Link
          to={`/r/${repositoryId}`}
          onClick={onNavigate}
          className="group block rounded-xl border border-line bg-surface/60 p-3 transition-colors hover:border-line-strong hover:bg-surface"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="eyebrow">Workspace</span>
            <span className="relative flex h-1.5 w-1.5" aria-hidden="true">
              <span className="absolute inset-0 rounded-full bg-accent" />
              <span className="pulse-dot text-accent" />
            </span>
          </div>
          <p className="mt-1.5 truncate text-[13.5px] font-medium leading-5 text-ink">
            {repositoryName}
          </p>
          <p className="mt-0.5 truncate text-2xs text-ink-faint">
            {repositorySource === "sample" ? "Bundled sample" : "Uploaded ZIP"}
            <span aria-hidden="true" className="mx-1 text-line-strong">
              ·
            </span>
            read-only
          </p>
        </Link>
      </div>

      <nav aria-label="Primary" className="flex-1 px-2.5">
        <p className="px-2.5 pb-2 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint">
          Repository
        </p>
        <div className="space-y-0.5">
          {items.map((item) => (
            <NavRow
              key={item.label}
              item={item}
              forceActive={isPatch && item.icon === "findings"}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      </nav>

      <div className="border-t border-line px-3 py-3">
        <Link
          to="/"
          onClick={onNavigate}
          className="flex items-center gap-2 rounded-control px-2.5 py-2 text-[12.5px] font-medium text-ink-muted transition-colors hover:bg-surface hover:text-ink"
        >
          <svg
            viewBox="0 0 16 16"
            className="h-3.5 w-3.5 text-ink-faint"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M8 3.5v9M3.5 8h9" />
          </svg>
          New repository
        </Link>
        <p className="mt-3 px-2.5 font-hand text-[18px] leading-none text-ink-faint">
          read-only by design
        </p>
      </div>
    </div>
  );
}
