import { Badge } from "../ui/Primitives";

/**
 * A labelled, illustrative finding. It mirrors the fields the real product
 * shows — claim, observation, evidence, and reviewer action — without
 * pretending to be live analysis output from someone's repository.
 */
export default function FeaturedIllustration() {
  return (
    <div className="relative">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -inset-x-8 -top-12 h-44 rounded-full bg-accent/[0.055] blur-3xl"
      />
      <div className="relative overflow-hidden rounded-2xl border border-line bg-surface shadow-lift">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <span aria-hidden="true" className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[#ff5f56]" />
              <span className="h-2 w-2 rounded-full bg-[#ffbd2e]" />
              <span className="h-2 w-2 rounded-full bg-[#27c93f]" />
            </span>
            <span className="ml-1 font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink-faint">
              audit / specimen
            </span>
          </div>
          <Badge tone="warn">
            <span aria-hidden="true" className="h-1 w-1 rounded-full bg-warn" />
            needs review
          </Badge>
        </div>

        <div className="grid sm:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-5 border-b border-line p-5 sm:border-b-0 sm:border-r">
            <div>
              <p className="eyebrow">Documentation claims</p>
              <p className="mt-2 rounded-control border border-line bg-canvas px-3 py-2 font-mono text-[12.5px] text-ink">
                GET /v1/projects
              </p>
            </div>
            <div>
              <p className="eyebrow">Source observes</p>
              <p className="mt-2 rounded-control border border-warn/20 bg-warn-soft/50 px-3 py-2 font-mono text-[12.5px] text-warn">
                GET /api/v1/projects
              </p>
            </div>
            <div className="rounded-control border border-line bg-canvas p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-mono text-2xs text-ink-faint">src/routes/projects.py:42</span>
                <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.1em] text-ok">
                  <svg
                    viewBox="0 0 16 16"
                    className="h-3 w-3"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M3 8.5 6.5 12 13 4.5" />
                  </svg>
                  retrieved
                </span>
              </div>
              <pre className="mt-2.5 overflow-x-auto font-mono text-[11.5px] leading-5 text-ink-muted">
                {`@router.get("/projects")`}
              </pre>
            </div>
          </div>

          <div className="flex flex-col p-5">
            <p className="eyebrow">Reviewer view</p>
            <ul className="mt-4 space-y-3.5 text-[12.5px] leading-5 text-ink-muted">
              {[
                "Claim and source, side by side.",
                "A real file excerpt behind the finding.",
                "A patch draft — never an automatic edit.",
              ].map((line) => (
                <li key={line} className="flex gap-2.5">
                  <svg
                    viewBox="0 0 16 16"
                    className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent-strong"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M3 8.5 6.5 12 13 4.5" />
                  </svg>
                  <span>{line}</span>
                </li>
              ))}
            </ul>

            <div className="mt-auto border-t border-line pt-5">
              <p className="font-hand text-[22px] leading-none text-accent-strong">
                the model never verifies.
              </p>
              <p className="mt-2 text-2xs leading-4 text-ink-faint">
                Deterministic checks decide. You approve the fix.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-5 py-3">
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint">
            illustrative finding
          </span>
          <a
            href="#workflow"
            className="group inline-flex items-center gap-1.5 text-[12px] font-medium text-ink-muted transition-colors hover:text-accent-strong"
          >
            See the review loop
            <svg
              viewBox="0 0 16 16"
              className="h-3 w-3 transition-transform group-hover:translate-x-0.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M3 8h10M9 4l4 4-4 4" />
            </svg>
          </a>
        </div>
      </div>
    </div>
  );
}
