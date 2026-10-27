# RepoScribe — re-verification

**Date:** 2026-10-27
**Supersedes:** the 2026-10-26 snapshot previously stored in this file. That snapshot is retained only in git
history because its conclusions (red CI, 86 tests, fabricated landing page, unreachable mobile navigation) no
longer describe the working tree.

**Scope:** `SPEC.md`, `README.md`, `docs/`, CI, and the backend and frontend source.
**Method:** full test runs plus a static read of the working tree.

---

## 1. Verdict

The deterministic core is real and the gates are green. The earlier P0 and P1 findings are closed in the working
tree, and two remaining user-visible defects were fixed in this pass (`T1`, `T2`).

The working tree is committed, pushed, and CI passed on `5d5bab2`. `v0.3.0` is the first tag; it is an MVP
snapshot, not a production release.

## 2. Gate status

| Gate | Result |
|---|---|
| Backend `pytest -q` | **136 passed** (one warning, ~72 s) |
| Frontend `npm run typecheck` | clean |
| Frontend `npm run build` | clean |
| Playwright `npm run test:e2e` | **12 passed / 50 checks** |
| Version literals | `0.3.0` consistent in `pyproject.toml`, `package.json`, `main.py`, `health.py`, `README.md`, `SPEC.md` |
| Git tags | **`v0.3.0`** (on the commit that passed CI) |

## 3. Closed since the 2026-10-26 snapshot

| Area | State | Evidence |
|---|---|---|
| P0-1 request logging | Closed | Full route templates are logged; the integration test passes |
| P0-2 version story | Closed | One value (`0.3.0`) across artifacts and docs; `v0.3.0` tagged after CI passed |
| P0-3 landing fabrications | Closed | No Alan/open-model claim, mock analyses, metrics, or testimonial |
| P0-4 mobile navigation | Closed | Hamburger reachable below `lg`; drawer closes on navigation; all sidebar routes exist |
| P0-5 inert controls | Closed | Search filters findings; no `href="#"` or no-op buttons remain |
| P0-6 overstated docs | Closed | Test counts and shipped status corrected to the measured gates |
| P1-1 partial audits | Closed | Only findings from checks that actually ran can become `resolved` |
| P1-2 dynamic prefixes | Closed | Non-literal prefixes are unresolved; findings become `insufficient_evidence` |
| P1-3 concurrent audits | Closed | Per-repository lock returns `409 audit_in_progress` |
| P1-4 secret files | Closed | `.env` and key files are excluded from the manifest and counts |
| P1-5 path containment | Closed | Escaping links are rejected before any filesystem read |
| P1-6 workspace lifecycle | Closed | Last-access TTL, janitor sweep, and startup orphan sweep |
| P1-7 reopen status | Closed in this pass | `T2` |
| P1-8 upload body limit | Closed | Upload is read in capped chunks; global `Content-Length` gate rejects 413 |
| P1-9 CHK-02 over-suppression | Closed | `repo|repository` removed from the existing-file hints |
| P1-10 single-word env vars | Closed in this pass | `T1` |
| P1-11 SPA deep links | Closed | Non-API HTML requests fall back to `index.html` |
| P1-12 provider labelling | Closed | Landing page and finding detail distinguish `live`, `local_demo`, and `unavailable` (`T3`) |
| D1–D5 abuse controls | Closed | Body gate, finding caps, audit timeout, incomplete-check handling, signed session cookie |

## 4. Fixed in this pass

| ID | Defect | Fix | Evidence |
|---|---|---|---|
| `T1` | CHK-04 skipped single-word variables (`PORT`, `DEBUG`), so a documented-but-undefined value was never reported | Multi-word names behave as before; a single-word name is compared only when its line or nearest section heading is about configuration, with an expanded stoplist | `backend/app/analyzers/config_references.py`, `backend/tests/unit/test_config_references.py` |
| `T2` | Reopening a dismissed finding always set `needs_review`, downgrading a `verified` defect | Findings record `status_before_dismissal`; the UI restores it, falling back to `needs_review` only when the previous status cannot be restored | `backend/app/schemas/models.py`, `backend/app/services/audit_service.py`, `frontend/src/features/audits/FindingDetailPage.tsx`, `backend/tests/test_api_contract.py` |

