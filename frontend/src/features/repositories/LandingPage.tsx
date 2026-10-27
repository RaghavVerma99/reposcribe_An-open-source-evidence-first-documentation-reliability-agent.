import { useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";

import { useAppState } from "../../app/AppState";
import { api, ApiError } from "../../lib/api";
import { CHECK_LABELS, cn } from "../../lib/format";
import { usePageTitle } from "../../lib/usePageTitle";
import { Button, ErrorNotice, ProviderPill } from "../../components/ui/Primitives";
import AuditConsole from "../../components/landing/AuditConsole";
import { CountUp, Reveal, ScrollProgress } from "../../components/motion/Reveal";
import { useParallax, useScrollProgressVar } from "../../components/motion/useMotion";

const GITHUB_URL = "https://github.com/RaghavVerma99/reposcribe";

const FACTS = ["No GitHub token", "Read-only analysis", "Nothing written to your repository"];

const NAV = [
  { href: "#drift", label: "The drift" },
  { href: "#workflow", label: "Loop" },
  { href: "#checks", label: "Checks" },
  { href: "#start", label: "Start" },
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
    tone: "accent" as const,
    label: "Detect",
    line: "Six deterministic checks compare documentation claims against indexed repository facts.",
    tag: "no model",
  },
  {
    tone: "info" as const,
    label: "Explain",
    line: "Every claim is paired with the excerpt that supports or contradicts it. No evidence, no conclusion.",
    tag: "file + line",
  },
  {
    tone: "warn" as const,
    label: "Draft",
    line: "A proposed documentation patch, generated from the finding. It stays a draft and is never applied.",
    tag: "reviewable",
  },
  {
    tone: "ok" as const,
    label: "Verify",
    line: "Validation re-runs the checks before and after the patch and reports what it could not test.",
    tag: "regression-tested",
  },
];

const STEP_TONES = {
  accent: {
    icon: "border-accent/25 bg-accent-soft text-accent-strong",
    dot: "bg-accent",
    label: "text-accent-strong",
  },
  info: {
    icon: "border-info/25 bg-info-soft text-info",
    dot: "bg-info",
    label: "text-info",
  },
  warn: {
    icon: "border-warn/25 bg-warn-soft text-warn",
    dot: "bg-warn",
    label: "text-warn",
  },
  ok: {
    icon: "border-ok/25 bg-ok-soft text-ok",
    dot: "bg-ok",
    label: "text-ok",
  },
};

type GlyphName = "link" | "file" | "route" | "config" | "symbol" | "checklist";

const CHECKS: Array<{
  glyph: GlyphName;
  label: string;
  scope: string;
  blind: string;
}> = [
  {
    glyph: "link",
    label: CHECK_LABELS["markdown.internal_link_exists"],
    scope: "Relative links and heading anchors inside Markdown.",
    blind: "External URLs are never fetched.",
  },
  {
    glyph: "file",
    label: CHECK_LABELS["docs.file_reference_exists"],
    scope: "Paths written in prose, tables, and code spans.",
    blind: "Files generated at build time cannot be known.",
  },
  {
    glyph: "route",
    label: CHECK_LABELS["fastapi.route_matches_docs"],
    scope: "Statically resolvable FastAPI decorators and router prefixes.",
    blind: "Dynamic registration is reported inconclusive.",
  },
  {
    glyph: "config",
    label: CHECK_LABELS["config.env_var_documented"],
    scope: "Documented variables versus .env.example and scanned source.",
    blind: "Platform-injected variables stay a suggestion.",
  },
  {
    glyph: "symbol",
    label: CHECK_LABELS["python.public_symbol_referenced"],
    scope: "Dotted Python symbol references in documentation.",
    blind: "Re-exports and dynamic attributes may be missed.",
  },
  {
    glyph: "checklist",
    label: CHECK_LABELS["docs.readme_checklist"],
    scope: "Installation, run, tests, and license sections.",
    blind: "It reads structure, not the quality of prose.",
  },
];

