import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAppState } from "../../app/AppState";
import { api, ApiError } from "../../lib/api";
import { cn } from "../../lib/format";
import { StatusPill } from "../../components/ui/Primitives";
import FeaturedIllustration from "../../components/landing/FeaturedIllustration";

const SAMPLE_LABELS = ["fastapi-template", "nextjs-app", "python-toolkit"];

const STEPS = [
  {
    tone: "accent" as const,
    label: "Detect",
    line: "Find broken links, outdated APIs, and inaccurate guides.",
    icon: (
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-3.5 w-3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="7" cy="7" r="4" />
        <path d="m10 10 3.5 3.5" />
      </svg>
    ),
  },
  {
    tone: "info" as const,
    label: "Explain",
    line: "Get clear, source-backed explanations.",
    icon: (
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-3.5 w-3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 3.5h7l3 3V12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z" />
        <path d="M5.5 8.5h5M5.5 10.5h3" />
      </svg>
    ),
  },
  {
    tone: "warn" as const,
    label: "Repair",
    line: "Receive AI-generated patches with context.",
    icon: (
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-3.5 w-3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 12V4.5a1.5 1.5 0 0 1 1.5-1.5h7A1.5 1.5 0 0 1 13 4.5V12" />
        <path d="M3 12h10v2.5H3Z" />
        <path d="M6.5 7.5h3" />
      </svg>
    ),
  },
  {
    tone: "ok" as const,
    label: "Verify",
    line: "Validate fixes before applying them.",
    icon: (
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-3.5 w-3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M8 1.75 13.25 4.25v6.5L8 13.25 2.75 10.75v-6.5Z" />
        <path d="m5.6 8.5 1.8 1.8 3.2-3.5" />
      </svg>
    ),
  },
];

const RECENT = [
  {
    name: "fastapi-template",
    when: "2 hours ago",
    findings: 12,
    tone: "ok" as const,
    label: "fixed",
    pulsing: true,
  },
  {
    name: "ai-notes-app",
    when: "18 hours ago",
    findings: 8,
    tone: "danger" as const,
    label: "1 fixed",
    pulsing: false,
  },
  {
    name: "ml-toolkit",
    when: "3 days ago",
    findings: 5,
    tone: "danger" as const,
    label: "0 fixed",
    pulsing: false,
  },
];

function HeroActionButton(props: {
  icon: React.ReactNode;
  children: React.ReactNode;
  variant: "primary" | "outline";
  onClick?: () => void;
  loading?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      disabled={props.loading}
      className={cn(
        "inline-flex h-11 items-center justify-center gap-2 rounded-control px-4 text-[14px] font-medium transition-all duration-150 disabled:cursor-not-allowed",
        props.variant === "primary"
          ? "bg-accent text-white shadow-glow hover:bg-accent-hover hover:shadow-[0_0_0_1px_rgba(124,127,245,0.7),0_0_48px_-8px_rgba(124,127,245,0.85)]"
          : "border border-line bg-surface text-ink hover:border-line-strong hover:bg-surface-elevated",
      )}
    >
      {props.icon}
      {props.children}
    </button>
  );
}

function RecentRow({
  name,
  when,
  findings,
  tone,
  label,
  pulsing,
}: {
  name: string;
  when: string;
  findings: number;
  tone: "ok" | "danger" | "warn";
  label: string;
  pulsing: boolean;
}) {
  return (
    <article className="group flex items-center gap-4 rounded-panel border border-line bg-surface px-4 py-3 hairline transition-colors hover:border-line-strong">
      <StatusPill tone={tone} pulsing={pulsing}>
        {label}
      </StatusPill>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13.5px] font-medium text-ink">{name}</p>
        <p className="text-2xs text-ink-muted">
          {when} <span className="mx-1 text-line-strong">·</span>
          <span className="font-mono">{findings}</span> findings
        </p>
      </div>
      <button
        type="button"
        className="grid h-7 w-7 place-items-center rounded-full border border-line text-ink-faint transition-all group-hover:border-accent/55 group-hover:text-accent-strong"
        aria-label={`Open ${name}`}
      >
        <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m6 4 4 4-4 4" />
        </svg>
      </button>
    </article>
  );
}