CHK-04 deliberately does not report `GET`, `POST`, or `JSON` that appear in an API table, because those tokens
fail the configuration-context test. A regression test covers both directions.

### Fixed in the Phase 1 sweep

| ID | Defect | Fix | Evidence |
|---|---|---|---|
| `T3` | An `unavailable` provider was labelled "Demo mode" | Three-way branch: `live`, `local_demo`, `unavailable` (with the provider message) | `frontend/src/features/audits/FindingDetailPage.tsx`, `frontend/e2e/smoke.spec.ts` |
| `T4` (`B9`) | `findings_total` counted resolved and dismissed forever | Added `findings_active_total` to the repository, overview, and audit summary; the overview headline uses it and names the all-time total | `backend/app/schemas/models.py`, `backend/app/services/audit_service.py`, `backend/app/services/repository_service.py`, `frontend/src/features/repositories/OverviewPage.tsx` |
| `T5` (`B7`) | Concurrent status changes overwrote each other silently | Findings carry a `revision`; `GET` returns an `ETag`, `PATCH` honours `If-Match`, and a stale value returns 412 `precondition_failed` | `backend/app/api/findings.py`, `backend/app/services/audit_service.py`, `frontend/src/lib/api.ts` |
| `T6` | `Route.prefix_resolved` was hardcoded `True` and carried no information | Removed the per-route field; the aggregate `routes_prefix_unresolved` is the only completeness signal | `backend/app/schemas/models.py`, `backend/app/analyzers/common.py`, `backend/app/services/repository_service.py` |
| `T10` | The specified 8-workspace cap was absent | `MAX_CONCURRENT_WORKSPACES` (default 8) with a reservation counter that also covers in-flight creation; 503 when exhausted | `backend/app/core/settings.py`, `backend/app/services/store.py`, `backend/tests/integration/test_abuse_controls.py` |
| `T11` | The drawer left the background reachable to assistive technology; four routes were untested at 360 px | The shell is `inert` and `aria-hidden` while the drawer is open, and the 360 px guard covers finding detail, patch, and settings | `frontend/src/components/layout/AppShell.tsx`, `frontend/e2e/smoke.spec.ts` |
| `T12` | The global search box ignored the active `?q=` | TopBar mirrors the URL query into the controlled search input | `frontend/src/components/layout/TopBar.tsx`, `frontend/e2e/smoke.spec.ts` |

## 5. Still open

| ID | Severity | Item | Where | Fix |
|---|---|---|---|---|
| `T7` (`#13`) | Low | The manifest drops excluded files without a reason | `backend/app/schemas/models.py:48` | Surface non-secret exclusions with a reason; keep secret paths out of the manifest |
| `T8` (`B10`) | Low | The sample id is hardcoded and only one sample exists | `backend/app/services/repository_service.py:43` | Discover samples from a metadata file; expose `GET /samples` |
| `T9` (`B8`) | Low | Check labels are duplicated and divergent | `frontend/src/lib/format.ts:22`, `backend/app/services/audit_service.py:15` | Add `GET /api/v1/checks` and consume it |

`T7` is deliberately not a mechanical fix: the earlier privacy work removed secret paths from the manifest, so
listing every excluded file would undo it. The fix must expose non-secret exclusions only.

No High or Medium item is open.

## 6. Claims that still lack evidence

- **No benchmark has been run.** `docs/evaluation.md` still reports every metric as "not measured".
- **No coverage measurement.** CI runs `pytest` without `pytest-cov`, despite the NFR-11 target.
- **No live model provider.** `GET /api/v1/provider` correctly reports `local_demo` and `verified_contract: false`.

These are product claims, not code defects. Do not publish precision, recall, or timing figures until the
benchmark is run, and do not describe the Alan integration as connected.
