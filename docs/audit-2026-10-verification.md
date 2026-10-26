# RepoScribe — independent audit and next-step plan

**Date:** 2026-10-26
**Scope:** `SPEC.md`, `README.md`, `docs/`, CI, backend and frontend source.
**Method:** static read-through plus runtime probes (sample audit, partial audit, dynamic router prefix, secret-file manifest, SPA deep link, Markdown link resolution).
**Changes made:** none. The 15 pre-existing uncommitted files were preserved.

---

## 1. Verdict

The deterministic core is real and works:

- The bundled sample produces **10 findings** — 6 `verified`, 4 `needs_review` — and runs all six checks.
- The frontend typechecks and builds cleanly.
- The backend has **86 tests**, of which **85 pass**.

The product is **not yet releasable as described**:

1. **CI is red.** `test_request_logging_emits_one_info_line_per_request` fails.
2. **The landing page contains fabricated product claims** (Alan/open models, fake analyses, fake metrics, fake testimonial) and inert controls, in direct violation of SCR-01, UI-10, and OP-03.
3. **Mobile navigation cannot be opened.** The hamburger is rendered inside a `hidden lg:flex` container and is itself `lg:hidden`.
4. **The release story is fiction.** Artifacts say `0.2.0`; README, SPEC, the audit doc, and the footer say `v0.3.0`; `git tag` returns nothing.
5. **Two bugs can produce false `verified` findings**: partial audits resolve findings from checks that did not run, and unresolved dynamic router prefixes are treated as resolved.

`docs/audit-2026-10.md` is a useful starting point but is stale: 7 of its 15 “open” items are already fixed in the working tree, while several more serious issues are not listed at all.

---

## 2. Current gate status

| Gate | Result |
|---|---|
| Backend tests | **1 failed, 85 passed** (86 total) |
| Frontend `npm run typecheck` | clean |
| Frontend `npm run build` | clean |
| CI (`.github/workflows/ci.yml`) | would fail on the backend job |
| Sample audit | 10 findings: 6 verified, 4 needs_review; all six checks ran |
| Git tags | **none** |

Failing test output:

```text
AssertionError: assert 'path=/api/v1/health' in
'... path=/health status=200 ... path=/provider status=200 ...
 path=/repositories/{repository_id} status=404 ...'
```

The middleware logs the router-relative `route.path`, while the test expects a full path for static routes but omits the prefix for the dynamic route. The test expectation is internally inconsistent.

---

## 3. Already fixed in the working tree (uncommitted)

These should be committed once the gate is green, not re-done:

| Audit item | State in working tree |
|---|---|
| `#7` CHK-02 “create this file” false positives | Heuristic added in `docs_references.py`; see regression note P1-9 |
| `#8` Landing “Retry” opens the sample | `lastIntent` now replays the last upload/sample intent |
| `#10` First audit erases scan limitations | Split into `scan_limitations` and `check_limitations`; overview combines both |
| `#11` No request logging | Logging added, but the path-template bug keeps the test red |
| `#15` Duplicate `STDLIB_ROOTS` | Single source in `analyzers/common.py` |
| `#18` Severity deviations | Broken anchor raised to `medium`; README API-doc checklist lowered to `info` |
| `#20` Dead `sha256`/`secret` manifest fields | Fields and hashing removed |

`#14` is *not* fixed; the working-tree change to `common.py` only adds `STDLIB_ROOTS`.

---

## 4. P0 — truthfulness, CI, and navigation

### P0-1. Backend test suite is red (CI blocker)

- **Where:** `backend/app/main.py:132-144`, `backend/tests/integration/test_v030_hardening.py:167-170`
- **Evidence:** `_log_request` uses `request.scope["route"].path`, which is `/health` and `/repositories/{repository_id}`. The test expects `/api/v1/health` but only `/repositories/{repository_id}` for the dynamic route.
- **Why it matters:** CI cannot pass; the logging contract is undefined.
- **Fix:** choose one convention. Recommended: log the full template by substituting concrete `path_params` into `request.url.path` (or by reconstructing the include prefix), e.g. `/api/v1/repositories/{repository_id}`. Update the test to expect full templates consistently for all three requests. Add a unit test for a nested/dynamic route.

### P0-2. Version and tag story is fabricated