const PROMISES = [
  { title: "See the whole loop", body: "Run the bundled sample. No token, account, or setup." },
  { title: "Bring a repository", body: "Upload a ZIP. The original files are never modified." },
  { title: "Keep the receipts", body: "Every finding points back to its file excerpt." },
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
      className={cn("h-5 w-5", className)}
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

function Backdrop() {
  const glowA = useParallax<HTMLDivElement>(0.14);
  const glowB = useParallax<HTMLDivElement>(-0.07);

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-[760px] bg-[radial-gradient(60%_52%_at_50%_0%,rgba(34,197,94,0.11),transparent_70%)]" />
      <div
        ref={glowA}
        className="absolute left-[-8%] top-[-160px] h-[440px] w-[720px] rounded-full bg-accent/[0.06] blur-[130px]"
      />
      <div
        ref={glowB}
        className="absolute right-[-12%] top-[380px] h-[380px] w-[380px] rounded-full bg-info/[0.05] blur-[110px]"
      />
      <div className="grid-lines absolute inset-x-0 top-0 h-[900px] opacity-[0.55]" />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-line-strong/70 to-transparent" />
    </div>
  );
}

function CheckTicker() {
  const labels = Object.values(CHECK_LABELS);
  const row = [...labels, ...labels];

  return (
    <div
      aria-hidden="true"
      className="relative mt-16 overflow-hidden border-y border-line/70 bg-surface/20 py-3"
    >
      <div className="ticker flex w-max items-center gap-7">
        {row.map((label, index) => (
          <span
            key={`${label}-${index}`}
            className="flex items-center gap-7 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint"
          >
            <span className="flex items-center gap-2">
              <span className="h-1 w-1 rounded-full bg-accent/70" />
              {label}
            </span>
            <span className="text-line-strong">/</span>
          </span>
        ))}
      </div>
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
      <Backdrop />

      <header className="sticky top-0 z-40 border-b border-line/70 bg-canvas/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-3 px-5 sm:px-6">
          <a href="#top" className="group flex items-center gap-2.5" aria-label="RepoScribe home">
            <span
              aria-hidden="true"
              className="grid h-8 w-8 place-items-center rounded-[10px] border border-line bg-ink text-canvas shadow-[inset_0_1px_0_rgba(255,255,255,0.4)]"
            >
              <span className="font-display text-[11.5px] font-extrabold tracking-[-0.06em]">RS</span>
            </span>
            <span className="font-display text-[15px] font-semibold tracking-[-0.02em] text-ink">
              RepoScribe
            </span>
          </a>

          <nav aria-label="Page sections" className="ml-auto hidden items-center gap-0.5 md:flex">
            {NAV.map((item) => (
              <a key={item.href} href={item.href} className="nav-pill">
                {item.label}
              </a>
            ))}
          </nav>

          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer"
            className="link-button ml-auto h-8 md:ml-2"
            aria-label="RepoScribe on GitHub"
          >
            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
              <path d="M8 0a8 8 0 0 0-2.5 15.6c.4 0 .5-.2.5-.4v-1.4c-2.2.5-2.7-1-2.7-1-.4-.9-.9-1.2-.9-1.2-.7-.5 0-.5 0-.5.8 0 1.2.8 1.2.8.7 1.2 1.9.9 2.4.7 0-.5.3-.9.5-1.1-1.8-.2-3.6-.9-3.6-3.9 0-.9.3-1.6.8-2.1-.1-.2-.4-1 .1-2.1 0 0 .7-.2 2.2.8a7.6 7.6 0 0 1 4 0c1.5-1 2.2-.8 2.2-.8.4 1.1.2 1.9 0 2.1.5.5.8 1.2.8 2.1 0 3-1.8 3.7-3.6 3.9.3.2.5.7.5 1.4v2.1c0 .2.1.4.5.4A8 8 0 0 0 8 0Z" />
            </svg>
            GitHub
          </a>
        </div>
      </header>

      <main className="relative z-10">
        <section className="mx-auto w-full max-w-6xl px-5 pb-4 pt-12 sm:px-6 sm:pt-16 lg:pt-20">
          <div className="grid items-center gap-12 lg:grid-cols-[1.02fr_0.98fr] lg:gap-14">
            <div>
              <Reveal>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="inline-flex items-center gap-2 rounded-full border border-accent/25 bg-accent-soft px-3 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-accent-strong">
                    <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-accent" />
                    evidence first
                  </span>
                  <span className="font-hand text-[20px] leading-none text-ink-faint">
                    not another doc generator
                  </span>
                </div>
              </Reveal>

              <Reveal delay={70}>
                <h1 className="mt-5 font-display text-[clamp(38px,8.4vw,76px)] font-bold leading-[0.96] tracking-[-0.055em] text-ink">
                  Docs drift.
                  <br />
                  <span className="text-gradient">We bring receipts.</span>
                </h1>
              </Reveal>

              <Reveal delay={130}>
                <p className="mt-6 max-w-xl text-[15.5px] leading-[1.75] text-ink-muted">
                  RepoScribe scans a repository, finds the exact line where the documentation and
                  the code disagree, and shows the{" "}
                  <span className="text-accent-strong">evidence</span> behind every finding.
                </p>
              </Reveal>

              <Reveal delay={180}>
                <p className="mt-3 max-w-xl text-[13.5px] leading-6 text-ink-faint">
                  Deterministic checks decide what is true. The model only explains and drafts. Every
                  proposed fix stays a draft until you review it.
                </p>
              </Reveal>

              <Reveal delay={240}>
                <div className="mt-8 flex flex-wrap items-center gap-2.5">
                  <Button
                    variant="primary"
                    onClick={openSample}
                    loading={busy === "sample"}
                    disabled={busy !== null}
                    className="h-11 px-5 text-[14px] shadow-[0_18px_48px_-24px_rgba(34,197,94,0.9)]"
                  >
                    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M3.5 5.5h9M10 2.5l3 3-3 3M12.5 10.5h-9" />
                    </svg>
                    Try sample repository
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => fileInput.current?.click()}
                    loading={busy === "upload"}
                    disabled={busy !== null}
                    className="h-11 px-5 text-[14px]"
                  >
                    Upload repository ZIP
                  </Button>
                </div>
              </Reveal>

              <Reveal delay={300}>
                <div className="mt-6 flex flex-wrap items-center gap-x-3.5 gap-y-2 text-2xs text-ink-faint">
                  {FACTS.map((fact) => (
                    <span key={fact} className="whitespace-nowrap">
                      {fact}
                    </span>
                  ))}
                  {provider ? (
                    <ProviderPill mode={provider.mode} message={provider.message} className="ml-0.5" />
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

            <Reveal delay={160} distance={26}>
              <AuditConsole />
              <p className="mt-3 text-center font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint">
                sample audit · 10 findings · 6 verified
              </p>
            </Reveal>
          </div>

          <div className="mt-14 flex flex-col items-center gap-3" aria-hidden="true">
            <span className="font-mono text-[9.5px] uppercase tracking-[0.2em] text-ink-faint">
              scroll to follow one finding
            </span>
            <span className="h-10 w-px bg-gradient-to-b from-accent/70 to-transparent" />
          </div>
        </section>

        <CheckTicker />

        <section
          id="drift"
          ref={driftRail}
          className="relative mt-24 scroll-mt-20 sm:mt-32"
        >
          <div className="mx-auto grid w-full max-w-6xl gap-10 px-5 sm:px-6 lg:grid-cols-[0.82fr_1.18fr] lg:gap-16">
            <div className="lg:sticky lg:top-24 lg:self-start">
              <Reveal>
                <p className="eyebrow">The drift</p>
                <h2 className="mt-3 font-display text-[clamp(30px,4.2vw,44px)] font-bold leading-[1.05] tracking-[-0.04em] text-ink">
                  A doc line and a code line disagree.
                  <span className="text-ink-faint"> That is the whole defect.</span>
                </h2>
              </Reveal>
              <Reveal delay={90}>
                <p className="body-text mt-5 max-w-md">
                  RepoScribe does not summarise your repository. It compares specific claims against
                  specific evidence, then labels how sure it is allowed to be.
                </p>
              </Reveal>
              <Reveal delay={140}>
                <div className="mt-8 max-w-xs">
                  <div className="flex items-center justify-between font-mono text-[9.5px] uppercase tracking-[0.14em] text-ink-faint">
                    <span>evidence trail</span>
                    <span className="text-accent-strong">scroll</span>
                  </div>
                  <div className="mt-2 h-px w-full overflow-hidden bg-line">
                    <div
                      className="h-px origin-left bg-gradient-to-r from-accent to-info"
                      style={{ transform: "scaleX(var(--scroll-progress, 0))" }}
                    />
                  </div>
                </div>
              </Reveal>
            </div>

            <div className="space-y-4">
              {BEATS.map((beat, index) => (
                <Reveal key={beat.kicker} delay={index * 60}>
                  <article className="group relative overflow-hidden rounded-2xl border border-line bg-surface/70 p-5 transition-colors duration-200 hover:border-line-strong">
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_60%_at_100%_0%,rgba(34,197,94,0.055),transparent_70%)] opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                    />
                    <div className="relative flex items-center justify-between gap-3">
                      <span className="eyebrow">{beat.kicker}</span>
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.1em]",
                          beat.status === "verified"
                            ? "border-ok/25 bg-ok-soft text-ok"
                            : "border-warn/25 bg-warn-soft text-warn",
                        )}
                      >
                        <span
                          aria-hidden="true"
                          className={cn(
                            "h-1 w-1 rounded-full",
                            beat.status === "verified" ? "bg-ok" : "bg-warn",
                          )}
                        />
                        {beat.status}
                      </span>
                    </div>

                    <div className="relative mt-4 grid gap-2.5 sm:grid-cols-2">
                      <div className="rounded-control border border-line bg-canvas p-3">
                        <p className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-ink-faint">
                          doc says
                        </p>
                        <p className="mt-1.5 truncate font-mono text-[12px] text-ink">{beat.claim}</p>
                        <p className="mt-1 font-mono text-[9.5px] text-ink-faint">{beat.docLine}</p>
                      </div>
                      <div className="rounded-control border border-warn/20 bg-warn-soft/40 p-3">
                        <p className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-warn/80">
                          code shows
                        </p>
                        <p className="mt-1.5 truncate font-mono text-[12px] text-warn">{beat.fact}</p>
                        <p className="mt-1 font-mono text-[9.5px] text-ink-faint">{beat.srcLine}</p>
                      </div>
                    </div>

                    <p className="relative mt-3 text-[12.5px] leading-5 text-ink-muted">{beat.note}</p>
                  </article>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section
          id="workflow"
          ref={loopRail}
          className="relative mt-24 scroll-mt-20 sm:mt-32"
        >
          <div className="mx-auto grid w-full max-w-6xl gap-10 px-5 sm:px-6 lg:grid-cols-[0.78fr_1.22fr] lg:gap-16">
            <div className="lg:sticky lg:top-24 lg:self-start">
              <Reveal>
                <p className="eyebrow">The review loop</p>
                <h2 className="mt-3 font-display text-[clamp(30px,4.2vw,44px)] font-bold leading-[1.05] tracking-[-0.04em] text-ink">
                  From drift to <span className="text-gradient">verified fix.</span>
                </h2>
              </Reveal>
              <Reveal delay={90}>
                <p className="body-text mt-5 max-w-sm">
                  Four steps, no hidden magic. The deterministic layer decides; you make the final
                  call.
                </p>
              </Reveal>
              <Reveal delay={140}>
                <div className="mt-8 hidden max-w-xs lg:block">
                  <div className="flex items-center justify-between font-mono text-[9.5px] uppercase tracking-[0.14em] text-ink-faint">
                    <span>loop progress</span>
                    <span className="text-accent-strong">01 — 04</span>
                  </div>
                  <div className="mt-2 h-px w-full overflow-hidden bg-line">
                    <div
                      className="h-px origin-left bg-gradient-to-r from-accent to-accent-strong"
                      style={{ transform: "scaleX(var(--scroll-progress, 0))" }}
                    />
                  </div>
                </div>
              </Reveal>
            </div>

            <ol className="relative space-y-3.5">
              <div
                aria-hidden="true"
                className="absolute bottom-6 left-[19px] top-6 w-px bg-gradient-to-b from-accent/40 via-line to-transparent"
              />
              {STEPS.map((step, index) => {
                const tone = STEP_TONES[step.tone];
                return (
                  <li key={step.label} className="relative">
                    <Reveal delay={index * 70}>
                      <div className="group flex gap-4 rounded-2xl border border-line bg-surface/70 p-5 transition-colors duration-200 hover:border-line-strong">
                        <span
                          className={cn(
                            "relative z-10 grid h-10 w-10 shrink-0 place-items-center rounded-xl border bg-canvas font-mono text-[11px] font-medium",
                            tone.icon,
                          )}
                        >
                          0{index + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <h3
                              className={cn(
                                "font-display text-[18px] font-semibold tracking-[-0.015em]",
                                tone.label,
                              )}
                            >
                              {step.label}
                            </h3>
                            <span className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-ink-faint">
                              {step.tag}
                            </span>
                          </div>
                          <p className="mt-1.5 text-[13px] leading-6 text-ink-muted">{step.line}</p>
                        </div>
                      </div>
                    </Reveal>
                  </li>
                );
              })}
            </ol>
          </div>
        </section>

        <section id="checks" className="mt-24 scroll-mt-20 sm:mt-32">
          <div className="mx-auto w-full max-w-6xl px-5 sm:px-6">
            <Reveal>
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="eyebrow">Checks in the box</p>
                  <h2 className="mt-3 font-display text-[clamp(30px,4.2vw,44px)] font-bold leading-[1.05] tracking-[-0.04em] text-ink">
                    Six checks. Stated scope.
                  </h2>
                </div>
                <span className="hidden font-hand text-[21px] leading-none text-ink-faint sm:inline">
                  no silent passes
                </span>
              </div>
              <p className="body-text mt-4 max-w-2xl">
                Each check says what it can prove and what it cannot see. When the evidence is
                missing, the result is inconclusive — never quietly clean.
              </p>
            </Reveal>

            <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {CHECKS.map((check, index) => (
                <Reveal key={check.label} delay={index * 45}>
                  <article className="group relative h-full overflow-hidden rounded-2xl border border-line bg-surface/60 p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-line-strong hover:bg-surface">
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-accent/[0.07] blur-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                    />
                    <div className="relative flex items-center justify-between">
                      <span className="grid h-9 w-9 place-items-center rounded-xl border border-line bg-canvas text-ink-muted transition-colors group-hover:text-accent-strong">
                        <Glyph name={check.glyph} />
                      </span>
                      <span className="font-mono text-[9.5px] text-ink-faint">0{index + 1}</span>
                    </div>
                    <h3 className="relative mt-4 font-display text-[16px] font-semibold tracking-[-0.01em] text-ink">
                      {check.label}
                    </h3>
                    <p className="relative mt-1.5 text-[12.5px] leading-5 text-ink-muted">
                      {check.scope}
                    </p>
                    <p className="relative mt-3 border-t border-line pt-2.5 text-[11px] leading-4 text-ink-faint">
                      <span className="text-ink-muted">Cannot see:</span> {check.blind}
                    </p>
                  </article>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-24 sm:mt-32">
          <div className="mx-auto w-full max-w-6xl px-5 sm:px-6">
            <Reveal>
              <div className="relative overflow-hidden rounded-3xl border border-line bg-surface/50">
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_80%_at_0%_0%,rgba(248,113,113,0.05),transparent_60%),radial-gradient(70%_80%_at_100%_100%,rgba(34,197,94,0.06),transparent_60%)]"
                />
                <div className="relative grid md:grid-cols-2">
                  <div className="border-b border-line p-7 sm:p-9 md:border-b-0 md:border-r">
                    <p className="eyebrow text-danger/80">Never</p>
                    <ul className="mt-5 space-y-4">
                      {[
                        "Rewrite your application code.",
                        "Present a guess as verified.",
                        "Call an unrun check clean.",
                      ].map((item) => (
                        <li key={item} className="flex items-start gap-3">
                          <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border border-danger/25 bg-danger-soft text-danger">
                            <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                              <path d="m4 4 8 8M12 4l-8 8" />
                            </svg>
                          </span>
                          <span className="text-[14px] leading-6 text-ink-faint line-through decoration-line-strong">
                            {item}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="p-7 sm:p-9">
                    <p className="eyebrow text-accent-strong">Always</p>
                    <ul className="mt-5 space-y-4">
                      {[
                        "Quote the file and line behind a finding.",
                        "Say inconclusive when evidence is missing.",
                        "Leave every patch as a draft.",
                      ].map((item) => (
                        <li key={item} className="flex items-start gap-3">
                          <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border border-accent/25 bg-accent-soft text-accent-strong">
                            <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <path d="M3 8.5 6.5 12 13 4.5" />
                            </svg>
                          </span>
                          <span className="text-[14px] leading-6 text-ink">{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        <section className="mt-24 border-y border-line bg-surface/25 sm:mt-32">
          <div className="mx-auto grid w-full max-w-6xl grid-cols-2 gap-x-6 gap-y-8 px-5 py-10 sm:grid-cols-4 sm:px-6 sm:py-12">
            {[
              { value: 6, suffix: "", label: "deterministic checks" },
              { value: 0, suffix: "", label: "files modified" },
              { value: 0, suffix: "", label: "uncited conclusions" },
              { value: 136, suffix: "", label: "backend tests" },
            ].map((stat, index) => (
              <Reveal key={stat.label} delay={index * 60}>
                <div>
                  <p className="font-display text-[36px] font-bold leading-none tracking-[-0.05em] text-ink sm:text-[42px]">
                    <CountUp value={stat.value} suffix={stat.suffix} />
                  </p>
                  <p className="mt-2 font-mono text-[9.5px] uppercase tracking-[0.14em] text-ink-faint">
                    {stat.label}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        <section id="start" className="mt-24 scroll-mt-20 sm:mt-32">
          <div className="mx-auto w-full max-w-6xl px-5 sm:px-6">
            <Reveal>
              <div className="relative overflow-hidden rounded-3xl border border-line bg-surface p-7 sm:p-10">
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full bg-accent/[0.09] blur-[90px]"
                />
                <div className="relative grid items-center gap-9 lg:grid-cols-[1.15fr_0.85fr]">
                  <div>
                    <p className="eyebrow">Start here</p>
                    <h2 className="mt-3 font-display text-[clamp(28px,4vw,42px)] font-bold leading-[1.05] tracking-[-0.04em] text-ink">
                      Let&apos;s check what your{" "}
                      <em className="font-hand text-[1.16em] not-italic text-accent-strong">
                        docs actually say
                      </em>
                      .
                    </h2>
                    <p className="body-text mt-4 max-w-md">
                      Start with the bundled sample, or bring your own repository. No account, token,
                      or write access required.
                    </p>
                    <div className="mt-7 flex flex-wrap items-center gap-2.5">
                      <Button
                        variant="primary"
                        onClick={openSample}
                        loading={busy === "sample"}
                        disabled={busy !== null}
                        className="h-11 px-5 text-[14px]"
                      >
                        Try sample repository
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => fileInput.current?.click()}
                        loading={busy === "upload"}
                        disabled={busy !== null}
                        className="h-11 px-5 text-[14px]"
                      >
                        Upload repository ZIP
                      </Button>
                    </div>
                    <p className="mt-4 font-mono text-[9.5px] uppercase tracking-[0.14em] text-ink-faint">
                      sample or ZIP · no account · read-only
                    </p>
                  </div>

                  <div className="space-y-4 rounded-2xl border border-line bg-canvas/60 p-5">
                    {PROMISES.map((promise) => (
                      <div key={promise.title} className="flex gap-3">
                        <span
                          aria-hidden="true"
                          className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent"
                        />
                        <div>
                          <h3 className="font-display text-[14px] font-semibold tracking-[-0.01em] text-ink">
                            {promise.title}
                          </h3>
                          <p className="mt-0.5 text-[12.5px] leading-5 text-ink-muted">
                            {promise.body}
                          </p>
                        </div>
                      </div>
                    ))}
                    {provider ? (
                      <div className="border-t border-line pt-3">
                        <ProviderPill mode={provider.mode} message={provider.message} />
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </section>
      </main>

      <footer className="relative z-10 mt-20 border-t border-line">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 px-5 py-8 sm:flex-row sm:px-6">
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="grid h-7 w-7 place-items-center rounded-[9px] border border-line bg-ink text-canvas"
            >
              <span className="font-display text-[10px] font-extrabold tracking-[-0.06em]">RS</span>
            </span>
            <p className="font-hand text-[21px] leading-none text-ink-faint">
              good docs deserve receipts.
            </p>
          </div>
          <nav className="flex items-center gap-5 text-[12.5px] text-ink-muted" aria-label="Footer">
            <a href="#top" className="transition-colors hover:text-ink">
              Back to top
            </a>
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noreferrer"
              className="transition-colors hover:text-ink"
            >
              GitHub ↗
            </a>
            <span className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-ink-faint">
              read-only
            </span>
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
