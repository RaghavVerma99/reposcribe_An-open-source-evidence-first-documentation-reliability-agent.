# RepoScribe — Documentation that doesn't lie

RepoScribe is an evidence-first documentation reliability tool. It scans a repository, finds concrete
mismatches between the code and its documentation, shows the exact file and line behind each finding, and
prepares a minimal Markdown repair that you review, validate, and export.

**Screenshot / recording:** not committed in this build. Record one locally with the demo script in
`docs/demo-script.md` before publishing; do not add placeholder media.

**Current status:** MVP (`v1.0`) implemented and tested. Model-assisted phrasing runs in a clearly labelled
local demo mode. The Alan adapter is present but disabled until the integration contract is verified — see
[Alan integration](#alan-ai-integration).

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
- 63 backend tests across unit, integration, and security suites.

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
| Tests | Pytest with `httpx`/Starlette `TestClient` |
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

Copy `.env.example` to `.env`. `.env` is gitignored and is never indexed, read for values, or sent anywhere.
Configuration lives in `backend/app/core/settings.py`; secrets are backend-only and are never exposed through a
`VITE_` variable.

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

Last observed run in this build: `63 passed` (backend), `tsc --noEmit` and `vite build` clean (frontend).

## Sample repository walkthrough

The bundled sample lives in `backend/app/data/sample_repo` and intentionally contains drift:

1. Open the app and choose **Try sample repository**.
2. Run the audit. Expect 10 findings: four verified route mismatches (README and `docs/api.md` document
   `GET/POST /api/users` and `DELETE /api/users/{user_id}` while the source defines `/api/v2/users`), one broken
   internal link (`docs/setup.md`), one missing file reference (`scripts/seed.py`), two undocumented environment
   variables (`REDIS_URL`), one undocumented symbol, and one README checklist suggestion.
3. Open a route finding. The inspector shows the README table row, the `APIRouter(prefix="/api/v2")` line, and
   the decorator, all with line numbers.
4. Choose **Generate fix**, then **Validate patch**. Validation reruns the check that produced the finding,
   re-resolves every internal link, and confirms referenced files still exist.
5. Download the patch or the updated Markdown.

## Benchmark methodology and results

Methodology is defined in `docs/evaluation.md`. **No benchmark has been run yet, so no precision, recall, or
timing figures are published here.** Product claims must not precede measured numbers.

## Security and privacy

- Repository contents stay inside the local workspace. Nothing is uploaded anywhere in this build, because no
  live model provider is configured.
- If a live provider is enabled later, only bounded evidence excerpts would be sent, and the README must say so
  before the feature ships.
- `.env`, key files, and credential files are excluded from indexing and never sent to a model.
- Workspaces are isolated per repository, path-checked on every read, and deleted on request or after the TTL.
- Repository text is treated as untrusted input: prompt-injection content cannot change what the backend allows.
- Errors return a request ID with no stack traces or secrets.

## Known limitations

- Python and FastAPI only, and only statically resolvable decorator routes. Dynamic registration is reported as
  inconclusive rather than absent.
- Route, symbol, and configuration checks are deliberately conservative and default to `needs_review`.
- Automatic patch generation is implemented for route, internal-link, and symbol findings. Other findings need a
  human.
- Audit state is in memory per session; restarting the backend clears it.
- No `Apply patch` control exists, because applying changes in place is not implemented.

## Roadmap

See `SPEC.md` §35. Next: GitHub import, OpenAPI comparison, and the benchmark harness.

## Contributing

See `CONTRIBUTING.md`. Run the backend and frontend test commands above before opening a pull request.

## License

MIT — see `LICENSE`.