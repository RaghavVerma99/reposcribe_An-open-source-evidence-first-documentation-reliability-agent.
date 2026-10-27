import { useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";

import { useAppState } from "../../app/AppState";
import { api, ApiError } from "../../lib/api";
import { CHECK_LABELS, cn } from "../../lib/format";
import { usePageTitle } from "../../lib/usePageTitle";
import { Button, ErrorNotice, ProviderPill } from "../../components/ui/Primitives";
import AuditConsole from "../../components/landing/AuditConsole";
import { CountUp, Reveal, ScrollProgress } from "../../components/motion/Reveal";
import { useScrollProgressVar } from "../../components/motion/useMotion";

const GITHUB_URL = "https://github.com/RaghavVerma99/reposcribe";

const NAV = [
  { href: "#drift", label: "Drift" },
  { href: "#workflow", label: "Loop" },
  { href: "#checks", label: "Checks" },
  { href: "#start", label: "Start" },
];

const FACTS = ["No GitHub token", "Read-only analysis", "Nothing written to your repository"];

const SIGNALS = [
  { label: "Detect", color: "#d8ff3e" },
  { label: "Explain", color: "#6aa8ff" },
  { label: "Draft", color: "#ffc24b" },
  { label: "Verify", color: "#ff6a4d" },
];

type Beat = {
  kicker: string;
  status: "verified" | "needs review";
  claim: string;
  docLine: string;
  fact: string;
  srcLine: string;
  note: string;
};

const BEATS: Beat[] = [
  {
    kicker: "Route drift",
    status: "verified",
    claim: "GET /api/users",
    docLine: "README.md:26",
    fact: "GET /api/v2/users",
    srcLine: "app/routes/users.py:4,15",
    note: "The table row and the router prefix are the same disagreement, quoted on both sides.",
  },
  {
    kicker: "Missing setup file",
    status: "verified",
    claim: "scripts/seed.py",
    docLine: "README.md:15",
    fact: "no such file",
    srcLine: "repository root",
    note: "A setup step that cannot run. RepoScribe reports the path, not a guess about intent.",
  },
  {
    kicker: "Broken link",
    status: "verified",
    claim: "docs/setup.md",
    docLine: "README.md:29",
    fact: "target missing",
    srcLine: "repository tree",
    note: "Local links are resolved against the archive. External URLs are never fetched.",
  },
  {
    kicker: "Undefined configuration",
    status: "needs review",
    claim: "REDIS_URL",
    docLine: "README.md:42",
    fact: "absent from .env.example and source",
    srcLine: ".env.example",
    note: "Deployment platforms can inject variables, so this stays a suggestion, not a verdict.",
  },
];

const STEPS = [
  {
    label: "Detect",
    color: "#d8ff3e",
    line: "Six deterministic checks compare documentation claims against indexed repository facts.",
    tag: "no model",
  },
  {
    label: "Explain",
    color: "#6aa8ff",
    line: "Every claim is paired with the excerpt that supports or contradicts it. No evidence, no conclusion.",
    tag: "file + line",
  },
  {
    label: "Draft",
    color: "#ffc24b",
    line: "A proposed documentation patch, generated from the finding. It stays a draft and is never applied.",
    tag: "reviewable",
  },
  {
    label: "Verify",
    color: "#ff6a4d",
    line: "Validation re-runs the checks before and after the patch and reports what it could not test.",
    tag: "regression-tested",
  },
];

type GlyphName = "link" | "file" | "route" | "config" | "symbol" | "checklist";

const CHECKS: Array<{
  glyph: GlyphName;
  label: string;
  scope: string;
  blind: string;
  color: string;
}> = [
  {
    glyph: "link",
    label: CHECK_LABELS["markdown.internal_link_exists"],
    scope: "Relative links and heading anchors inside Markdown.",
    blind: "External URLs are never fetched.",
    color: "#d8ff3e",
  },
  {
    glyph: "file",
    label: CHECK_LABELS["docs.file_reference_exists"],
    scope: "Paths written in prose, tables, and code spans.",
    blind: "Files generated at build time cannot be known.",
    color: "#6aa8ff",
  },
  {
    glyph: "route",
    label: CHECK_LABELS["fastapi.route_matches_docs"],
    scope: "Statically resolvable FastAPI decorators and router prefixes.",
    blind: "Dynamic registration is reported inconclusive.",
    color: "#ff6a4d",
  },
  {
    glyph: "config",
    label: CHECK_LABELS["config.env_var_documented"],
    scope: "Documented variables versus .env.example and scanned source.",
    blind: "Platform-injected variables stay a suggestion.",
    color: "#ffc24b",
  },
  {
    glyph: "symbol",
    label: CHECK_LABELS["python.public_symbol_referenced"],
    scope: "Dotted Python symbol references in documentation.",
    blind: "Re-exports and dynamic attributes may be missed.",
    color: "#b9a6ff",
  },
  {
    glyph: "checklist",
    label: CHECK_LABELS["docs.readme_checklist"],
    scope: "Installation, run, tests, and license sections.",
    blind: "It reads structure, not the quality of prose.",
    color: "#f4f4ef",
  },
];

const NEVER = [
  "Rewrite your application code.",
  "Present a guess as verified.",
  "Call an unrun check clean.",
];

const ALWAYS = [
  "Quote the file and line behind a finding.",
  "Say inconclusive when evidence is missing.",
  "Leave every patch as a draft.",
];

function Glyph({ name, className }: { name: GlyphName; className?: string }) {
  const paths: Record<GlyphName, ReactNode> = {
    link: (
      <>
        <path d="M9.5 14.5 8 16a3.5 3.5 0 0 1-5-5l2.5-2.5" />
        <path d="M14.5 9.5 16 8a3.5 3.5 0 0 0-5-5l-2.5 2.5" />
        <path d="m9 15 6-6" />
      </>
    ),
    file: (
      <>
        <path d="M6 3.5h7l5 5v12H6z" />
        <path d="M13 3.5v5h5" />
        <path d="M9 13h6M9 16.5h4" />
      </>
    ),
    route: (
      <>
        <circle cx="6" cy="6" r="2.5" />
        <circle cx="18" cy="18" r="2.5" />
        <path d="M8.5 6H14a4 4 0 0 1 4 4v5.5" />
      </>
    ),
    config: (
      <>
        <path d="M4 7h10M18 7h2M4 17h2M10 17h10" />
        <circle cx="16" cy="7" r="2" />
        <circle cx="8" cy="17" r="2" />
      </>
    ),
    symbol: (
      <>
        <path d="M9 4H7a2 2 0 0 0-2 2v3l-2 3 2 3v3a2 2 0 0 0 2 2h2" />
        <path d="M15 4h2a2 2 0 0 1 2 2v3l2 3-2 3v3a2 2 0 0 1-2 2h-2" />
      </>
    ),
    checklist: (
      <>
        <path d="M4 5.5h3M4 12h3M4 18.5h3" />
        <path d="m10 6 1.5 1.5L14.5 4.5M10 12.5l1.5 1.5 3-3M10 19l1.5 1.5 3-3" />
      </>
    ),
  };

  return (
    <svg
      viewBox="0 0 24 24"
      className={cn("h-4 w-4", className)}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}

function SectionHeader({
  index,
  label,
  color,
  title,
  copy,
}: {
  index: string;
  label: string;
  color: string;
  title: ReactNode;
  copy: string;
}) {
  return (
    <div className="flex flex-col gap-5 border-t border-line pt-5 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint">
          <span aria-hidden="true" className="h-px w-8" style={{ background: color }} />
          {index} / {label}
        </p>
        <h2 className="mt-4 max-w-2xl font-display text-[clamp(28px,4vw,44px)] font-bold leading-[1.04] tracking-[-0.045em] text-ink">
          {title}
        </h2>
      </div>
      <p className="max-w-sm text-[13px] leading-6 text-ink-muted">{copy}</p>
    </div>
  );
}

export default function LandingPage() {
  const navigate = useNavigate();
  const { provider } = useAppState();
  const fileInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<"sample" | "upload" | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const driftRail = useScrollProgressVar<HTMLElement>();
  const loopRail = useScrollProgressVar<HTMLElement>();
  usePageTitle();

  // Replay the original intent on Retry instead of silently opening the sample.
  const lastIntent = useRef<{ kind: "sample" } | { kind: "upload"; file: File } | null>(null);

  async function openSample() {
    lastIntent.current = { kind: "sample" };
    setBusy("sample");
    setError(null);
    try {
      const repository = await api.createSample();
      navigate(`/r/${repository.id}`);
    } catch (caught) {
      setError(caught as ApiError);
    } finally {
      setBusy(null);
    }
  }

  async function upload(file: File) {
    lastIntent.current = { kind: "upload", file };
    setBusy("upload");
    setError(null);
    try {
      const repository = await api.upload(file);
      navigate(`/r/${repository.id}`);
    } catch (caught) {
      setError(caught as ApiError);
    } finally {
      setBusy(null);
    }
  }

  async function retryLast() {
    const intent = lastIntent.current;
    if (!intent) return;
    if (intent.kind === "sample") {
      await openSample();
    } else {
      // The File object is still referenced even after the input reset.
      await upload(intent.file);
    }
  }

  return (
    <div id="top" className="relative min-h-screen bg-canvas">
      <ScrollProgress />

      <header className="sticky top-0 z-40 border-b border-line/70 bg-canvas/85 backdrop-blur-xl">
        <div className="mx-auto flex h-14 w-full max-w-[1240px] items-center gap-3 px-5 sm:px-8">
          <a href="#top" className="flex items-center gap-2.5" aria-label="RepoScribe home">
            <span
              aria-hidden="true"
              className="grid h-8 w-8 place-items-center rounded-[10px] border border-white/25 bg-ink text-canvas"
            >
              <span className="font-display text-[11.5px] font-extrabold tracking-[-0.06em]">RS</span>
            </span>
            <span className="font-display text-[15px] font-semibold tracking-[-0.02em] text-ink">
              RepoScribe
            </span>
          </a>

          <nav aria-label="Page sections" className="ml-auto hidden items-center gap-7 md:flex">
            {NAV.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="link-underline font-mono text-[10px] uppercase tracking-[0.16em] text-ink-muted transition-colors hover:text-ink"
              >
                {item.label}
              </a>
            ))}
          </nav>

          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer"
            className="link-underline ml-auto font-mono text-[10px] uppercase tracking-[0.16em] text-ink-muted transition-colors hover:text-ink md:ml-7"
          >
            GitHub ↗
          </a>
        </div>

        <nav
          aria-label="Page sections"
          className="flex gap-5 overflow-x-auto border-t border-line/60 px-5 py-2 md:hidden"
        >
          {NAV.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="whitespace-nowrap font-mono text-[9.5px] uppercase tracking-[0.16em] text-ink-faint transition-colors hover:text-ink"
            >
              {item.label}
            </a>
          ))}
        </nav>
      </header>

      <main>
        <section className="mx-auto w-full max-w-[1240px] px-5 pb-14 pt-12 sm:px-8 sm:pt-16 lg:pb-20 lg:pt-20">
          <div className="grid items-center gap-12 lg:grid-cols-[1.08fr_0.92fr] lg:gap-16">
            <div>
              <Reveal>
                <p className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint">
                  <span aria-hidden="true" className="h-px w-8 bg-signal-lime" />
                  Evidence-first documentation
                </p>
              </Reveal>

              <Reveal delay={60}>
                <h1 className="mt-6 font-display text-[clamp(42px,9vw,92px)] font-bold leading-[0.9] tracking-[-0.06em] text-ink">
                  Docs drift.
                  <br />
                  We bring
                  <br />
                  <span className="text-signal-lime">receipts.</span>
                </h1>
              </Reveal>

              <Reveal delay={120}>
                <p className="mt-7 max-w-xl text-[15px] leading-[1.75] text-ink-muted">
                  RepoScribe scans a repository, finds the exact line where the documentation and
                  the code disagree, and shows the evidence behind every finding.
                </p>
              </Reveal>

              <Reveal delay={170}>
                <p className="mt-3 max-w-xl text-[13px] leading-6 text-ink-faint">
                  Deterministic checks decide what is true. The model only explains and drafts.
                  Every proposed fix stays a draft until you review it.
                </p>
              </Reveal>

              <Reveal delay={220}>
                <div className="mt-8 flex flex-wrap items-center gap-2.5">
                  <Button
                    variant="paper"
                    onClick={openSample}
                    loading={busy === "sample"}
                    disabled={busy !== null}
                    className="h-11 px-5 text-[13.5px]"
                  >
                    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M3.5 5.5h9M10 2.5l3 3-3 3M12.5 10.5h-9" />
                    </svg>
                    Try sample repository
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => fileInput.current?.click()}
                    loading={busy === "upload"}
                    disabled={busy !== null}
                    className="h-11 px-5 text-[13.5px]"
                  >
                    Upload repository ZIP
                  </Button>
                </div>
              </Reveal>

              <Reveal delay={270}>
                <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-[9.5px] uppercase tracking-[0.1em] text-ink-faint">
                  {FACTS.map((fact, index) => (
                    <span key={fact} className="inline-flex items-center gap-2 whitespace-nowrap">
                      <span
                        aria-hidden="true"
                        className="h-1 w-1 rounded-full"
                        style={{ background: SIGNALS[index]?.color ?? "#f4f4ef" }}
                      />
                      {fact}
                    </span>
                  ))}
                  {provider ? (
                    <ProviderPill mode={provider.mode} message={provider.message} />
                  ) : null}
                </div>
              </Reveal>

              <input
                ref={fileInput}
                type="file"
                accept=".zip,application/zip"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void upload(file);
                  event.target.value = "";
                }}
              />
            </div>

            <Reveal delay={140} distance={24}>
              <AuditConsole />
              <p className="mt-4 text-center font-mono text-[9px] uppercase tracking-[0.16em] text-ink-faint">
                sample audit · 10 findings · 6 verified
              </p>
            </Reveal>
          </div>
        </section>

        <div className="border-y border-line">
          <div className="mx-auto grid w-full max-w-[1240px] grid-cols-2 px-5 sm:grid-cols-4 sm:px-8">
            {SIGNALS.map((signal) => (
              <div key={signal.label} className="border-r border-line/70 px-4 py-5 last:border-r-0">
                <span aria-hidden="true" className="block h-px w-7" style={{ background: signal.color }} />
                <p className="mt-3 font-mono text-[9.5px] uppercase tracking-[0.18em] text-ink-faint">
                  {signal.label}
                </p>
              </div>
            ))}
          </div>
        </div>

        <section
          id="drift"
          ref={driftRail}
          className="mx-auto w-full max-w-[1240px] scroll-mt-24 px-5 py-20 sm:px-8 sm:py-28"
        >
          <SectionHeader
            index="01"
            label="The drift"
            color="#6aa8ff"
            title={
              <>
                A doc line and a code line disagree.
                <span className="text-ink-faint"> That is the whole defect.</span>
              </>
            }
            copy="RepoScribe does not summarise your repository. It compares specific claims against specific evidence, then labels how sure it is allowed to be."
          />

          <div className="mt-10 grid gap-10 lg:grid-cols-[0.72fr_1.28fr] lg:gap-16">
            <div className="lg:sticky lg:top-24 lg:self-start">
              <p className="max-w-sm text-[13.5px] leading-6 text-ink-muted">
                Each finding is one claim, one observation, and the file excerpt behind both. No
                excerpt, no finding.
              </p>
              <div className="mt-8 max-w-xs">
                <div className="flex items-center justify-between font-mono text-[9px] uppercase tracking-[0.16em] text-ink-faint">
                  <span>evidence trail</span>
                  <span className="text-signal-azure">scroll</span>
                </div>
                <div className="mt-2 h-px w-full overflow-hidden bg-line">
                  <div
                    className="h-px origin-left bg-signal-azure"
                    style={{ transform: "scaleX(var(--scroll-progress, 0))" }}
                  />
                </div>
              </div>
              <p className="mt-8 font-hand text-[23px] leading-tight text-ink-faint">
                the receipt is the product.
              </p>
            </div>

            <div>
              {BEATS.map((beat) => (
                <article key={beat.kicker} className="border-t border-line py-6 first:border-t-0 first:pt-0">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-ink-faint">
                      {beat.kicker}
                    </span>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.12em]",
                        beat.status === "verified" ? "text-signal-lime" : "text-signal-amber",
                      )}
                    >
                      <span aria-hidden="true" className="h-1 w-1 rounded-full bg-current" />
                      {beat.status}
                    </span>
                  </div>

                  <div className="mt-4 grid gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-2">
                    <div className="bg-canvas p-4">
                      <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-ink-faint">
                        doc says
                      </p>
                      <p className="mt-2 truncate font-mono text-[12.5px] text-ink">{beat.claim}</p>
                      <p className="mt-1 font-mono text-[9.5px] text-ink-faint">{beat.docLine}</p>
                    </div>
                    <div className="bg-canvas p-4">
                      <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-ink-faint">
                        code shows
                      </p>
                      <p className="mt-2 truncate font-mono text-[12.5px] text-signal-coral">
                        {beat.fact}
                      </p>
                      <p className="mt-1 font-mono text-[9.5px] text-ink-faint">{beat.srcLine}</p>
                    </div>
                  </div>

                  <p className="mt-3 text-[12.5px] leading-5 text-ink-muted">{beat.note}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section
          id="workflow"
          ref={loopRail}
          className="border-t border-line"
        >
          <div className="mx-auto w-full max-w-[1240px] scroll-mt-24 px-5 py-20 sm:px-8 sm:py-28">
            <SectionHeader
              index="02"
              label="The loop"
              color="#d8ff3e"
              title={
                <>
                  From drift to <span className="text-signal-lime">verified fix.</span>
                </>
              }
              copy="Four steps, no hidden magic. The deterministic layer decides; you make the final call."
            />

            <div className="mt-10 grid gap-10 lg:grid-cols-[0.72fr_1.28fr] lg:gap-16">
              <div className="lg:sticky lg:top-24 lg:self-start">
                <div className="max-w-xs">
                  <div className="flex items-center justify-between font-mono text-[9px] uppercase tracking-[0.16em] text-ink-faint">
                    <span>loop progress</span>
                    <span className="text-signal-lime">01 — 04</span>
                  </div>
                  <div className="mt-2 h-px w-full overflow-hidden bg-line">
                    <div
                      className="h-px origin-left bg-signal-lime"
                      style={{ transform: "scaleX(var(--scroll-progress, 0))" }}
                    />
                  </div>
                </div>
                <p className="mt-8 max-w-xs font-hand text-[23px] leading-tight text-signal-lime">
                  the model never verifies.
                </p>
              </div>

              <ol className="border-t border-line">
                {STEPS.map((step, index) => (
                  <li key={step.label} className="group border-b border-line py-6">
                    <div className="flex gap-5">
                      <span className="pt-1 font-mono text-[10px] text-ink-faint">
                        0{index + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <h3 className="font-display text-[19px] font-semibold tracking-[-0.02em] text-ink">
                            {step.label}
                          </h3>
                          <span
                            className="font-mono text-[9px] uppercase tracking-[0.14em]"
                            style={{ color: step.color }}
                          >
                            {step.tag}
                          </span>
                        </div>
                        <p className="mt-2 max-w-lg text-[13px] leading-6 text-ink-muted">{step.line}</p>
                      </div>
                      <span
                        aria-hidden="true"
                        className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                        style={{ background: step.color }}
                      />
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        <section id="checks" className="border-t border-line">
          <div className="mx-auto w-full max-w-[1240px] scroll-mt-24 px-5 py-20 sm:px-8 sm:py-28">
            <SectionHeader
              index="03"
              label="The checks"
              color="#ffc24b"
              title="Six checks. Stated scope."
              copy="Each check says what it can prove and what it cannot see. When the evidence is missing, the result is inconclusive — never quietly clean."
            />

            <div className="mt-10 grid gap-x-14 sm:grid-cols-2">
              {CHECKS.map((check, index) => (
                <div key={check.label} className="group flex gap-4 border-t border-line py-5">
                  <span className="mt-0.5 font-mono text-[10px]" style={{ color: check.color }}>
                    0{index + 1}
                  </span>
                  <div className="min-w-0">
                    <h3 className="flex items-center gap-2 font-display text-[15.5px] font-semibold tracking-[-0.01em] text-ink">
                      <span className="text-ink-faint transition-colors group-hover:text-current">
                        <Glyph name={check.glyph} />
                      </span>
                      {check.label}
                    </h3>
                    <p className="mt-1 text-[12.5px] leading-5 text-ink-muted">{check.scope}</p>
                    <p className="mt-2 text-[11px] leading-4 text-ink-faint">
                      <span className="text-ink-muted">Cannot see:</span> {check.blind}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t border-line">
          <div className="mx-auto w-full max-w-[1240px] px-5 py-20 sm:px-8 sm:py-28">
            <SectionHeader
              index="04"
              label="The contract"
              color="#ff6a4d"
              title={
                <>
                  The model <span className="text-signal-coral">never</span> verifies.
                </>
              }
              copy="That single rule is why a finding is worth reading. The deterministic layer is the authority; everything else is assistance."
            />

            <div className="mt-10 grid gap-10 md:grid-cols-2 md:gap-16">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-signal-coral">
                  Never
                </p>
                <ul className="mt-4 border-t border-line">
                  {NEVER.map((item) => (
                    <li
                      key={item}
                      className="border-b border-line py-4 text-[15px] leading-6 text-ink-faint line-through decoration-line-strong"
                    >
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-signal-lime">
                  Always
                </p>
                <ul className="mt-4 border-t border-line">
                  {ALWAYS.map((item) => (
                    <li key={item} className="flex items-start gap-3 border-b border-line py-4">
                      <svg
                        viewBox="0 0 16 16"
                        className="mt-1 h-3.5 w-3.5 shrink-0 text-signal-lime"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.9"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M3 8.5 6.5 12 13 4.5" />
                      </svg>
                      <span className="text-[15px] leading-6 text-ink">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        <div className="border-y border-line">
          <div className="mx-auto grid w-full max-w-[1240px] grid-cols-2 px-5 sm:grid-cols-4 sm:px-8">
            {[
              { value: 6, label: "deterministic checks" },
              { value: 0, label: "files modified" },
              { value: 0, label: "uncited conclusions" },
              { value: 143, label: "backend tests" },
            ].map((stat) => (
              <div key={stat.label} className="border-r border-line/70 px-4 py-8 last:border-r-0">
                <p className="font-display text-[38px] font-bold leading-none tracking-[-0.06em] text-ink sm:text-[42px]">
                  <CountUp value={stat.value} />
                </p>
                <p className="mt-2 font-mono text-[9px] uppercase tracking-[0.16em] text-ink-faint">
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
        </div>

        <section id="start" className="mx-auto w-full max-w-[1240px] scroll-mt-24 px-5 py-20 sm:px-8 sm:py-28">
          <div className="relative overflow-hidden rounded-[26px] bg-gradient-to-br from-signal-lime via-signal-azure to-signal-coral p-px">
            <div className="grain relative overflow-hidden rounded-[25px] bg-canvas px-6 py-14 text-center sm:px-12 sm:py-16">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[radial-gradient(50%_100%_at_50%_0%,rgba(216,255,62,0.08),transparent_72%)]"
              />
              <p className="relative font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint">
                Start here
              </p>
              <h2 className="relative mx-auto mt-4 max-w-2xl font-display text-[clamp(28px,4.4vw,46px)] font-bold leading-[1.04] tracking-[-0.045em] text-ink">
                Let&apos;s check what your{" "}
                <span className="text-signal-lime">docs actually say</span>.
              </h2>
              <p className="relative mx-auto mt-4 max-w-md text-[13.5px] leading-6 text-ink-muted">
                Start with the bundled sample, or bring your own repository. No account, token, or
                write access required.
              </p>

              <div className="relative mt-8 flex flex-wrap justify-center gap-2.5">
                <Button
                  variant="paper"
                  onClick={openSample}
                  loading={busy === "sample"}
                  disabled={busy !== null}
                  className="h-11 px-5 text-[13.5px]"
                >
                  Try sample repository
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => fileInput.current?.click()}
                  loading={busy === "upload"}
                  disabled={busy !== null}
                  className="h-11 px-5 text-[13.5px]"
                >
                  Upload repository ZIP
                </Button>
              </div>

              <p className="relative mt-5 font-mono text-[9px] uppercase tracking-[0.16em] text-ink-faint">
                sample or ZIP · no account · read-only
              </p>
              {provider ? (
                <div className="relative mt-4 flex justify-center">
                  <ProviderPill mode={provider.mode} message={provider.message} />
                </div>
              ) : null}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex w-full max-w-[1240px] flex-col items-center justify-between gap-4 px-5 py-8 sm:flex-row sm:px-8">
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="grid h-7 w-7 place-items-center rounded-[9px] border border-white/25 bg-ink text-canvas"
            >
              <span className="font-display text-[10px] font-extrabold tracking-[-0.06em]">RS</span>
            </span>
            <p className="font-hand text-[21px] leading-none text-ink-faint">
              good docs deserve receipts.
            </p>
          </div>
          <nav className="flex items-center gap-6 font-mono text-[9.5px] uppercase tracking-[0.14em] text-ink-faint" aria-label="Footer">
            <a href="#top" className="link-underline transition-colors hover:text-ink">
              Top
            </a>
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noreferrer"
              className="link-underline transition-colors hover:text-ink"
            >
              GitHub ↗
            </a>
            <span>read-only</span>
          </nav>
        </div>
      </footer>

      {error ? (
        <div className="fixed inset-x-4 bottom-4 z-50 mx-auto w-auto max-w-lg animate-fade-up sm:bottom-6">
          <ErrorNotice error={error} onRetry={retryLast} onDismiss={() => setError(null)} />
        </div>
      ) : null}
    </div>
  );
}