- **Where:** `backend/pyproject.toml:3`, `frontend/package.json:4`, `backend/app/main.py:52`, `backend/app/api/health.py:15` all say `0.2.0`; `README.md:10`, `README.md:465`, `SPEC.md:9`, `SPEC.md:13`, `docs/audit-2026-10.md:3` say `v0.3.0`; `git tag` is empty.
- **Why it matters:** this is the same class of honesty failure the product claims to detect.
- **Fix:** pick one source of truth (e.g. `importlib.metadata.version("reposcribe")`), make FastAPI metadata, `/health`, README, SPEC, footer, and the audit doc read it or mirror one value. Do not claim a tag until one exists. If `v0.3.0` is intended, tag only after P0-1 and P0-3 are fixed.

### P0-3. Landing page fabricates product claims

- **Where:** `frontend/src/features/repositories/LandingPage.tsx`
- **Evidence:**
  - line 291: “powered by Alan AI and open models” — README says Alan is **not live** and no open model is selected.
  - lines 60-85: hard-coded `RECENT` analyses (`2 hours ago`, `12 findings`, etc.).
  - lines 409-419: “3 analyses · 25 findings addressed” derived from the mock array.
  - lines 434-453: a testimonial attributed only to “Developer”.
  - line 465: footer says `v0.3.0`.
- **Spec:** SCR-01 forbids fake logos, fake metrics, and fake testimonials; OP-03 forbids implying a connection that does not exist.
- **Fix:** remove the Alan/open-model sentence, the mock “Recent analyses” section, and the testimonial. Replace them with the real product preview the spec asks for (finding + diff), or label the block explicitly as sample/demo data. Fix the footer version with P0-2.

### P0-4. Mobile navigation is unreachable and sidebar links are dead

- **Where:**
  - `frontend/src/components/layout/TopBar.tsx:23` wraps `left` in `hidden ... lg:flex`.
  - `frontend/src/components/layout/AppShell.tsx:78-87` puts the hamburger in `left` and marks it `lg:hidden`.
  - `frontend/src/components/layout/Sidebar.tsx:65-72` links to `/analyze`, `/repositories`, `/findings`, `/patches`, `/settings`, none of which exist in `frontend/src/app/App.tsx`.
  - `Sidebar.tsx:154` declares `onNavigate` but never uses it, so the mobile drawer would not close on navigation anyway.
- **Why it matters:** at widths below `lg`, the only nav trigger is inside a hidden container; the visible buttons lead to the catch-all “Page not found”. This violates UI-10 and UI-12.
- **Fix:** render the hamburger outside the `hidden lg:flex` wrapper; make the sidebar links repository-scoped (`/r/:id`, `/r/:id/findings`, `/r/:id/ask`, `/r/:id/settings`) or remove the ones that do not exist; call `onNavigate` on `NavLink` click; verify at 360 px.

### P0-5. Inert controls across the shell and landing page

- **Where:**
  - `TopBar.tsx:24` renders `<GlobalSearch />` with no `value`/`onChange`; typing does nothing.
  - `Sidebar.tsx:120-147` `UserFooter` has an optional `onSignOut`, but `AppShell.tsx:56` never passes it; clicking does nothing.
  - `LandingPage.tsx:139-147` `RecentRow` chevron button has no `onClick`.
  - `LandingPage.tsx:420-425` “View all” is `href="#"`.
  - `LandingPage.tsx:10,361-371` three sample pills all call the same `openSample()` and none of the names (`fastapi-template`, `nextjs-app`, `python-toolkit`) exist in the backend (only `fastapi-users`).
- **Spec:** UI-10 requires every interactive control to perform a real action.
- **Fix:** implement the search or remove it; remove sign-out (there is no auth) or implement it; make rows/chevrons navigate or remove them; replace “View all” with a real link or remove it; collapse the three sample pills to the one real sample, or add real sample ids to the backend.

### P0-6. README, SPEC, and audit inventory overstate completion

- **Where:** `README.md:10` (`v0.3.0`), `README.md:49` (“63 backend tests”), `README.md:150` (“63 passed”), `SPEC.md:1374` (“63 passed”), `SPEC.md:1377` (“no inert controls”), `docs/audit-2026-10.md:3` (“latest tag v0.3.0”), `docs/audit-2026-10.md:94-96` (“15 open”).
- **Evidence:** 86 tests exist; no tag exists; the mobile nav and landing controls are inert; 7 of the 15 “open” items are already fixed in this tree.
- **Fix:** update the counts and statements, and reconcile the audit inventory after P0/P1. Do not claim “no inert controls” until P0-5 is done.

---

## 5. P1 — correctness, concurrency, and security

### P1-1. Partial audits mark findings from unrun checks as `resolved`

