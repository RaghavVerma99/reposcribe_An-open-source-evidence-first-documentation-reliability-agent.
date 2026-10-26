import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";

import { cn } from "../../lib/format";

export interface GlobalSearchHandle {
  focus: () => void;
}

interface Props {
  placeholder?: string;
  value?: string;
  onChange?: (value: string) => void;
  onSubmit?: (value: string) => void;
  className?: string;
}

function isMac() {
  if (typeof navigator === "undefined") return false;
  return /Mac|iPhone|iPad/.test(navigator.platform);
}

/** A global findings search. ⌘K / Ctrl K focuses it; Enter opens matching findings. */
const GlobalSearch = forwardRef<GlobalSearchHandle, Props>(function GlobalSearch(
  { placeholder = "Search findings…", value, onChange, onSubmit, className },
  ref,
) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [internalValue, setInternalValue] = useState("");
  const [shortcut, setShortcut] = useState("Ctrl K");
  const currentValue = value ?? internalValue;

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

  function update(next: string) {
    if (value === undefined) setInternalValue(next);
    onChange?.(next);
  }

  function submit() {
    const query = currentValue.trim();
    if (query) onSubmit?.(query);
  }

  return (
    <label
      className={cn(
        "group flex h-9 w-full items-center gap-2 rounded-full border border-line bg-surface/60 px-3.5 text-[13px] text-ink transition-colors duration-150 focus-within:border-accent/45 focus-within:bg-surface hover:border-line-strong",
        className,
      )}
    >
      <svg
        viewBox="0 0 16 16"
        className="h-3.5 w-3.5 shrink-0 text-ink-faint transition-colors group-focus-within:text-accent-strong"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        aria-hidden="true"
      >
        <circle cx="7" cy="7" r="4.5" />
        <path d="m10 10 3.5 3.5" />
      </svg>
      <input
        ref={inputRef}
        type="search"
        value={currentValue}
        onChange={(event) => update(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            submit();
          }
          if (event.key === "Escape") {
            update("");
            inputRef.current?.blur();
          }
        }}
        placeholder={placeholder}
        aria-label={placeholder}
        className="min-w-0 flex-1 bg-transparent text-[13px] text-ink placeholder:text-ink-faint focus:outline-none"
      />
      <kbd className="hidden h-5 select-none items-center rounded border border-line bg-subtle px-1.5 font-mono text-[10px] text-ink-faint sm:inline-flex">
        {shortcut}
      </kbd>
    </label>
  );
});

export default GlobalSearch;
