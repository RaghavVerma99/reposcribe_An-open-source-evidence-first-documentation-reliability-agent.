import type { CSSProperties } from "react";

import { cn } from "../../lib/format";
import { useInView, usePrefersReducedMotion } from "../motion/useMotion";

type Tone = "dim" | "plain" | "ok" | "drift" | "warn" | "accent";

const LINES: Array<{ tone: Tone; text: string }> = [
  { tone: "accent", text: "$ reposcribe audit ." },
  { tone: "dim", text: "indexing 8 files · 2 docs · 2 routes" },
  { tone: "ok", text: "✓ markdown.internal_link_exists" },
  { tone: "ok", text: "✓ docs.file_reference_exists" },
  { tone: "drift", text: "✗ fastapi.route_matches_docs" },
  { tone: "dim", text: "  docs/api.md:14    GET /api/users" },
  { tone: "dim", text: "  users.py:9        GET /api/v2/users" },
  { tone: "warn", text: "! config.env_var_documented" },
  { tone: "ok", text: "✓ python.public_symbol_referenced" },
  { tone: "ok", text: "✓ docs.readme_checklist" },
  { tone: "plain", text: "10 findings · 6 verified · 4 review" },
];

const TONE: Record<Tone, string> = {
  dim: "text-ink-faint",
  plain: "text-ink",
  ok: "text-ink-muted",
  drift: "text-signal-lime",
  warn: "text-signal-coral",
  accent: "text-signal-azure",
};

/**
 * A labelled illustration of a real audit run. The numbers match the bundled
 * sample; it is deliberately captioned as a specimen, not live output.
 */
export default function AuditConsole() {
  const reduced = usePrefersReducedMotion();
  const { ref, inView } = useInView<HTMLDivElement>({ threshold: 0.25 });
  const visible = reduced || inView;

  return (
    <div className="relative">
      <div aria-hidden="true" className="duotone pointer-events-none absolute -inset-4 blur-3xl sm:-inset-10" />

      <div
        ref={ref}
        className="relative overflow-hidden rounded-2xl border border-line bg-[#080808] shadow-lift"
      >
        <div
          aria-hidden="true"
          className="h-px w-full bg-gradient-to-r from-signal-lime via-signal-azure to-signal-coral"
        />
        <div className="console-scan" aria-hidden="true" />

        <div className="relative flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          <div className="flex items-center gap-2.5">
            <span aria-hidden="true" className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-signal-coral" />
              <span className="h-1.5 w-1.5 rounded-full bg-signal-amber" />
              <span className="h-1.5 w-1.5 rounded-full bg-signal-lime" />
            </span>
            <span className="ml-1 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint">
              reposcribe / audit
            </span>
          </div>
          <span className="inline-flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.14em] text-ink-faint">
            <span aria-hidden="true" className="h-1 w-1 rounded-full bg-signal-lime" />
            deterministic
          </span>
        </div>

        <div className="relative px-4 py-4 font-mono text-[11px] leading-[1.9] sm:text-[11.5px]">
          {LINES.map((line, index) => {
            const style: CSSProperties = reduced
              ? {}
              : {
                  opacity: visible ? 1 : 0,
                  transform: visible ? "translate3d(0, 0, 0)" : "translate3d(0, 5px, 0)",
                  transition: `opacity 360ms ease-out ${index * 65}ms, transform 360ms ease-out ${index * 65}ms`,
                };
            return (
              <div key={line.text} style={style} className={cn("truncate", TONE[line.tone])}>
                {line.text}
              </div>
            );
          })}
          <div className="mt-1 flex items-center gap-1.5 text-ink-faint">
            <span aria-hidden="true" className="text-signal-azure">→</span>
            <span>open evidence</span>
            <span aria-hidden="true" className="caret ml-0.5 inline-block h-3 w-1.5 bg-signal-lime" />
          </div>
        </div>

        <div className="relative flex flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-2.5">
          <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-ink-faint">
            sample repository
          </span>
          <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-ink-faint">
            read-only · no token
          </span>
        </div>
      </div>
    </div>
  );
}