- **Where:** `backend/app/services/audit_service.py:59-65`
- **Evidence:** after a full audit, running only `markdown.internal_link_exists` produced four `resolved` findings from `fastapi.route_matches_docs` and `docs.readme_checklist`. The loop resolves every previous finding not present in `findings`, regardless of whether its `check_id` ran.
- **Spec:** ANL-01 (selected checks), status semantics (a finding is resolved because the defect is gone, not because the check was not run).
- **Fix:** only resolve a previous finding when `previous_finding.check_id in checks_run`. For unselected checks, carry the previous finding and status forward unchanged. Add a regression test: full audit → one-check audit → other findings keep their status.

### P1-2. Unresolved dynamic router prefixes produce `verified` missing-route findings

- **Where:** `backend/app/analyzers/common.py:383-411, 442-472`, `backend/app/analyzers/fastapi_routes.py:88-114`
- **Evidence:** a probe with `PREFIX = "/api/v2"` and `APIRouter(prefix=PREFIX)` produced route `GET /users` with `prefix_resolved=True` instead of `/api/v2/users`; `route_prefix_unresolved` stayed `False`. A documented `GET /api/v2/users` would therefore become a **verified** “route not found” finding. `Route(... prefix_resolved=True ...)` is hardcoded.
- **Spec:** line 461: an unresolved router prefix MUST yield `insufficient_evidence`, never “route missing”. `RouteInfo.prefix_resolved` must be meaningful.
- **Fix:** treat a non-constant `prefix=` (Name/Attribute/call) as unresolved; handle annotated assignments and `include_router` variables; mark `prefix_resolved=False` per route; set the analyzer result to `insufficient_evidence` whenever any relevant prefix is unresolved. Also handle `@module.router.get` (Attribute base), which is currently skipped entirely. Add tests for each shape.

### P1-3. No audit concurrency guard and no workspace cap

- **Where:** `backend/app/api/audits.py:16-24`, `backend/app/services/audit_service.py`, `backend/app/services/store.py`
- **Evidence:** two concurrent `POST /audits` both mutate `state.findings` and `state.audits`; `audit_in_progress` is never raised; `Settings` has no concurrent-workspace cap; `Store` has no semaphore.
- **Spec:** NFR-06 and T-22: one running audit per repository (409 `audit_in_progress`), 8 concurrent workspaces per instance.
- **Fix:** per-repository lock/flag set before the run and cleared in `finally`; return 409 `audit_in_progress` when busy. Add an instance-level semaphore/counter for workspaces and a clear error when exhausted. Add integration tests, including the T-22 shape.

### P1-4. Secret files are counted and manifested, contradicting the README

- **Where:** `backend/app/core/security.py:194-202` (`iter_files` does not skip secrets), `backend/app/analyzers/common.py:551-554` (`scanned` increments before `is_secret_path`), `backend/app/services/repository_service.py:124-136` (`_manifest` includes every `iter_files` entry).
- **Evidence:** a probe repo with `.env` and `id_rsa` yielded `scanned_files: 4` and `manifest: ['.env', 'app.py', 'id_rsa', 'README.md']`. `Repository.files_indexed` is `len(manifest)`, so the UI reports secrets as indexed files.
- **Spec/README:** `README.md:133` (“`.env` is … never indexed”), `README.md:178` (“`.env`, key files, and credential files are excluded from indexing”).
- **Why it matters:** no content is read today, but the counts are wrong and the privacy claim is false. Any future manifest endpoint would expose secret paths.
- **Fix:** either filter secrets out of `iter_files` for indexing/manifest purposes, or keep them in the manifest with `excluded: true` and a reason, and exclude them from `scanned_files`/`files_indexed`. Add a test asserting `.env` and `id_rsa` are absent from the manifest/counts.

### P1-5. Markdown link resolution can escape the workspace; escaping links report “`None`”

- **Where:** `backend/app/analyzers/common.py:207-240, 255-269`; `backend/app/analyzers/markdown_links.py:28-44`
- **Evidence:**
  - `_resolve_relative("README.md", "/etc/passwd")` → `//etc/passwd`, and `root / resolved` is absolute on POSIX.
  - On Windows, `_resolve_relative("docs/readme.md", "..\\..\\secret.md")` → `docs/..\..\secret.md`, which resolves outside the workspace.
  - A `[outside](../../outside.md)` link produced `resolved_path=None` and the finding says **“No file exists at `None`.”**
- **Spec:** README says “path-checked on every read”; FIX-02 and the security section require containment.
- **Impact:** a malicious repo can probe host-file existence and, for `.md` targets, trigger a read/parse outside the workspace. The tool is local, but the workspace is explicitly untrusted.
- **Fix:** reject absolute, drive-letter, UNC, and backslash-separated targets; after `_resolve_relative`, enforce `is_within(root, root / resolved)` before `exists()`/`read_text()`. When `resolved is None`, phrase the finding as “does not resolve inside the repository”, not `None`. Add security tests.

