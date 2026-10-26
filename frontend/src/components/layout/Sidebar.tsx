import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";

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
  analyze: (
    <svg {...iconProps} aria-hidden="true">
      <circle cx="7" cy="7" r="4.5" />
      <path d="m10 10 3.5 3.5" />
    </svg>
  ),
  repository: (
    <svg {...iconProps} aria-hidden="true">
      <path d="M2 4.5a1.5 1.5 0 0 1 1.5-1.5h9A1.5 1.5 0 0 1 14 4.5v7a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 11.5Z" />
      <path d="M5 8.5h6" />
    </svg>
  ),
  findings: (
    <svg {...iconProps} aria-hidden="true">
      <path d="M3 3.5h7l3 3V12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z" />
      <circle cx="6" cy="9" r="1.25" />
      <path d="m7.6 10.5 2.4 2.4" />
    </svg>
  ),
  patches: (
    <svg {...iconProps} aria-hidden="true">
      <path d="M3 12V4.5a1.5 1.5 0 0 1 1.5-1.5h7A1.5 1.5 0 0 1 13 4.5V12" />
      <path d="M3 12h10v2.5H3Z" />
      <path d="M6 7.5h4" />
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

export type SidebarNavItem = NavItem;

const NAV_ITEMS: NavItem[] = [
  { to: "/", label: "Home", icon: "home", end: true },
  { to: "/analyze", label: "Analyze", icon: "analyze" },
  { to: "/repositories", label: "Repositories", icon: "repository" },
  { to: "/findings", label: "Findings", icon: "findings" },
  { to: "/patches", label: "Patches", icon: "patches" },
  { to: "/settings", label: "Settings", icon: "settings" },
];

function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <div
      aria-hidden="true"
      style={{ width: size, height: size }}
      className="relative grid place-items-center overflow-hidden rounded-[9px] bg-accent text-[12px] font-semibold tracking-[-0.04em] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_0_22px_-8px_rgba(124,127,245,0.85)]"
    >
      <span className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.18),transparent_45%)]" />
      <span className="relative">RS</span>
    </div>
  );
}

function NavRow({ item }: { item: NavItem }) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        cn(
          "relative flex items-center gap-2.5 rounded-control px-2.5 py-1.5 text-[13px] font-medium transition-colors duration-150",
          isActive
            ? "bg-accent-soft text-accent-strong hairline"
            : "text-ink-muted hover:bg-subtle hover:text-ink",
        )
      }
    >
      {({ isActive }) => (
        <>
          <span
            aria-hidden="true"
            className={cn(
              "absolute inset-y-1 left-0 w-[2px] rounded-full bg-accent-glow transition-opacity duration-150",
              isActive ? "opacity-100" : "opacity-0",
            )}
          />
          <span className={cn("shrink-0", isActive ? "text-accent-strong" : "text-ink-faint")}>
            {ICONS[item.icon]}
          </span>
          {item.label}
        </>
      )}
    </NavLink>
  );
}

function UserFooter({ name, onSignOut }: { name: string; onSignOut?: () => void }) {
  return (
    <button
      type="button"
      onClick={onSignOut}
      className="group flex w-full items-center gap-2.5 rounded-control px-2 py-1.5 text-left transition-colors hover:bg-subtle"
    >
      <span
        aria-hidden="true"
        className="grid h-7 w-7 place-items-center rounded-full bg-accent-soft text-[11px] font-semibold text-accent-strong"
      >
        R
      </span>
      <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink">{name}</span>
      <svg
        viewBox="0 0 16 16"
        className="h-3.5 w-3.5 text-ink-faint transition-transform group-hover:text-ink"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M4 6.5 8 10.5l4-4" />
      </svg>
    </button>
  );
}

export default function Sidebar({
  userName = "Raghav",
  onSignOut,
}: {
  onNavigate?: () => void;
  userName?: string;
  onSignOut?: () => void;
}) {
  return (
    <div className="flex h-full w-[240px] shrink-0 flex-col border-r border-line bg-surface shadow-rail">
      <div className="flex items-center gap-2.5 px-4 py-5">
        <BrandMark />
        <div className="min-w-0">
          <p className="truncate text-[13.5px] font-semibold tracking-[-0.005em] text-ink">
            RepoScribe
          </p>
          <p className="truncate text-2xs text-ink-faint">Documentation reliability</p>
        </div>
      </div>

      <nav aria-label="Primary" className="flex-1 space-y-0.5 px-2.5">
        {NAV_ITEMS.map((item) => (
          <NavRow key={item.label} item={item} />
        ))}
      </nav>

      <div className="border-t border-line px-2.5 py-3">
        <UserFooter name={userName} onSignOut={onSignOut} />
      </div>
    </div>
  );
}

export { NAV_ITEMS };