import type { ReactNode } from "react";

import { cn } from "../../lib/format";
import GlobalSearch from "./GlobalSearch";

interface Props {
  left?: ReactNode;
  right?: ReactNode;
  rightMeta?: ReactNode;
  className?: string;
}

/** Thin, sticky global top bar. The reference places only search and an avatar here. */
export default function TopBar({ left, right, rightMeta, className }: Props) {
  return (
    <div
      className={cn(
        "sticky top-0 z-30 h-14 border-b border-line bg-canvas/80 backdrop-blur-xl",
        className,
      )}
    >
      <div className="flex h-full items-center gap-3 px-4 lg:px-6">
        <div className="hidden flex-1 items-center gap-3 lg:flex">{left}</div>
        <GlobalSearch />
        <div className="hidden shrink-0 items-center gap-2 lg:flex">{rightMeta}</div>
        <div className="shrink-0">{right}</div>
      </div>
    </div>
  );
}