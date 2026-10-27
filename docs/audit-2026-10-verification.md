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

The product is not yet a release: the working tree is not committed and no git tag exists. Do not tag before the
committed tree passes CI.

## 2. Gate status

| Gate | Result |
|---|---|
| Backend `pytest -q` | **133 passed** (one warning, ~18 s) |
| Frontend `npm run typecheck` | clean |
| Frontend `npm run build` | clean |
| Playwright `npm run test:e2e` | **10 passed / 39 checks** (~26 s) |
| Version literals | `0.3.0` consistent in `pyproject.toml`, `package.json`, `main.py`, `health.py`, `README.md`, `SPEC.md` |
| Git tags | **none** |

## 3. Closed since the 2026-10-26 snapshot

| Area | State | Evidence |
|---|---|---|
| P0-1 request logging | Closed | Full route templates are logged; the integration test passes |
| P0-2 version story | Closed | One value (`0.3.0`) across artifacts and docs; no tag is claimed |
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
| P1-12 provider labelling | Partially closed | Landing page is correct; `T3` still open in the finding detail |
| D1–D5 abuse controls | Closed | Body gate, finding caps, audit timeout, incomplete-check handling, signed session cookie |

## 4. Fixed in this pass

| ID | Defect | Fix | Evidence |
|---|---|---|---|
| `T1` | CHK-04 skipped single-word variables (`PORT`, `DEBUG`), so a documented-but-undefined value was never reported | Multi-word names behave as before; a single-word name is compared only when its line or nearest section heading is about configuration, with an expanded stoplist | `backend/app/analyzers/config_references.py`, `backend/tests/unit/test_config_references.py` |
| `T2` | Reopening a dismissed finding always set `needs_review`, downgrading a `verified` defect | Findings record `status_before_dismissal`; the UI restores it, falling back to `needs_review` only when the previous status cannot be restored | `backend/app/schemas/models.py`, `backend/app/services/audit_service.py`, `frontend/src/features/audits/FindingDetailPage.tsx`, `backend/tests/test_api_contract.py` |

CHK-04 deliberately does not report `GET`, `POST`, or `JSON` that appear in an API table, because those tokens
fail the configuration-context test. A regression test covers both directions.

## 5. Still open

| ID | Severity | Item | Where | Fix |
|---|---|---|---|---|
| `T3` | Low | An `unavailable` provider is rendered as "Demo mode" | `frontend/src/features/audits/FindingDetailPage.tsx:214` | Three-way branch: `live` / `local_demo` / `unavailable` |
| `T4` (`B9`) | Low | `findings_total` includes resolved and dismissed forever | `backend/app/services/audit_service.py:112`, `backend/app/services/audit_service.py:165` | Add `findings_active_total`; use it for the headline metric |
| `T5` (`B7`) | Low | No `ETag`/`If-Match` on `PATCH /findings/{id}` | `backend/app/api/findings.py:69` | Emit `ETag: <finding.id>`; return 412 on mismatch |
| `T6` | Low | `Route.prefix_resolved` is hardcoded `True` | `backend/app/schemas/models.py:74`, `backend/app/analyzers/common.py:622` | Set `prefix_resolved=resolved` when emitting, or delete the field |
| `T7` (`#13`) | Low | The manifest drops excluded files without a reason | `backend/app/schemas/models.py:48` | Add `excluded`/`reason`; keep secrets out of counts |
| `T8` (`B10`) | Low | The sample id is hardcoded and only one sample exists | `backend/app/services/repository_service.py:43` | Discover samples from `settings.sample_root`; expose `GET /samples` |
| `T9` (`B8`) | Low | Check labels are duplicated and divergent | `frontend/src/lib/format.ts:22`, `backend/app/services/audit_service.py:15` | Add `GET /api/v1/checks`; delete both maps |
| `T10` | Low | The specified 8-workspace concurrency cap is absent | `backend/app/core/settings.py`, `backend/app/services/store.py` | Add `max_concurrent_workspaces` + semaphore; 503 when exhausted |
| `T11` | Low | The drawer background is not `inert`; 360 px is untested on four routes | `frontend/src/components/layout/AppShell.tsx:126`, `frontend/e2e/smoke.spec.ts:276` | Add `inert`/`aria-hidden`; extend the 360 px test |
| `T12` | Low | TopBar search does not reflect an active `?q=` | `frontend/src/components/layout/TopBar.tsx:66` | Pass `value` from search params |

No High or Medium item is open.

## 6. Claims that still lack evidence

- **No benchmark has been run.** `docs/evaluation.md` still reports every metric as "not measured".
- **No coverage measurement.** CI runs `pytest` without `pytest-cov`, despite the NFR-11 target.
- **No live model provider.** `GET /api/v1/provider` correctly reports `local_demo` and `verified_contract: false`.

These are product claims, not code defects. Do not publish precision, recall, or timing figures until the
benchmark is run, and do not describe the Alan integration as connected.
