import { useEffect, useState, type ReactNode } from "react";
import { Link, useLocation, useParams } from "react-router-dom";

import { cn } from "../../lib/format";
import type { ProviderMode } from "../../lib/types";
import { ProviderPill } from "../ui/Primitives";
import GlobalSearch from "./GlobalSearch";

interface Props {
  left?: ReactNode;
  repositoryName: string;
  providerMode?: ProviderMode | null;
  providerMessage?: string;
  onSearch?: (query: string) => void;
  className?: string;
}

function sectionLabel(pathname: string) {
  if (pathname.includes("/findings/")) return "finding";
  if (pathname.endsWith("/findings")) return "findings";
  if (pathname.includes("/patches/")) return "patch";
  if (pathname.endsWith("/ask")) return "ask";
  if (pathname.endsWith("/settings")) return "settings";
  return "overview";
}

/** Thin, sticky global bar: workspace breadcrumb, findings search, provider state. */
export default function TopBar({
  left,
  repositoryName,
  providerMode,
  providerMessage,
  onSearch,
  className,
}: Props) {
  const location = useLocation();
  const { repositoryId = "" } = useParams();
  const section = sectionLabel(location.pathname);
  const [searchValue, setSearchValue] = useState("");

  // Reflect the active findings query, including when the URL changes from a
  // link or the back button rather than from this input.
  useEffect(() => {
    setSearchValue(new URLSearchParams(location.search).get("q") ?? "");
  }, [location.search]);

  return (
    <div
      className={cn(
        "sticky top-0 z-30 border-b border-line bg-canvas/85 backdrop-blur-xl",
        className,
      )}
    >
      <div className="flex h-14 items-center gap-2.5 px-3 sm:gap-3 sm:px-4 lg:px-6">
        {left ? <div className="flex shrink-0 items-center">{left}</div> : null}

        <div className="hidden min-w-0 shrink-0 items-center gap-2 lg:flex">
          <Link
            to={`/r/${repositoryId}`}
            className="max-w-[180px] truncate font-display text-[13.5px] font-semibold tracking-[-0.01em] text-ink transition-colors hover:text-accent-strong"
          >
            {repositoryName}
          </Link>
          <span aria-hidden="true" className="font-mono text-[11px] text-line-strong">
            /
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint">
            {section}
          </span>
        </div>

        <div className="flex min-w-0 flex-1 items-center justify-center px-1 sm:px-2">
          <GlobalSearch
            className="max-w-[420px]"
            value={searchValue}
            onChange={setSearchValue}
            onSubmit={onSearch}
          />
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <ProviderPill
            mode={providerMode}
            message={providerMessage}
            className="hidden md:inline-flex"
          />
          <Link
            to={`/r/${repositoryId}/settings`}
            aria-label="Workspace settings"
            title="Workspace settings"
            className="grid h-9 w-9 place-items-center rounded-control border border-line bg-surface text-ink-muted transition-colors hover:border-line-strong hover:bg-surface-elevated hover:text-ink"
          >
            <svg
              viewBox="0 0 16 16"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <circle cx="8" cy="8" r="2" />
              <path d="M8 1.6v2.2M8 12.2v2.2M14.4 8h-2.2M3.8 8H1.6M12.7 3.3l-1.6 1.6M4.9 11.1l-1.6 1.6M12.7 12.7l-1.6-1.6M4.9 4.9 3.3 3.3" />
            </svg>
          </Link>
        </div>
      </div>
    </div>
  );
}