### P1-6. Workspace TTL is creation-based; no orphan sweep

- **Where:** `backend/app/services/store.py:86-92`
- **Evidence:** expiration uses `state.created_at`, not last access. There is no startup/periodic sweep and no 24-hour orphan cleanup.
- **Spec:** NFR-13: TTL 2 h, delete on request, sweep orphans after 24 h.
- **Impact:** an active session loses its workspace mid-flow; a crashed process can leave directories forever.
- **Fix:** add `last_accessed_at`, update it in `Store.get`, sweep on `now - last_accessed > ttl`, and add a startup sweep for orphaned workspace directories older than 24 h. Add a test with a frozen clock.

### P1-7. “Reopen finding” always sets status to `verified`

- **Where:** `frontend/src/features/audits/FindingDetailPage.tsx:171-178`
- **Evidence:** a dismissed finding is reopened with `setStatus("verified")`, regardless of whether it was `needs_review` or `insufficient_evidence` before dismissal.
- **Impact:** reopening overstates confidence; it can turn a suggestion into a verified defect.
- **Fix:** persist the pre-dismissal status (or reopen as `needs_review` by default) and expose that choice in the API/UI. Add a test for dismiss → reopen → status.

### P1-8. Upload body is read before the size check; no global body limit

- **Where:** `backend/app/api/repositories.py:32-39`, `backend/app/main.py` middleware
- **Evidence:** `await file.read()` reads the entire upload into memory, then compares `len(data)` to the limit. There is no middleware-level `Content-Length`/streaming guard.
- **Spec:** NFR-01 (20 MB default) and B11.
- **Impact:** a large request can consume memory before being rejected.
- **Fix:** check `Content-Length` in middleware and stream/cap the upload; return 413 before reading. Add a test that a declared-oversize request is rejected without a full body.

### P1-9. CHK-02 heuristic over-suppresses on the word “repo”

- **Where:** `backend/app/analyzers/docs_references.py:29-44`
- **Evidence:** `EXISTING_HINTS` includes `repo|repository`. A line like “This repository requires `scripts/seed.py`” is treated as an existing-file context and the missing-file finding is suppressed.
- **Impact:** the fix for #7 trades false positives for false negatives.
- **Fix:** drop `repo|repository` or require a stronger phrase (`this repository already contains`, `in this repo` near the path). Add a positive test for the `scripts/seed.py` sentence with “repository” in it.

### P1-10. Single-word environment variables are ignored

- **Where:** `backend/app/analyzers/config_references.py:12, 36-41`
- **Evidence:** `ENV_KEY_RE = ^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+$` requires at least one underscore. `PORT`, `DEBUG`, `HOST`, `TOKEN` are silently skipped even though `ENV_ASSIGN_RE` would match them.
- **Spec:** CHK-04 is expected to catch documented-but-undefined config.
- **Fix:** accept single-word uppercase names of length ≥ 2 (with the existing stoplist), and add tests for `PORT`/`DEBUG`. Keep the 25-finding cap.

### P1-11. SPA deep links return a JSON 404

- **Where:** `backend/app/main.py:125-127`
- **Evidence:** with `frontend/dist` built, `GET /r/repo_abc/findings` with `Accept: text/html` returns `404 application/json` (“Not Found”); `/` returns the shell.
- **Spec:** `README.md:128-129` says the backend serves the built UI at `/`.
- **Impact:** refreshing or sharing any in-app URL breaks single-service mode.
- **Fix:** for non-API, non-asset paths that accept HTML, return `index.html`; keep JSON 404 for `/api/*` and non-HTML clients. Add tests for both.

### P1-12. Provider-unavailable state is labeled “local demo mode”

- **Where:** `frontend/src/features/repositories/LandingPage.tsx:331-341`; `frontend/src/features/audits/FindingDetailPage.tsx:167-170`
- **Evidence:** the ternary treats every non-`live` mode as `local demo mode`; `AlanProvider.status()` returns `mode: "unavailable"`. The detail page likewise says demo mode even when AI-assisted features are disabled.
- **Spec:** AI-05/AI-06/OP-03: surface the real provider state, do not imply a working demo when the selected provider is unavailable.
- **Fix:** handle `local_demo`, `live`, and `unavailable` separately in both places.

---

## 6. P2 — quality, contracts, and docs

