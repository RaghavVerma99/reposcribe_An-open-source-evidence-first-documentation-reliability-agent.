import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAppState } from "../../app/AppState";
import { api, ApiError } from "../../lib/api";
import { CHECK_LABELS, cn } from "../../lib/format";
import { usePageTitle } from "../../lib/usePageTitle";
import { Button, ErrorNotice, ProviderPill } from "../../components/ui/Primitives";
import FeaturedIllustration from "../../components/landing/FeaturedIllustration";

const GITHUB_URL = "https://github.com/RaghavVerma99/reposcribe";

const FACTS = ["No GitHub token", "Read-only analysis", "Nothing written to your repository"];

const STEPS = [
  {
    tone: "accent" as const,
    label: "Detect",
    line: "Broken links, stale routes, undocumented configuration, and README gaps — each reported with its scope.",
    tag: "deterministic",
    icon: (
      <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="7" cy="7" r="4" />
        <path d="m10 10 3.5 3.5" />
      </svg>
    ),
  },
  {
    tone: "info" as const,
    label: "Explain",
    line: "Every claim is paired with the file excerpt that supports or contradicts it. No evidence, no conclusion.",
    tag: "evidence-backed",
    icon: (
      <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 3.5h7l3 3V12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z" />
        <path d="M5.5 8.5h5M5.5 10.5h3" />
      </svg>
    ),
  },
  {
    tone: "warn" as const,
    label: "Draft",
    line: "A proposed patch and rationale, generated from the finding. It stays a draft and is never applied for you.",
    tag: "reviewable",
    icon: (
      <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 12V4.5a1.5 1.5 0 0 1 1.5-1.5h7A1.5 1.5 0 0 1 13 4.5V12" />
        <path d="M3 12h10v2.5H3Z" />
        <path d="M6.5 7.5h3" />
      </svg>
    ),
  },
  {
    tone: "ok" as const,
    label: "Verify",
    line: "Validation runs against the indexed snapshot before download, and reports what it could not check.",
    tag: "no auto-apply",
    icon: (
      <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M8 1.75 13.25 4.25v6.5L8 13.25 2.75 10.75v-6.5Z" />
        <path d="m5.6 8.5 1.8 1.8 3.2-3.5" />
      </svg>
    ),
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

const PROMISES = [
  {
    title: "Want to see the whole loop?",
    body: "Run the bundled sample. No token, account, or setup required.",
    tone: "text-info",
  },
  {
    title: "Have a repository?",
    body: "Upload a ZIP. The original files are never modified.",
    tone: "text-warn",
  },
  {
    title: "Need the receipts?",
    body: "Every finding points back to the file excerpt that supports it.",
    tone: "text-accent-strong",
  },
];

export default function LandingPage() {
  const navigate = useNavigate();
  const { provider } = useAppState();
  const fileInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<"sample" | "upload" | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
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
    <div id="top" className="relative min-h-screen overflow-hidden bg-canvas">
      <div aria-hidden="true" className="ambient pointer-events-none absolute inset-x-0 top-0 h-[620px]" />

      <div className="relative mx-auto w-full max-w-3xl px-5 pb-10 sm:px-6">
        <div className="flex items-center justify-between gap-4 pt-6">
          <div className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="h-1.5 w-1.5 rounded-full bg-accent shadow-[0_0_10px_rgba(34,197,94,0.65)]"
            />
            <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-ink-faint">
              Documentation reliability
            </span>
          </div>
          <a
            href="#start"
            className="group hidden items-center gap-1.5 sm:flex"
            aria-label="Jump to the start section"
          >
            <span className="font-hand text-[20px] leading-none text-ink-muted transition-colors group-hover:text-ink">
              evidence first
            </span>
            <svg
              viewBox="0 0 20 20"
              className="h-4 w-4 -rotate-12 text-ink-faint transition-colors group-hover:text-accent-strong"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M4 5c6 1 9 4 9 10M13 11l3 4 3-4" />
            </svg>
          </a>
        </div>

        <nav className="mt-9 flex justify-center" aria-label="Page sections">
          <div className="flex items-center gap-0.5 rounded-full border border-line bg-surface/50 px-1.5 py-1.5 backdrop-blur">
            <a
              href="#top"
              aria-current="page"
              className="nav-pill nav-pill-active inline-flex items-center gap-1.5"
            >
              <svg
                viewBox="0 0 16 16"
                className="h-3.5 w-3.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M2.5 7.2 8 2.7l5.5 4.5V13a1 1 0 0 1-1 1H10V10H6v4H3.5a1 1 0 0 1-1-1Z" />
              </svg>
              Home
            </a>
            <a href="#workflow" className="nav-pill">
              Workflow
            </a>
            <a href="#checks" className="nav-pill">
              Checks
            </a>
            <a href="#start" className="nav-pill">
              Start
            </a>
          </div>
        </nav>

        <main>
          <section className="mt-12 animate-fade-up">
            <div className="flex items-center gap-4 sm:gap-5">
              <div
                aria-hidden="true"
                className="relative grid h-[76px] w-[76px] shrink-0 place-items-center rounded-2xl border border-line bg-ink text-canvas shadow-[inset_0_1px_0_rgba(255,255,255,0.4)] sm:h-20 sm:w-20"
              >
                <span className="font-display text-[25px] font-extrabold tracking-[-0.07em] sm:text-[28px]">
                  RS
                </span>
                <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border-2 border-canvas bg-accent" />
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-[30px] font-bold leading-[1.05] tracking-[-0.04em] text-ink">
                  RepoScribe
                </h1>
                <p className="mt-1 text-sm text-ink-muted">Documentation reliability</p>
              </div>
              <a
                href={GITHUB_URL}
                target="_blank"
                rel="noreferrer"
                aria-label="RepoScribe on GitHub"
                title="RepoScribe on GitHub"
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-line bg-surface/50 text-ink-muted transition-colors hover:border-line-strong hover:text-ink"
              >
                <svg viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor" aria-hidden="true">
                  <path d="M8 0a8 8 0 0 0-2.5 15.6c.4 0 .5-.2.5-.4v-1.4c-2.2.5-2.7-1-2.7-1-.4-.9-.9-1.2-.9-1.2-.7-.5 0-.5 0-.5.8 0 1.2.8 1.2.8.7 1.2 1.9.9 2.4.7 0-.5.3-.9.5-1.1-1.8-.2-3.6-.9-3.6-3.9 0-.9.3-1.6.8-2.1-.1-.2-.4-1 .1-2.1 0 0 .7-.2 2.2.8a7.6 7.6 0 0 1 4 0c1.5-1 2.2-.8 2.2-.8.4 1.1.2 1.9 0 2.1.5.5.8 1.2.8 2.1 0 3-1.8 3.7-3.6 3.9.3.2.5.7.5 1.4v2.1c0 .2.1.4.5.4A8 8 0 0 0 8 0Z" />
                </svg>
              </a>
            </div>

            <div className="mt-8 space-y-4 text-[15px] leading-[1.75] text-ink-muted sm:text-[15.5px]">
              <p>
                RepoScribe finds the places where a repository and its documentation disagree —
                then shows the <span className="text-accent-strong">evidence</span> behind every
                finding.
              </p>
              <p>
                No GitHub token. No writes to your code.{" "}
                <span className="font-medium text-ink">Every conclusion is inspectable</span>, and
                every proposed fix stays a draft until you review it.
              </p>
            </div>

            <div className="mt-7 flex flex-wrap items-center gap-2.5">
              <Button
                variant="primary"
                onClick={openSample}
                loading={busy === "sample"}
                disabled={busy !== null}
                className="h-11 px-5 text-[14px]"
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
                <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M3 12V4.5A1.5 1.5 0 0 1 4.5 3h7A1.5 1.5 0 0 1 13 4.5V12" />
                  <path d="M3 12h10v2.5H3Z" />
                </svg>
                Upload repository ZIP
              </Button>
              <a
                href={GITHUB_URL}
                target="_blank"
                rel="noreferrer"
                className="link-button h-11 px-4"
              >
                <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
                  <path d="M8 0a8 8 0 0 0-2.5 15.6c.4 0 .5-.2.5-.4v-1.4c-2.2.5-2.7-1-2.7-1-.4-.9-.9-1.2-.9-1.2-.7-.5 0-.5 0-.5.8 0 1.2.8 1.2.8.7 1.2 1.9.9 2.4.7 0-.5.3-.9.5-1.1-1.8-.2-3.6-.9-3.6-3.9 0-.9.3-1.6.8-2.1-.1-.2-.4-1 .1-2.1 0 0 .7-.2 2.2.8a7.6 7.6 0 0 1 4 0c1.5-1 2.2-.8 2.2-.8.4 1.1.2 1.9 0 2.1.5.5.8 1.2.8 2.1 0 3-1.8 3.7-3.6 3.9.3.2.5.7.5 1.4v2.1c0 .2.1.4.5.4A8 8 0 0 0 8 0Z" />
                </svg>
                GitHub
              </a>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-x-2 gap-y-2 text-2xs text-ink-faint">
              {FACTS.map((fact, index) => (
                <span key={fact} className="inline-flex items-center gap-2">
                  {index > 0 ? (
                    <span aria-hidden="true" className="text-line-strong">
                      ·
                    </span>
                  ) : null}
                  {fact}
                </span>
              ))}
              {provider ? (
                <ProviderPill
                  mode={provider.mode}
                  message={provider.message}
                  className="ml-0.5"
                />
              ) : null}
            </div>

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
          </section>

          <section className="mt-12 animate-fade-in">
            <FeaturedIllustration />
          </section>

          <section id="workflow" className="mt-20 scroll-mt-8">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="eyebrow">The review loop</p>
                <h2 className="mt-1.5 text-[30px] leading-[36px] text-ink">From drift to verified fix</h2>
              </div>
              <span className="hidden font-hand text-[20px] leading-none text-ink-faint sm:inline">
                four honest steps
              </span>
            </div>
            <p className="body-text mt-2 max-w-xl">
              Deterministic checks decide what is true. The model only explains and drafts. You
              make the final call.
            </p>

            <div className="mt-7 grid gap-4 sm:grid-cols-2">
              {STEPS.map((step, index) => {
                const tone = STEP_TONES[step.tone];
                return (
                  <article
                    key={step.label}
                    className="group rounded-2xl border border-line bg-surface p-5 transition-all duration-300 hover:border-line-strong hover:shadow-[0_18px_44px_-32px_rgba(0,0,0,0.95)]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span
                        className={cn(
                          "grid h-9 w-9 place-items-center rounded-xl border",
                          tone.icon,
                        )}
                      >
                        {step.icon}
                      </span>
                      <span className="font-mono text-2xs text-ink-faint">
                        0{index + 1}
                      </span>
                    </div>
                    <h3 className="mt-5 font-display text-[17px] font-semibold tracking-[-0.015em] text-ink">
                      {step.label}
                    </h3>
                    <p className="mt-1.5 text-[13px] leading-6 text-ink-muted">{step.line}</p>
                    <div className="mt-4 flex items-center gap-2 border-t border-line pt-3">
                      <span aria-hidden="true" className={cn("h-1 w-1 rounded-full", tone.dot)} />
                      <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-faint">
                        {step.tag}
                      </span>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          <section id="checks" className="mt-20 scroll-mt-8">
            <h2 className="text-[30px] leading-[36px] text-ink">Checks in the box</h2>
            <p className="body-text mt-2 max-w-xl">
              Deterministic checks with a stated scope. If the evidence is missing, the result is
              reported as inconclusive — never quietly passed.
            </p>
            <div className="mt-6 flex flex-wrap gap-2.5">
              {Object.values(CHECK_LABELS).map((label) => (
                <span key={label} className="tech-badge">
                  <span aria-hidden="true" className="h-1 w-1 rounded-full bg-accent-strong" />
                  {label}
                </span>
              ))}
            </div>
            <p className="mt-6 border-l-2 border-accent/40 pl-3 text-2xs leading-5 text-ink-faint">
              RepoScribe reports what it could not evaluate. A partial audit never turns an unrun
              check into a clean result.
            </p>
          </section>

          <section id="start" className="mt-20 scroll-mt-8">
            <div className="grid gap-6 md:grid-cols-[1.05fr_0.95fr]">
              <div className="rounded-2xl border border-line bg-surface p-7 sm:p-8">
                <p className="eyebrow">Start here</p>
                <h2 className="mt-2 text-[28px] leading-[1.15] text-ink">
                  Let&apos;s check what your{" "}
                  <em className="font-hand text-[1.18em] not-italic text-accent-strong">
                    docs actually say
                  </em>
                  .
                </h2>
                <div className="mt-7 space-y-5">
                  {PROMISES.map((promise) => (
                    <div key={promise.title}>
                      <h3
                        className={cn(
                          "font-display text-[15.5px] font-semibold tracking-[-0.01em]",
                          promise.tone,
                        )}
                      >
                        {promise.title}
                      </h3>
                      <p className="mt-1 text-[13px] leading-5 text-ink-muted">{promise.body}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex flex-col items-center justify-center rounded-2xl border border-line bg-surface/40 p-7 text-center">
                <div className="grid h-20 w-20 place-items-center rounded-full border-2 border-dashed border-line-strong text-ink">
                  <svg
                    viewBox="0 0 16 16"
                    className="h-6 w-6"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M8 1.75 13.25 4.25v6.5L8 13.25 2.75 10.75v-6.5Z" />
                    <path d="m5.6 8.5 1.8 1.8 3.2-3.5" />
                  </svg>
                </div>
                <h3 className="mt-5 font-display text-[20px] font-semibold tracking-[-0.02em] text-ink">
                  Ready to inspect?
                </h3>
                <p className="mt-2 max-w-xs text-[13px] leading-5 text-ink-muted">
                  Start with the sample, or bring your own repository. No account, token, or write
                  access required.
                </p>
                <div className="mt-5 flex gap-1.5" aria-hidden="true">
                  <span className="h-1.5 w-1.5 rounded-full bg-line-strong" />
                  <span className="h-1.5 w-1.5 rounded-full bg-line-strong" />
                  <span className="h-1.5 w-1.5 rounded-full bg-line-strong" />
                </div>
                <div className="mt-6 flex w-full max-w-[260px] flex-col gap-2.5">
                  <Button
                    variant="primary"
                    onClick={openSample}
                    loading={busy === "sample"}
                    disabled={busy !== null}
                    className="h-10 w-full"
                  >
                    Try sample repository
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => fileInput.current?.click()}
                    loading={busy === "upload"}
                    disabled={busy !== null}
                    className="h-10 w-full"
                  >
                    Upload repository ZIP
                  </Button>
                </div>
                <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-faint">
                  sample or ZIP · no account
                </p>
                {provider ? (
                  <ProviderPill
                    mode={provider.mode}
                    message={provider.message}
                    className="mt-3"
                  />
                ) : null}
              </div>
            </div>
          </section>
        </main>

        <footer className="mt-16 border-t border-line pt-6">
          <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
            <p className="font-hand text-[20px] leading-none text-ink-faint">
              good docs deserve receipts.
            </p>
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
              <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-faint">
                read-only
              </span>
            </nav>
          </div>
        </footer>
      </div>

      {error ? (
        <div className="fixed inset-x-4 bottom-4 z-50 mx-auto w-auto max-w-lg animate-fade-up sm:bottom-6">
          <ErrorNotice
            error={error}
            onRetry={retryLast}
            onDismiss={() => setError(null)}
          />
        </div>
      ) : null}
    </div>
  );
}