function WorkflowCard({
  tone,
  label,
  line,
  icon,
}: {
  tone: "accent" | "info" | "warn" | "ok";
  label: string;
  line: string;
  icon: React.ReactNode;
}) {
  const toneClass: Record<string, { ring: string; bg: string; text: string; bullet: string }> = {
    accent: {
      ring: "shadow-[0_0_24px_-8px_rgba(99,102,241,0.6)]",
      bg: "border-accent/30 bg-accent-soft text-accent-strong",
      text: "text-accent-strong",
      bullet: "bg-accent-strong shadow-[0_0_8px_rgba(124,127,245,0.75)]",
    },
    info: {
      ring: "shadow-[0_0_24px_-8px_rgba(34,211,238,0.6)]",
      bg: "border-info/30 bg-info-soft text-info",
      text: "text-info",
      bullet: "bg-info shadow-[0_0_8px_rgba(34,211,238,0.75)]",
    },
    warn: {
      ring: "shadow-[0_0_24px_-8px_rgba(245,158,11,0.6)]",
      bg: "border-warn/30 bg-warn-soft text-warn",
      text: "text-warn",
      bullet: "bg-warn shadow-[0_0_8px_rgba(245,158,11,0.75)]",
    },
    ok: {
      ring: "shadow-[0_0_24px_-8px_rgba(16,185,129,0.6)]",
      bg: "border-ok/30 bg-ok-soft text-ok",
      text: "text-ok",
      bullet: "bg-ok shadow-[0_0_8px_rgba(16,185,129,0.75)]",
    },
  };
  const t = toneClass[tone];
  return (
    <div className="flex items-center gap-3 rounded-panel border border-line bg-surface p-4 hairline transition-colors hover:border-line-strong">
      <span
        className={cn(
          "relative grid h-9 w-9 shrink-0 place-items-center rounded-full border",
          t.bg,
          t.ring,
        )}
      >
        <span aria-hidden="true" className={cn("absolute inset-0 m-auto h-1 w-1 rounded-full", t.bullet)} />
        <span className="relative">{icon}</span>
      </span>
      <div className="min-w-0">
        <p className={cn("text-[13px] font-semibold tracking-[-0.005em]", t.text)}>{label}</p>
        <p className="mt-0.5 text-[12.5px] leading-5 text-ink-muted">{line}</p>
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

  async function openSample() {
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

  // Mock data shown for the "Recent Analyses" demo. Once persistence lands,
  // this section will read from the real list scoped to the current user.
  const totalRecentFindings = RECENT.reduce((sum, item) => sum + item.findings, 0);

  return (
    <div className="relative min-h-screen overflow-hidden bg-canvas">
      <div aria-hidden="true" className="ambient pointer-events-none absolute inset-x-0 top-0 h-[640px]" />

      <main className="relative mx-auto max-w-6xl px-6 pb-24 pt-10 lg:pt-16">
        {/* HERO + ILLUSTRATION */}
        <div className="grid gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
          <div>
            <p className="inline-flex items-center gap-2 rounded-chip border border-line bg-surface/70 px-3 py-1 text-2xs font-medium uppercase tracking-[0.12em] text-ink-muted backdrop-blur">
              <span
                aria-hidden="true"
                className="h-1 w-1 rounded-full bg-accent-strong shadow-[0_0_8px_rgba(124,127,245,0.7)]"
              />
              Documentation that doesn&apos;t lie
            </p>

            <h1 className="mt-7 text-display text-ink">
              Your code evolves.
              <br />
              <span className="text-gradient">Let your docs keep up.</span>
            </h1>

            <p className="body-text mt-5 max-w-xl">
              RepoScribe analyzes your repository, detects{" "}
              <span className="underline-accent font-medium text-ink">documentation drift</span>, and proposes
              verified fixes
              {" "}— powered by Alan AI and open models.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <HeroActionButton
                variant="primary"
                onClick={openSample}
                loading={busy === "sample"}
                icon={
                  <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M3.5 5.5h9M10 2.5l3 3-3 3M12.5 10.5h-9" />
                  </svg>
                }
              >
                Try sample repository
              </HeroActionButton>
              <HeroActionButton
                variant="outline"
                onClick={() => fileInput.current?.click()}
                loading={busy === "upload"}
                icon={
                  <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M3 12V4.5A1.5 1.5 0 0 1 4.5 3h7A1.5 1.5 0 0 1 13 4.5V12" />
                    <path d="M3 12h10v2.5H3Z" />
                  </svg>
                }
              >
                Upload repository ZIP
              </HeroActionButton>
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
              {provider ? (
                <p className="mt-1 inline-flex items-center gap-2 rounded-chip border border-line bg-surface/60 px-2.5 py-1 text-2xs text-ink-muted">
                  <span
                    aria-hidden="true"
                    className={`h-1 w-1 rounded-full ${
                      provider.mode === "live" ? "bg-ok" : "bg-info"
                    }`}
                  />
                  {provider.mode === "live" ? "live provider" : "local demo mode"}
                </p>
              ) : null}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-2xs text-ink-faint">
              <span>Requires no GitHub token</span>
              <span aria-hidden="true" className="text-line-strong">·</span>
              <span>Read-only analysis</span>
              <span aria-hidden="true" className="text-line-strong">·</span>
              <span>Nothing is written to your repository</span>
            </div>

            {error ? (
              <div className="mt-6 max-w-xl rounded-panel border border-danger/30 bg-danger-soft p-4 text-[13px] text-danger hairline">
                <p className="font-medium">{error.message}</p>
                <p className="mt-1.5 font-mono text-2xs text-danger/70">
                  {error.code}
                  {error.requestId ? ` · req ${error.requestId}` : ""}
                </p>
              </div>
            ) : null}

            <div className="mt-10 flex flex-wrap items-center gap-3 text-[13px]">
              <span className="text-ink-muted">Try an example:</span>
              <div className="flex flex-wrap items-center gap-2">
                {SAMPLE_LABELS.map((label) => (
                  <button
                    key={label}
                    type="button"
                    onClick={openSample}
                    className="inline-flex h-8 items-center gap-1.5 rounded-chip border border-line bg-surface px-3 text-2xs font-medium text-ink-muted transition-colors hover:border-line-strong hover:text-ink"
                  >
                    <span aria-hidden="true" className="h-1 w-1 rounded-full bg-accent-strong" />
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="lg:pt-4">
            <FeaturedIllustration />
          </div>
        </div>

        {/* WORKFLOW */}
        <section className="mt-20">
          <div className="mb-6 flex items-baseline justify-between gap-3">
            <div>
              <h2 className="text-h1 text-ink">From drift to verified fix</h2>
              <p className="body-text mt-1 max-w-xl">
                Each step is deterministic. The model only explains and drafts — never verifies.
              </p>
            </div>
            <a
              href="https://github.com/RaghavVerma99/reposcribe"
              target="_blank"
              rel="noreferrer"
              className="hidden h-9 items-center gap-2 rounded-control border border-line bg-surface px-3 text-[12.5px] text-ink-muted transition-colors hover:border-line-strong hover:text-ink sm:inline-flex"
            >
              <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
                <path d="M8 0a8 8 0 0 0-2.5 15.6c.4 0 .5-.2.5-.4v-1.4c-2.2.5-2.7-1-2.7-1-.4-.9-.9-1.2-.9-1.2-.7-.5 0-.5 0-.5.8 0 1.2.8 1.2.8.7 1.2 1.9.9 2.4.7 0-.5.3-.9.5-1.1-1.8-.2-3.6-.9-3.6-3.9 0-.9.3-1.6.8-2.1-.1-.2-.4-1 .1-2.1 0 0 .7-.2 2.2.8a7.6 7.6 0 0 1 4 0c1.5-1 2.2-.8 2.2-.8.4 1.1.2 1.9 0 2.1.5.5.8 1.2.8 2.1 0 3-1.8 3.7-3.6 3.9.3.2.5.7.5 1.4v2.1c0 .2.1.4.5.4A8 8 0 0 0 8 0Z" />
              </svg>
              GitHub
            </a>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {STEPS.map((step) => (
              <WorkflowCard key={step.label} {...step} />
            ))}
          </div>
        </section>

        {/* RECENT ANALYSES + QUOTE */}
        <section className="mt-20 grid gap-6 lg:grid-cols-[1fr_360px]">
          <div>
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-h2 text-ink">Recent analyses</h2>
                <p className="text-[12.5px] text-ink-faint">
                  <span className="font-mono text-ink">{RECENT.length}</span> analyses ·{" "}
                  <span className="font-mono text-ink">{totalRecentFindings}</span> findings addressed
                </p>
              </div>
              <a
                href="#"
                className="text-[12.5px] font-medium text-accent-strong hover:underline"
              >
                View all
              </a>
            </div>
            <div className="space-y-2.5">
              {RECENT.map((item) => (
                <RecentRow key={item.name} {...item} />
              ))}
            </div>
          </div>

          <aside className="relative">
            <div className="relative overflow-hidden rounded-panel border border-line bg-surface p-6 hairline before:absolute before:inset-0 before:rounded-panel before:border before:border-accent/30 before:opacity-60">
              <span aria-hidden="true" className="text-2xs font-medium uppercase tracking-[0.12em] text-ink-faint">
                One developer&apos;s take
              </span>
              <p className="mt-3 font-display text-2xl leading-[1.15] tracking-[-0.02em] text-ink">
                <span className="text-ink">&ldquo;Finally, a tool that keeps my&nbsp;</span>
                <span className="text-gradient">documentation&nbsp;</span>
                <span className="text-ink">honest.&rdquo;</span>
              </p>
              <p className="mt-4 flex items-center gap-2 text-[12.5px] text-ink-muted">
                <span
                  aria-hidden="true"
                  className="grid h-7 w-7 place-items-center rounded-full bg-accent-soft text-accent-strong"
                >
                  D
                </span>
                Developer
              </p>
            </div>
          </aside>
        </section>

        {/* Footer */}
        <footer className="mt-20 border-t border-line pt-6">
          <div className="flex flex-wrap items-center justify-between gap-3 text-2xs text-ink-faint">
            <p>
              RepoScribe is an open-source documentation reliability tool. Findings are evidence-backed; the
              final decision stays with the developer.
            </p>
            <p>
              v0.3.0 · MIT · open source
            </p>
          </div>
        </footer>
      </main>
    </div>
  );
}