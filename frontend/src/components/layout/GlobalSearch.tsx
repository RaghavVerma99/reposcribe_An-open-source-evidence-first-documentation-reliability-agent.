import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";

import { cn } from "../../lib/format";

export interface GlobalSearchHandle {
  focus: () => void;
}

interface Props {
  placeholder?: string;
  value?: string;
  onChange?: (value: string) => void;
  className?: string;
}

function isMac() {
  if (typeof navigator === "undefined") return false;
  return /Mac|iPhone|iPad/.test(navigator.platform);
}

/** A global search field styled like the reference. ⌘K / Ctrl K to focus. */
const GlobalSearch = forwardRef<GlobalSearchHandle, Props>(function GlobalSearch(
  { placeholder = "Search repositories…", value, onChange, className },
  ref,
) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [shortcut, setShortcut] = useState("Ctrl K");

  useImperativeHandle(
    ref,
    () => ({
      focus: () => inputRef.current?.focus(),
    }),
    [],
  );

  useEffect(() => {
    setShortcut(isMac() ? "⌘K" : "Ctrl K");
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <label
      className={cn(
        "flex h-9 flex-1 items-center gap-2 rounded-full border border-line bg-surface px-3.5 text-[13px] text-ink transition-colors focus-within:border-line-strong hover:border-line-strong",
        className,
      )}
    >
      <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 text-ink-faint" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
        <circle cx="7" cy="7" r="4.5" />
        <path d="m10 10 3.5 3.5" />
      </svg>
      <input
        ref={inputRef}
        type="search"
        value={value}
        onChange={(event) => onChange?.(event.target.value)}
        placeholder={placeholder}
        className="flex-1 bg-transparent text-[13px] text-ink placeholder:text-ink-faint focus:outline-none"
      />
      <kbd className="hidden h-5 select-none items-center rounded border border-line bg-subtle px-1.5 font-mono text-2xs text-ink-faint sm:inline-flex">
        {shortcut}
      </kbd>
    </label>
  );
});

export default GlobalSearch;
