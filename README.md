# RepoScribe

**Evidence-first documentation drift detection.** RepoScribe scans a repository, finds concrete
mismatches between its documentation and its code, cites the file and line behind each finding, and
drafts a minimal documentation patch that you review, validate, and export.

**Live demo:** <https://reposcribe-n5bo.onrender.com> · Render free instance; the first request after
inactivity may cold-start.

**Status:** version `0.3.0`, tagged `v0.3.0`. `main` also contains post-tag fixes (audit items, UI,
static delivery, SQLite persistence). 143 backend tests, 12 browser tests / 51 checks, CI green.

---

## Overview

Documentation drifts when routes are renamed, configuration changes, signatures move, and setup steps
are replaced. Existing tools either generate new prose from code or answer questions about a
repository; neither detects and explains contradictions in the documentation you already have.

RepoScribe separates **verification** from **assistance**:

- Deterministic checks establish what is true inside a stated scope.
- The model only explains findings and drafts patches.
- Every finding carries evidence; an unsupported claim is reported as `insufficient_evidence`, never
  as a defect.

Repositories, findings, audit snapshots, patches, and per-run deltas are persisted in SQLite. The
repository index is rebuilt from the workspace on demand, so a restart restores sessions and history
without replaying an audit.

## Capabilities

| Does | Does not |
|---|---|
| Detect drift between docs and repository facts | Rewrite application code |
| Cite real paths and one-based line ranges | Commit, push, or open pull requests |
| Propose minimal, documentation-only patches | Apply a patch in place |
| Separate `verified` findings from suggestions | Guarantee that every semantic claim is correct |
| Run the deterministic checks with no model | Require a GitHub token |

## Checks

| ID | Verifies | Scope |
|---|---|---|
| `markdown.internal_link_exists` | Relative Markdown links and heading anchors | External URLs are never fetched |
| `docs.file_reference_exists` | Paths written in prose, tables, and code spans | Generated files are unknown |
| `fastapi.route_matches_docs` | Documented routes against statically discovered FastAPI decorators | Dynamic registration is `insufficient_evidence`, never "missing" |
| `config.env_var_documented` | Documented variables against `.env.example` and scanned source | Single-word names require configuration context; injected variables stay `needs_review` |
| `python.public_symbol_referenced` | Dotted Python symbol references in documentation | Re-exports and dynamic attributes may be missed |
| `docs.readme_checklist` | Installation, run, tests, and license sections | Structure only, not prose quality |

Finding status: `verified`, `needs_review`, `insufficient_evidence`, `resolved` after a rescan, or
`dismissed`. A check that does not run cannot resolve a finding.

## Architecture

```text
React + TypeScript (Vite)
        |  HTTPS / JSON  (no secrets in the browser)
        v
FastAPI  (/api/v1)
        |
        +--> Repository intake + isolated workspace   (untrusted ZIP handling)
        +--> Deterministic analysis engine            (6 analyzers, no model)
        +--> Evidence index
        +--> Provider interface
        |      +--> local_demo (rules, default)
        |      +--> Alan adapter (disabled until the contract is verified)
        +--> Patch builder + validator
        +--> Durable state (SQLite) + disposable workspace
```

The backend gathers facts, sends a bounded evidence bundle to the provider when one is enabled, and
validates every path, citation, and schema on the way back. See [`docs/architecture.md`](docs/architecture.md).

## Quick start

Backend (PowerShell; the POSIX equivalent is shown below):

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -e ".[dev]"
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
```

```sh
# POSIX
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
uvicorn app.main:app --reload --port 8000
```

Frontend:

```powershell
cd frontend
npm ci
npm run dev
```

Open <http://localhost:5173>. Vite proxies `/api` to `127.0.0.1:8000`.

**Single-service mode:** run `npm run build` in `frontend/`, then start only the backend. FastAPI
serves the bundle from `frontend/dist` at `/`, with an SPA fallback for client routes.

## API

All routes are under `/api/v1`. Errors are JSON with `code`, `message`, `request_id`, and `retryable`.

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/repositories` | Create from `sample_id` or a ZIP upload |
| `GET` | `/repositories/{id}` | Repository metadata |
| `GET` | `/repositories/{id}/overview` | Files, routes, languages, findings by status |
| `GET` | `/repositories/{id}/search` | Repository search |
| `DELETE` | `/repositories/{id}` | Delete the repository and workspace |
| `POST` | `/repositories/{id}/audits` | Run an audit (synchronous, time-budgeted) |
| `GET` | `/repositories/{id}/audits` | Audit history with per-run deltas |
| `GET` | `/repositories/{id}/audits/{audit_id}` | Full finding snapshot for one run |
| `GET` | `/repositories/{id}/findings` | Filter by status, severity, check, query |
| `GET` | `/repositories/{id}/findings/{finding_id}` | Finding detail; returns an `ETag` |
| `PATCH` | `/repositories/{id}/findings/{finding_id}` | Change status; honours `If-Match`, returns `412` on a stale revision |
| `POST` | `/repositories/{id}/findings/{finding_id}/patches` | Draft a documentation patch |
| `POST` | `/repositories/{id}/patches/{patch_id}/validate` | Re-run the checks against the draft |
| `GET` | `/repositories/{id}/patches/{patch_id}/download` | Download the patch or revised file |
| `POST` | `/repositories/{id}/questions` | Grounded Q&A with citation verification |
| `GET` | `/health`, `/provider` | Liveness and provider state |

## Configuration

Values are read from the process environment; no `.env` file is auto-loaded. Use
[`.env.example`](.env.example) as the checklist. Secrets are backend-only and never exposed through a
`VITE_` variable.

