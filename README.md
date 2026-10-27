# RepoScribe — Documentation that doesn't lie

RepoScribe is an evidence-first documentation reliability tool. It scans a repository, finds concrete
mismatches between the code and its documentation, shows the exact file and line behind each finding, and
prepares a minimal Markdown repair that you review, validate, and export.

**Screenshot / recording:** not committed in this build. Record one locally with the demo script in
`docs/demo-script.md` before publishing; do not add placeholder media.

**Current status:** MVP source version `0.3.0`, implemented and tested, tagged `v0.3.0` after CI passed on
2026-10-27. The tag is the first reproducible snapshot, not a production release. Model-assisted phrasing runs in a clearly labelled
local demo mode. The Alan adapter is present but disabled until the integration contract is verified — see
[Alan integration](#alan-ai-integration).
**Open issues and what got into each milestone** are tracked in [`docs/audit-2026-10.md`](docs/audit-2026-10.md).
`v1.0` is reserved for the milestone defined there (zero High/Medium open, a benchmark with measured numbers).

---

## Problem

Documentation goes stale as routes are renamed, configuration changes, signatures move, and setup steps
drift. Those edits land in pull requests focused on behaviour, and the docs are forgotten. Existing tools
either generate new text from code or answer questions about a repository; neither detects and explains
contradictions in the documentation you already have.

## What RepoScribe does and does not do

| Does | Does not |
|---|---|
| Detects drift between docs and repository facts | Rewrite application code |
| Cites real file paths and line ranges | Claim a route is missing when the pattern is unsupported |
| Proposes minimal, documentation-only patches | Commit, push, or open pull requests |
| Separates verified findings from suggestions | Guarantee that every semantic claim is correct |
| Runs deterministic checks with no model at all | Require a GitHub token |

## Features

**Implemented**

- Bundled sample repository and ZIP upload with hostile-input handling (traversal, symlinks, size, count, bombs).
- Six deterministic checks: internal Markdown links and anchors, documented file references, documented API
  routes versus statically discovered FastAPI routes, documented environment variables, documented Python
  symbols, and a README/setup checklist.
- Evidence inspector with paired documentation and source snippets, one-based line ranges, and bounded excerpts.
- Grounded repository Q&A with citation verification: any citation that does not map to retrieved evidence is
  dropped and reported.
- Minimal Markdown patch generation, unified diff, six-step validation, and safe export.
- Finding lifecycle: verified, needs review, insufficient evidence, resolved after a rescan, dismissed.
- Provider interface with an honest local demo provider, plus an Alan adapter that refuses to pretend.
- 136 backend tests across unit, integration, and security suites (one built-SPA check skips until
  `frontend/dist` exists).

**Planned**

- Public GitHub repository import and pull-request checks.
- OpenAPI contract comparison and a documentation coverage map.
- Incremental scanning from git diffs, persistent audit history, policy rules.
- Tree-sitter support for additional languages.
- Benchmark harness with published precision and recall figures.

## Architecture

```text
React + TypeScript (Vite)
        |  HTTPS / JSON  (no secrets in the browser)
        v
FastAPI application  (/api/v1)
        |
        +--> Repository intake + isolated workspace   (untrusted ZIP handling)
        +--> Deterministic analysis engine            (6 analyzers, no model)
        +--> Evidence store / index
        +--> Model provider interface
        |      +--> Local demo provider (rules, always available)
        |      +--> Alan adapter (disabled until the contract is verified)
        +--> Patch builder + validator
        +--> Audit + session state
```

The model never invents repository facts. The backend gathers facts, sends a bounded evidence bundle, then
validates every path, citation, and schema on the way back. See `docs/architecture.md`.

## Alan AI integration

Honest status: **not live.** The hackathon's exact Alan product, SDK, authentication scheme, and permitted
open model have not been verified in this build, so nothing claims to be connected.

- `GET /api/v1/provider` reports `mode: "local_demo"`, `verified_contract: false`.
- The Alan adapter (`backend/app/integrations/alan.py`) is wired into the provider factory and raises a clear
  `provider_unavailable` error rather than fabricating a response.
- Toggle with `MODEL_PROVIDER=alan` once the contract is verified. The full gate is in
  `docs/alan-integration.md`.

**Open model:** not selected yet. When it is, record the model name, its license, and the configuration in this
section and in `.env.example`. Do not substitute a proprietary model silently.

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, React Router |
| Backend | Python 3.11+, FastAPI, Pydantic v2, Uvicorn |
| Parsing | `ast` for Python, purpose-built Markdown and route extractors |
| Tests | Pytest with `httpx`/Starlette `TestClient`; Playwright for the browser workflow |
| Storage | In-memory session state plus a disposable on-disk workspace |

## Local setup

Backend (Windows PowerShell shown; the same commands work on POSIX with `source .venv/bin/activate`):

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -e ".[dev]"
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
```

On POSIX the same steps are `python -m venv .venv`, `source .venv/bin/activate`, then
`pip install -e ".[dev]"`.

Frontend:

```powershell
cd frontend
npm install
npm run dev
```

Open <http://localhost:5173>. The Vite dev server proxies `/api` to `127.0.0.1:8000`.

Single-service mode: run `npm run build` in `frontend/` once, then start only the backend. The API serves the
built UI from `frontend/dist` at `/`.

## Environment

Use `.env.example` as the checklist of supported configuration variables. This build reads values from the
process environment; it does **not** auto-load a `.env` file. Export the variables in your shell (or through your
process manager) before starting uvicorn. `.env` is gitignored and is never indexed, read for values, or sent
anywhere. Configuration lives in `backend/app/core/settings.py`; secrets are backend-only and are never exposed
through a `VITE_` variable.

## Tests

```powershell
cd backend
.\.venv\Scripts\python.exe -m pytest -q
```

```powershell
cd frontend
npm run typecheck
npm run build
```

End-to-end (builds the frontend, starts its own backend, and seeds the sample repository through the API; stop any
other process on `127.0.0.1:8000` first):

```powershell
cd frontend
npm run test:e2e
```

The Playwright suite runs 12 tests covering 50 checks: route titles and headings, self-hosted fonts, the landing
narrative at 1440 px, 360 px, and under reduced motion, no horizontal overflow, URL filter state, grounded Ask
answers, the finding dismiss/reopen lifecycle, the mobile drawer focus trap, no external requests, and a clean
console. It uses installed Google Chrome by default. To
use Playwright's Chromium instead, run `npm run test:e2e:install` once and then set `PLAYWRIGHT_CHANNEL=chromium`.

Last observed run in this build: `133 passed` (backend; one built-SPA check skips when `frontend/dist` has not
been built), `tsc --noEmit` and `vite build` clean (frontend), and `12 passed` (Playwright, 50 checks). The CI
workflow is configured to run the backend, frontend, and end-to-end jobs on every push and pull request to
`main`.

## Deployment

One FastAPI service serves both `/api/v1` and the built UI, so it must run as a single long-lived process:
audit sessions and workspaces are held in memory. Render is the supported one-service target. Vercel can host
the static UI with a same-origin proxy to that service.

- `Dockerfile` — multi-stage build: the Vite bundle, then uvicorn with one worker.
- `render.yaml` — Render Blueprint with the health check and required environment variables.
- `vercel.json` + `api/proxy.js` — static UI plus a same-origin `/api/v1` proxy.
- Step-by-step instructions, environment variables, and caveats: [`docs/deploy.md`](docs/deploy.md).

Do not raise `--workers`: sessions and the generated `SESSION_SECRET` are per process.

## Sample repository walkthrough

The bundled sample lives in `backend/app/data/sample_repo`. It is deliberately small and contains real
documentation drift, so the first run produces a useful result.

1. Start the backend and frontend as described above.
2. Open the app and choose **Try sample repository**. The overview shows 8 files, 2 documentation files, and
   2 discovered routes.
3. Choose **Run audit**. Expect 10 findings: 6 `verified` and 4 `needs_review`.
4. Open the first high, `verified` route finding (its documentation file is `docs/api.md` and its claim is
   `GET /api/users`). The inspector shows the table row, the `APIRouter(prefix="/api/v2")` line, and the route
   decorator, each with a file and line number.
5. Choose **Generate fix**, then **Validate patch**. The patch changes the one row that produced the finding.
   Validation compares every check before and after the patch: it fails if the finding still reproduces or if
   the patch introduces a new finding, and it counts only links the patch itself breaks. Passing means this
   finding is fixed and nothing new was introduced, not that every sentence in the document is correct.
6. Download the patch or the updated Markdown.

What the sample contains:

| Status | Count | Defect |
|---|---|---|
| `verified` | 4 | README and `docs/api.md` document `/api/users`, but the source defines `/api/v2/users` |
| `verified` | 1 | README references `scripts/seed.py`, which does not exist |
| `verified` | 1 | README links to `docs/setup.md`, which does not exist |
| `needs_review` | 2 | `REDIS_URL` is documented but not defined in `.env.example` or the source |
| `needs_review` | 1 | `app.settings.load_settings_legacy` is documented but not indexed |
| `needs_review` | 1 | The sample has no `LICENSE` file |

For a click-by-click presenter script, see [`docs/demo-script.md`](docs/demo-script.md).

## Benchmark methodology and results

Methodology is defined in `docs/evaluation.md`. **No benchmark has been run yet, so no precision, recall, or
timing figures are published here.** Product claims must not precede measured numbers.

## Security and privacy

- Repository contents are processed locally and are not sent to any third party in this build; no live model
  provider is configured.
- If a live provider is enabled later, only bounded evidence excerpts would be sent, and the README must say so
  before the feature ships.
- `.env`, key files, and credential files are excluded from indexing and never sent to a model.
- Workspaces are isolated per repository, path-checked on every read, and deleted on request or after the TTL.
- Repository text is treated as untrusted input: prompt-injection content cannot change what the backend allows.
- Errors return a request ID with no stack traces or secrets.
- The session cookie is signed, so a client cannot pick a session id it likes; a forged value falls back to a
  fresh session that sees nothing.
- Requests are capped per client address (not by the session cookie, which a client can mint at will), JSON
  bodies are capped at 1 MB, every audit runs inside a time budget, and each check reports at most 100
  findings and says so when it caps.
- At most `MAX_CONCURRENT_WORKSPACES` (default 8) repositories are live per instance; further creations return
  503 rather than exhausting disk. Concurrent status changes are guarded by a revision `ETag` and `If-Match`.

## Known limitations

A categorized list of open audit findings, with severities and where to fix them, lives in
[`docs/audit-2026-10.md`](docs/audit-2026-10.md). The product-level facts worth keeping in this README are:

- Python and FastAPI only, and only statically resolvable decorator routes. Dynamic registration is reported as
  inconclusive rather than absent, never as missing.
- Route prefixes are resolved across modules: a router declared in one file and mounted in another is compared at
  its real path. A mount that cannot be located, or a prefix that is not a literal, is reported as unresolved.
- Route findings are `verified` when the router prefix resolves statically; a prefix that cannot be resolved makes
  them `insufficient_evidence` with a limitation. Symbol and configuration findings default to `needs_review`.
- Automatic patch generation is implemented for route, internal-link, and symbol findings. Other findings need a
  human.
- Audit state is in memory per session; restarting the backend clears it.
- No `Apply patch` control exists, because applying changes in place is not implemented.

## Roadmap

See `SPEC.md` §35. Next: GitHub import, OpenAPI comparison, and the benchmark harness.

## Contributing

See `CONTRIBUTING.md`. Run the backend, frontend, and end-to-end test commands above before opening a pull
request.

## License

MIT — see `LICENSE`.