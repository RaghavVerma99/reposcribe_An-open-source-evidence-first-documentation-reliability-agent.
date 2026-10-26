import { cn } from "../../lib/format";

interface Props {
  name?: string;
  className?: string;
}

function initials(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  const parts = trimmed.split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("");
}

/** A small avatar circle (initials) used in the top-right of the global top bar. */
export default function Avatar({ name = "Raghav", className }: Props) {
  return (
    <button
      type="button"
      title={name}
      aria-label={name}
      className={cn(
        "grid h-7 w-7 place-items-center rounded-full bg-accent-soft text-[11px] font-semibold text-accent-strong ring-1 ring-accent/40 transition-all hover:ring-accent/70",
        className,
      )}
    >
      {initials(name) || "R"}
    </button>
  );
}