| Variable | Default | Purpose |
|---|---|---|
| `APP_ENV` | `development` | `production` also marks the session cookie `Secure` |
| `SESSION_SECRET` | per-process | Signs the anonymous session cookie; must be shared across workers |
| `MODEL_PROVIDER` | `local_demo` | `alan` is blocked until its contract is verified |
| `WORKSPACE_ROOT` | `./.reposcribe-workspaces` | Disposable per-repository workspaces |
| `WORKSPACE_TTL_MINUTES` | `120` | Idle workspace expiry |
| `REPOSCRIBE_DB_PATH` | `./.reposcribe/state.db` | Durable SQLite state; must be on a restart-safe filesystem |
| `MAX_CONCURRENT_WORKSPACES` | `8` | Live workspaces per instance; further creations return `503`. The Render blueprint sets `32` |
| `MAX_UPLOAD_MB` | `20` | Upload cap |
| `AUDIT_TIMEOUT_SECONDS` | `60` | Time budget per audit |
| `REPOSCRIBE_LOG_LEVEL` | `INFO` | Backend log level |

The provider contract (`local_demo` by default; the Alan adapter refuses to fabricate a response) is
documented in [`docs/alan-integration.md`](docs/alan-integration.md).

## Tests

```powershell
cd backend
.\.venv\Scripts\python.exe -m pytest -q      # 143 passed
```

```powershell
cd frontend
npm run typecheck                             # tsc --noEmit
npm run build                                 # Vite production build
npm run test:e2e                              # 12 tests, 51 checks
```

The Playwright suite covers route titles and headings, self-hosted fonts, the landing layout at
1440 px, 360 px, and reduced motion, no horizontal overflow, URL filter state, grounded Ask answers,
provider labelling, the finding lifecycle, the mobile drawer focus trap and `inert` background, no
external requests, and a clean console. It uses installed Google Chrome by default; set
`PLAYWRIGHT_CHANNEL=chromium` after `npm run test:e2e:install` to use Playwright's Chromium.

CI runs the backend, frontend, and end-to-end jobs on every push and pull request to `main`.

## Deployment

One long-lived FastAPI process serves `/api/v1` and the built UI. Durable state lives in SQLite and
workspaces on disk, so both paths must be on a restart-safe filesystem. Run one worker: the state cache
and the generated `SESSION_SECRET` are per process.

| Target | Contents |
|---|---|
| **Render** (recommended) | `Dockerfile` + `render.yaml`: one Docker web service, health check `/api/v1/health` |
| **Vercel** | `vercel.json` + `api/proxy.js`: static UI with a same-origin `/api/v1` proxy to Render |

Render is the supported full deployment. Vercel functions impose a request-body limit and a duration
limit, so large uploads and long audits belong on Render. On a Render free instance the filesystem is
ephemeral: attach a persistent disk (paid) and point `REPOSCRIBE_DB_PATH` and `WORKSPACE_ROOT` at it to
keep sessions and history across sleep and deploys. Step-by-step instructions, the disk configuration,
environment variables, and failure modes: [`docs/deploy.md`](docs/deploy.md).

Static delivery: hashed bundles under `/assets` and `/fonts` are cached for one year as immutable; the
HTML shell is `no-cache` so a deploy never leaves a stale document pointing at removed assets.

## Security model

- Repository archives are treated as untrusted: path traversal, symlinks, entry counts, sizes, and
  compression bombs are rejected before indexing.
- Reads are path-checked against the workspace root, including Markdown link resolution.
- `.env`, key files, and credential files are excluded from the index, manifest, and counts.
- The session cookie is signed; a forged value is ignored and a fresh session is issued.
- Requests are rate-limited per client address; JSON bodies are capped at 1 MB; every audit runs inside
  a time budget; each check caps its findings and states the cap.
- At most `MAX_CONCURRENT_WORKSPACES` repositories are live per instance; excess creations return `503`.
- Status changes use a revision `ETag` and `If-Match`, so concurrent edits cannot silently overwrite.
- Errors return a request id with no stack traces or secrets.

## Known limitations

- Python and FastAPI only, and only statically resolvable decorator routes.
- Patch generation is implemented for route, internal-link, and symbol findings; other findings need a
  human.
- State is only as durable as the filesystem: a restart restores history when `REPOSCRIBE_DB_PATH` is on
  a persistent volume. Without the workspace, history stays readable but re-auditing returns `410`.
- No benchmark has been run, so no precision, recall, or timing figures are published. The procedure is
  defined in [`docs/evaluation.md`](docs/evaluation.md).
- The provider runs in `local_demo`; no live model is connected.
- No GitHub import or PR checks yet.

## Sample repository

`backend/app/data/sample_repo` is a deliberately small FastAPI project containing real drift. An audit
of the sample produces **10 findings: 6 `verified`, 4 `needs_review`** — a stale route, a missing setup script,
a broken link, an undefined `REDIS_URL`, an unknown symbol, and a missing license. See
[`docs/demo-script.md`](docs/demo-script.md) for a click-by-click walkthrough.

## Roadmap

| Priority | Work |
|---|---|
| Next | Benchmark harness with measured recall and false-positive rate; coverage gate |
| Next | Public GitHub import, then diff-aware scans and a CLI (`reposcribe check --base`) |
| Then | GitHub Action PR comment with the per-run delta, and diff-aware scans |
| Then | OpenAPI-first route detection and a `RouteSource` abstraction |
| Later | Policy files, analyzer plugins, additional languages |

Open audit items are tracked in [`docs/audit-2026-10.md`](docs/audit-2026-10.md) and
[`docs/audit-2026-10-verification.md`](docs/audit-2026-10-verification.md).

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md). Run the backend, frontend, and end-to-end commands above
before opening a pull request.

## License

MIT — see [`LICENSE`](LICENSE).
