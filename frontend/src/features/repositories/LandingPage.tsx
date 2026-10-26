import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAppState } from "../../app/AppState";
import { api, ApiError } from "../../lib/api";
import { Badge, Button, ErrorNotice, Spinner } from "../../components/ui/Primitives";
import { DiffViewer } from "../../components/diff/DiffViewer";

const EXAMPLE_DIFF = `--- a/docs/api.md
+++ b/docs/api.md
@@
-| \`GET\` | \`/api/users\` | List users |
+| \`GET\` | \`/api/v2/users\` | List users |`;

const BENEFITS = [
  {
    index: "01",
    title: "Detect drift",
    body: "Deterministic checks compare what the docs claim with what the repository actually contains.",
  },
  {
    index: "02",
    title: "Trace evidence",
    body: "Every finding cites real file paths and line ranges you can open and verify yourself.",
  },
  {
    index: "03",
    title: "Propose verified fixes",
    body: "A minimal Markdown patch, a real diff, and validation that reruns the check that found the problem.",
  },
];

const SCOPE = [
  "Six deterministic checks: internal links, file references, API routes, configuration, symbols, README checklist.",
  "Python 3.11+ and FastAPI projects with Markdown documentation.",
  "Bundled sample repository or your own ZIP.",
  "Dynamic route registration, non-Python sources, and external URLs are reported as limitations, not guesses.",
];

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

  return (
    <div className="relative min-h-screen overflow-hidden bg-canvas">
      <div aria-hidden="true" className="ambient pointer-events-none absolute inset-x-0 top-0 h-[560px]" />

      <header className="relative mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden="true"
            className="grid h-7 w-7 place-items-center rounded-[8px] bg-accent text-[12px] font-bold text-white shadow-[0_0_24px_-8px_rgba(99,102,241,0.95)]"
          >
            R
          </span>
          <span className="text-[13px] font-semibold tracking-tight text-ink">RepoScribe</span>
        </div>
        {provider ? (
          <Badge tone={provider.mode === "live" ? "ok" : "info"}>
            <span
              aria-hidden="true"
              className={provider.mode === "live" ? "h-1 w-1 rounded-full bg-ok" : "h-1 w-1 rounded-full bg-info"}
            />
            {provider.mode === "live" ? "live model" : "local demo mode"}
          </Badge>
        ) : null}
      </header>

      <main className="relative mx-auto max-w-6xl px-6 pb-24">
        <div className="grid gap-14 pt-10 lg:grid-cols-[1.02fr_0.98fr] lg:items-start lg:pt-16">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-2xs font-medium text-ink-muted">
              <span aria-hidden="true" className="h-1 w-1 rounded-full bg-accent-strong" />
              Evidence-first documentation audit
            </p>

            <h1 className="mt-6 max-w-[16ch] text-[42px] font-semibold leading-[0.98] tracking-[-0.035em] text-ink sm:text-[58px]">
              Documentation
              <br />
              that doesn&apos;t lie.
            </h1>

            <p className="mt-5 max-w-lg text-[15px] leading-7 text-ink-muted">
              Detect drift between code and docs. Inspect the evidence. Review a minimal repair — then decide.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button variant="primary" onClick={openSample} loading={busy === "sample"} className="h-9 px-4">
                Try sample repository
              </Button>
              <Button onClick={() => fileInput.current?.click()} loading={busy === "upload"} className="h-9 px-4">
                Upload repository ZIP
              </Button>
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

            <p className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-2xs text-ink-faint">
              <span>No GitHub token</span>
              <span aria-hidden="true" className="text-line-strong">
                /
              </span>
              <span>Read-only analysis</span>
              <span aria-hidden="true" className="text-line-strong">
                /
              </span>
              <span>Nothing is written to your repository</span>
            </p>

            {error ? (
              <div className="mt-6 max-w-lg">
                <ErrorNotice
                  error={error}
                  onRetry={
                    error.code === "invalid_archive" || error.code === "unsafe_archive_entry"
                      ? undefined
                      : openSample
                  }
                />
              </div>
            ) : null}

            <dl className="mt-12 grid gap-px overflow-hidden rounded-panel border border-line bg-line sm:grid-cols-3">
              {BENEFITS.map((benefit) => (
                <div key={benefit.title} className="bg-canvas p-4">
                  <dt className="flex items-baseline gap-2">
                    <span className="font-mono text-2xs text-accent-strong">{benefit.index}</span>
                    <span className="text-[13px] font-semibold text-ink">{benefit.title}</span>
                  </dt>
                  <dd className="mt-1.5 text-2xs leading-5 text-ink-muted">{benefit.body}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="rounded-panel border border-line bg-surface shadow-lift">
            <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
              <div className="flex items-center gap-2">
                <span className="flex gap-1" aria-hidden="true">
                  <span className="h-1.5 w-1.5 rounded-full bg-line-strong" />
                  <span className="h-1.5 w-1.5 rounded-full bg-line-strong" />
                  <span className="h-1.5 w-1.5 rounded-full bg-line-strong" />
                </span>
                <span className="ml-1 font-mono text-2xs text-ink-faint">finding · patch · validation</span>
              </div>
              <Badge tone="neutral">example output</Badge>
            </div>

            <div className="space-y-4 p-4">
              <div className="rounded-control border border-line bg-canvas p-3">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge tone="danger">high</Badge>
                  <Badge tone="ok">
                    <span aria-hidden="true" className="h-1 w-1 rounded-full bg-ok" />
                    verified
                  </Badge>
                  <span className="ml-1 font-mono text-2xs text-ink-faint">fastapi.route_matches_docs</span>
                </div>
                <p className="mt-2.5 text-[13px] font-medium text-ink">
                  Documented API route was not found in source
                </p>
                <p className="mt-1.5 text-2xs leading-5 text-ink-muted">
                  Docs describe <span className="font-mono text-ink">GET /api/users</span>; the decorator and router
                  prefix resolve to <span className="font-mono text-ink">GET /api/v2/users</span>.
                </p>
                <p className="mt-2.5 font-mono text-2xs text-ink-faint">
                  README.md <span className="text-line-strong">L22</span> · app/routes/users.py{" "}
                  <span className="text-line-strong">L4, L15</span>
                </p>
              </div>

              <div>
                <p className="mb-2 flex items-center justify-between text-2xs text-ink-faint">
                  <span className="font-medium uppercase tracking-[0.08em]">Proposed patch</span>
                  <span>
                    <span className="text-ok">+1</span> <span className="text-danger">−1</span>
                  </span>
                </p>
                <DiffViewer diff={EXAMPLE_DIFF} />
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {["V-1", "V-2", "V-3", "V-4", "V-5", "V-6"].map((step) => (
                  <span
                    key={step}
                    className="inline-flex items-center gap-1 rounded-full border border-ok/20 bg-ok-soft px-2 py-0.5 font-mono text-2xs text-ok"
                  >
                    <span aria-hidden="true" className="h-1 w-1 rounded-full bg-ok" />
                    {step}
                  </span>
                ))}
                <span className="ml-1 text-2xs text-ink-faint">all passed</span>
              </div>

              <p className="border-t border-line pt-3 text-2xs leading-5 text-ink-muted">
                Validation re-runs the check that produced the finding, re-resolves internal links, and confirms
                referenced files still exist. Passing is not proof that every sentence is correct.
              </p>
            </div>
          </div>
        </div>

        <section className="mt-16 rounded-panel border border-line bg-surface p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-[13px] font-semibold tracking-tight text-ink">Scope of this build</h2>
            {busy ? (
              <p className="flex items-center gap-2 text-2xs text-ink-faint">
                <Spinner className="text-accent-strong" /> Preparing repository…
              </p>
            ) : (
              <p className="text-2xs text-ink-faint">Limitations are shown, not hidden</p>
            )}
          </div>
          <ul className="mt-4 grid gap-x-8 gap-y-2.5 sm:grid-cols-2">
            {SCOPE.map((item) => (
              <li key={item} className="flex gap-2.5 text-2xs leading-5 text-ink-muted">
                <span aria-hidden="true" className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-line-strong" />
                {item}
              </li>
            ))}
          </ul>
          <p className="mt-4 border-t border-line pt-3 text-2xs leading-5 text-ink-faint">
            {provider?.mode === "live"
              ? "A live model provider is configured for explanations and patch drafting."
              : "Running in local demo mode: answers and patches are produced by deterministic rules, not by a language model."}
          </p>
        </section>
      </main>

      <footer className="relative border-t border-line py-6">
        <div className="mx-auto max-w-6xl px-6 text-2xs text-ink-faint">
          RepoScribe is an open-source documentation reliability tool. Findings are evidence-backed suggestions; the
          final decision stays with the developer.
        </div>
      </footer>
    </div>
  );
}