| ID | Finding | Suggested fix |
|---|---|---|
| P2-1 | Benchmark has no measured numbers (`docs/evaluation.md:38-48` all “not measured”) | Build the seeded fixture/generator, run the six checks, publish recall, false-positive rate, evidence validity, patch pass rate, duration |
| P2-2 | No coverage measurement, despite NFR-11 ≥ 80% | Add `pytest-cov` to CI with a threshold for analyzers/security/patch_service |
| P2-3 | No `ETag`/`If-Match` on `PATCH /findings/{id}` (B7) | Add the header/412 flow; test concurrent PATCH |
| P2-4 | Frontend `CHECK_LABELS` duplicates the backend catalog (B8) | Serve `/api/v1/checks` and consume it |
| P2-5 | `findings_total` includes `resolved` forever (B9) | Add an `active` count or filter; label the metric precisely |
| P2-6 | Sample id `fastapi-users` is hardcoded (B10) | Discover samples from a directory/registry |
| P2-7 | Manifest has no `excluded`/`reason` shape (ING-06, #13) | Either add the fields and an endpoint, or remove the unused `ManifestEntry` complexity |
| P2-8 | `.env.example` omits `REPOSCRIBE_LOG_LEVEL` (added in the working tree) | Add the variable and document it |
| P2-9 | “Files inspected” (`len(manifest)`) and audit `files_inspected` (`index.scanned_files`) disagree, and secrets inflate both | Define one count and use it everywhere; exclude secrets (P1-4) |
| P2-10 | Overview card is titled “Scan limitations” but now shows combined `[scan]` + `[check]` entries | Rename to “Limitations” or split the lists |
| P2-11 | No accessibility/responsive verification (NFR-09, NFR-10) | Keyboard pass, 360 px smoke test, Lighthouse a11y report |

---

## 7. P3 — roadmap (only after the baseline is truthful)

These are already scoped in `SPEC.md` §35 and `docs/audit-2026-10.md`; do not start them before P0/P1:

- **Tier B:** diff-aware scanning, `reposcribe check --base`, GitHub Action, regression deltas.
- **Tier C:** `RouteSource` abstraction, OpenAPI-first multi-language route checks, community adapters.
- **Tier D:** user-supplied analyzers from `.reposcribe/check.d/`, `reposcribe.policy.toml`.
- **Alan gate:** verify the product/SDK/auth contract, choose and record an open model + license, implement the live provider, never fake a connection.

---

## 8. Recommended next step

**Do one “truth and navigation” PR before adding features:**

1. Fix P0-1 (logging + test) so `pytest` is green.
2. Fix P0-2 (single version source; align README/SPEC/footer/audit; tag only after green).
3. Fix P0-3/P0-4/P0-5 (remove fabricated landing content and inert controls; make mobile nav and sidebar links real).
4. Fix P0-6 (test count, shipped-status claims, audit inventory).
5. Add a short “definition of done” check to CI or the PR template: tests, typecheck, build, no `href="#"`, no no-op buttons, version consistency.

**Acceptance for that PR:**

```powershell
cd backend; .\.venv\Scripts\python.exe -m pytest -q     # 86 passed
cd frontend; npm run typecheck; npm run build            # clean
```

Plus a manual 360 px check that the drawer opens, every link lands on a real screen, and no control is inert.

**Then** take P1 in this order: P1-1 (partial resolution), P1-2 (dynamic prefixes), P1-3 (concurrency), P1-4/P1-5 (secrets and path containment), P1-6 (workspace lifecycle), then the smaller UI/contract items. P1-1 and P1-2 are the highest-value because they directly undermine the product's “evidence-backed, never guess” promise.

---

## 9. Evidence commands

```powershell
# Backend
cd backend
.\.venv\Scripts\python.exe -m pytest -q          # 1 failed, 85 passed

# Frontend
cd frontend
npm run typecheck                                # clean
npm run build                                    # clean

# Release reality
git tag                                          # empty
Select-String -Path backend/pyproject.toml,frontend/package.json -Pattern version
```

Runtime probes confirmed:

- sample audit: 10 findings (6 verified, 4 needs_review), all six checks run;
- partial audit: 4 unrelated findings marked `resolved`;
- dynamic prefix: `APIRouter(prefix=PREFIX)` → `/users`, `prefix_resolved=True`;
- secret manifest: `.env` and `id_rsa` present, `scanned_files=4`;
- SPA: `/r/repo_abc/findings` → JSON 404 even with `Accept: text/html`;
- link resolution: `../../outside.md` → `resolved_path=None`, finding text “No file exists at `None`.”

Probe scripts were run from the OS temp directory and deleted; the repository working tree still contains only the 15 pre-existing modified files.
