# RepoScribe — Product & Technical Specification

| Field | Value |
|---|---|
| Project | RepoScribe |
| Tagline | Documentation that doesn't lie. |
| Document | Product requirements + technical architecture + delivery plan |
| Version | 2.4 |
| Status | Implemented. Source version **0.3.0**, tagged `v0.3.0` on 2026-10-27 after CI passed; an MVP snapshot, not a production release. v1.0 is reserved for the milestone defined in §Roadmap. |
| Owner | risshu.verma7@gmail.com |
| Last updated | 2026-10-26 |
| Supersedes | `docs/archive/RepoScribe_Complete_Technical_Spec_v1.md` |
| Target release | No release tag yet; next milestone is v1.0 (see the audit doc) |

---

## About this document

**Purpose.** Single source of truth for what RepoScribe is, what must be built, how it must behave, and how completion is judged.

**Audiences.**

| Reader | Read first |
|---|---|
| Implementing agent | §0, Part II, §26–31 |
| Reviewer / judge | §1–5, §12, §28–29, §32 |
| Future contributor | §1–5, §16, §17, §26, §27 |

**Normative keywords.**

| Keyword | Meaning |
|---|---|
| MUST | Required for v1.0. Absence blocks release. |
| SHOULD | Expected. Omit only with a recorded decision in §34. |
| MAY | Optional. |
| MUST NOT | Prohibited. |

**Identifiers.** Every requirement, check, screen, test, and acceptance criterion has a stable ID (`ING-03`, `CHK-02`, `SCR-04`, `T-12`, `AC-F-05`). Use these IDs in commits, PRs, issues, and test names.

**Change control.** Change the document and the code in the same change set. Record scope-relevant changes in Appendix B. Do not silently narrow a MUST.

**Source of truth.** If code and this document disagree, the document wins until it is amended.

---

## Contents

**Part I — Product Definition**
[0. Operating rules](#0-operating-rules) · [1. Vision](#1-vision) · [2. Problem and users](#2-problem-and-users) · [3. Scope](#3-scope) · [4. Principles](#4-principles) · [5. Success and metrics](#5-success-and-metrics)

**Part II — Requirements**
[6. Functional requirements](#6-functional-requirements) · [7. Non-functional requirements](#7-non-functional-requirements) · [8. Check catalog](#8-check-catalog) · [9. Data model](#9-data-model) · [10. Definition of done](#10-definition-of-done)

**Part III — Experience**
[11. User journey](#11-user-journey) · [12. Screens](#12-screens) · [13. Design system](#13-design-system) · [14. States and copy](#14-states-and-copy) · [15. Accessibility](#15-accessibility)

**Part IV — System**
[16. Architecture](#16-architecture) · [17. Stack](#17-stack) · [18. Intake and workspace safety](#18-intake-and-workspace-safety) · [19. Analyzer contracts](#19-analyzer-contracts) · [20. API specification](#20-api-specification) · [21. AI integration](#21-ai-integration) · [22. Patch pipeline](#22-patch-pipeline) · [23. Security and privacy](#23-security-and-privacy) · [24. Reliability and observability](#24-reliability-and-observability) · [25. Configuration](#25-configuration)

**Part V — Delivery**
[26. Repository structure](#26-repository-structure) · [27. Test strategy](#27-test-strategy) · [28. Acceptance criteria](#28-acceptance-criteria) · [29. Traceability](#29-traceability) · [30. Build plan](#30-build-plan) · [31. Failure modes](#31-failure-modes) · [32. Demo](#32-demo) · [33. README contract](#33-readme-contract) · [34. Risks and decisions](#34-risks-and-decisions) · [35. Roadmap](#35-roadmap)

**Appendices**
[A. Glossary](#appendix-a-glossary) · [B. Changelog](#appendix-b-changelog)

---

# Part I — Product Definition

## 0. Operating rules

Rules for the implementing agent. These are binding constraints on *how* the product is built, not features.

| ID | Rule |
|---|---|
| OP-01 | **Inspect before implementing.** Read existing files, package config, scripts, and current state before changing anything. Preserve useful work. |
| OP-02 | **Vertical slice first.** Ingest a small repository, detect a real defect, show evidence, generate a patch, validate it, render a diff. Nothing else until that works. |
| OP-03 | **No fake integrations.** No button may imply a connection that does not exist. Unavailable credentials mean an explicitly labeled local/demo mode, documented as such. |
| OP-04 | **Verify Alan before coding against it.** Read the event's current instructions and Alan's current documentation. Identify the exact product, SDK, auth, and model-selection mechanism. Do not assume the legacy voice SDK, an agent platform, and a generic model API are interchangeable. |
| OP-05 | **Respect the open-model rule.** Confirm the event's definition of an eligible open model and its license. Keep the provider configurable. Never silently substitute a proprietary model. |
| OP-06 | **Never fabricate evidence.** Paths, line numbers, symbols, routes, and validation results come from inspection or real tool output. |
| OP-07 | **Keep the product honest.** A mechanically verified contradiction is not the same as a model suspicion. Never label a guess as proven. |
| OP-08 | **Protect the repository.** Read-only by default. Produce previews. Never overwrite, commit, push, or open a PR without explicit user approval. |
| OP-09 | **Design quality is scope.** The UI must read as a deliberate developer tool, not a generic chat template. |
| OP-10 | **Report only observed results.** Never claim a command or test passed unless it was run and its output observed. |
| OP-11 | **Build incrementally.** No microservices, multi-agent systems, vector databases, or heavy infrastructure before the core workflow works. |
| OP-12 | **Resolve ambiguity downward.** Choose the smallest safe implementation and record the assumption in §34 and the README. Ask a human only when a decision blocks implementation. |

**First task for the implementing agent.** Report, before writing feature code: current stack and structure; what already works; the gap to the first end-to-end workflow; the exact Alan integration required and what remains unverified; a short implementation plan. Then build the smallest slice and run its tests.

---

## 1. Vision

### 1.1 One-sentence product statement

> RepoScribe is an evidence-first documentation reliability agent that detects drift between a software repository and its technical docs, traces every finding to a real source location, and proposes validated, reviewable Markdown repairs.

### 1.2 Pitch

Software changes faster than its documentation. RepoScribe scans a repository, finds concrete documentation mismatches, explains why they matter with source evidence, and prepares a patch the developer can verify before accepting.

### 1.3 Core promise

Every finding answers these six questions. If it cannot answer one, that is shown as a limitation, not hidden.

| # | Question | Source |
|---|---|---|
| 1 | What does the documentation claim? | Extracted doc evidence |
| 2 | What does the repository actually contain? | Extracted code/config evidence |
| 3 | What evidence supports the comparison? | Path + line ranges |
| 4 | How certain is this, and what is out of scope? | Status + limitations |
| 5 | What minimal correction is proposed? | Patch draft |
| 6 | Which validation checks passed or failed? | Validation results |

### 1.4 Positioning

| RepoScribe is | RepoScribe is not |
|---|---|
| A documentation drift detector | A repository chatbot |
| An evidence-first auditor | An AI README generator |
| A minimal-patch proposer | An autonomous coding agent |
| A read-only analysis tool | A tool that rewrites application code |
| Honest about static-analysis limits | A universal correctness verifier |

The workflow that defines the product:

**Inspect repository → extract facts → extract documentation claims → detect discrepancies → produce evidence-backed findings → draft a minimal patch → validate → request human approval.**

---

## 2. Problem and users

### 2.1 Problem

Documentation goes stale when teams rename routes, change configuration, alter signatures, reorganize files, or change setup steps. These edits usually land in pull requests focused on behavior, where related docs are forgotten. Existing tools either generate new text from code or answer questions about a repository; neither detects and explains contradictions in *existing* docs with evidence.

### 2.2 Consequences

- New contributors follow broken setup instructions.
- API consumers call obsolete endpoints or send removed fields.
- Developers search for symbols and configuration that no longer exist.
- Support and onboarding costs rise because instructions contradict each other.
- AI coding assistants consume stale docs and amplify the error.
- Reviewers cannot tell whether a docs change is grounded in real code.

### 2.3 Users

**Primary**

| Persona | Need |
|---|---|
| Solo maintainer, small/medium OSS repo | Know which docs are wrong without a docs team |
| Backend developer maintaining API docs and setup guides | Catch drift before users hit it |
| Small team using AI coding assistants | Keep the context those assistants read accurate |
| Contributor onboarding to an unfamiliar Python/FastAPI project | Find the real source of truth fast |

**Secondary (post-MVP)**

| Persona | Need |
|---|---|
| Engineering team wanting docs checks in CI | Automated gate |
| Developer-platform team owning internal API docs | Coverage and consistency |
| OSS maintainer wanting lightweight docs automation | Low-config checks |

### 2.4 Jobs to be done

| ID | Job |
|---|---|
| JTBD-01 | Tell me which README instructions no longer match the code. |
| JTBD-02 | Show me where this API endpoint is actually defined. |
| JTBD-03 | Find environment variables in docs that are absent from configuration. |
| JTBD-04 | Generate an accurate setup guide from this repository. |
| JTBD-05 | Show a safe patch with the evidence behind each change. |
| JTBD-06 | Separate verified findings from those needing human judgement. |

### 2.5 Differentiation

High-confidence checks with clear evidence; fast onboarding to an unfamiliar repo; precise file and line citations; small reviewable diffs; a hard separation between verified findings and model suggestions; visible uncertainty; a reproducible open-source demo.

---

## 3. Scope

### 3.1 Release scope

| Tier | Contents |
|---|---|
| **v1.0 — MUST** | Bundled sample repo + ZIP upload; safe intake; six deterministic checks; evidence inspector; grounded Q&A; minimal Markdown patch; diff; deterministic validation; export; Alan + eligible open model; polished responsive UI; tests; docs |
| **v1.1 — SHOULD** | Git diff scoping; documentation coverage map; OpenAPI comparison; GitHub import; CI mode; more languages; incremental index; persistent history; policy rules |
| **v2 — MAY** | PR checks and comments; team policies; scheduled audits; semantic retrieval; provider evaluation suite; plugin analyzers |

### 3.2 MVP capability map

| ID | Capability | Requirements |
|---|---|---|
| CAP-01 | Load bundled sample repository or upload a supported ZIP | ING-01…08 |
| CAP-02 | Safely extract and inspect repository files | ING-05…08, SEC-01…04 |
| CAP-03 | Detect the six defined documentation drift cases | CHK-01…06 |
| CAP-04 | Index paths, lines, symbols, routes, config keys, doc references | IDX-01…05 |
| CAP-05 | Display findings with severity, status, explanation, evidence | EVD-01…04, UI-05…07 |
| CAP-06 | Answer repository questions grounded in retrieved evidence | ASK-01…05 |
| CAP-07 | Generate a minimal Markdown patch for a finding | FIX-01…04 |
| CAP-08 | Display a before/after diff | FIX-05, UI-08 |
| CAP-09 | Validate patch properties and re-run relevant checks | FIX-06…08 |
| CAP-10 | Export the patch or revised Markdown | FIX-09 |
| CAP-11 | Honest local/demo mode for development and tests | AI-06, OPS-04 |
| CAP-12 | Real Alan integration with an eligible open model | AI-01…05 |
| CAP-13 | Polished, responsive, accessible UI with complete states | UI-01…12 |
| CAP-14 | Tests and documentation that match observed behavior | Part V |

### 3.3 Non-goals for v1.0

A universal code correctness verifier; a security scanner claiming full coverage; a general-purpose autonomous coding agent; an agent that rewrites application code; automatic commit/push; full multi-language semantic analysis; a large multi-agent system; a mandatory vector database; enterprise RBAC, billing, or analytics; automatic PR creation as a demo dependency; a guarantee that every semantic documentation claim can be verified mechanically.

### 3.4 Truthfulness model

A route absent from a static scan is not proof of absence: routers can be mounted with prefixes, imported indirectly, or registered dynamically. A missing string match is not automatically a defect. Every check MUST state its supported scope and its limitations.

**Finding status**

| Status | Meaning |
|---|---|
| `verified` | Supported by deterministic evidence within the check's stated scope |
| `needs_review` | Plausible mismatch requiring semantic or human confirmation |
| `insufficient_evidence` | The tool cannot safely conclude |
| `resolved` | No longer reproduces after a patch or rescan |
| `dismissed` | A user explicitly dismissed it |

**Severity** (`high`, `medium`, `low`, `info`) expresses likely impact. It is independent of status and MUST NOT be used as a confidence signal. Never claim a check is universally correct when it supports only a subset of framework patterns.

### 3.5 Supported environments

| Area | v1.0 support |
|---|---|
| Language | Python 3.11+ |
| Framework | FastAPI (static decorator forms only) |
| Docs | Markdown, `.env.example`, OpenAPI YAML/JSON (read-only) |
| Unsupported | Dynamic route registration, non-Python source analysis, external link checking |

Unsupported input yields partial support and an explicit statement of which checks ran. It is never silently treated as "clean".

---

## 4. Principles

| ID | Principle | Consequence for the build |
|---|---|---|
| P-01 | Evidence before prose | Retrieve facts, then let the model explain them |
| P-02 | Deterministic checks before model judgement | Plain code for links, files, routes, config |
| P-03 | Small patches | Touch only the relevant doc lines |
| P-04 | Human approval by default | All writes are previews until approved |
| P-05 | Visible provenance | Every claim links to a file and line range |
| P-06 | Honest uncertainty | Status labels with defined meanings, no fake precision |
| P-07 | Useful without an LLM | Deterministic audits run with no provider configured |
| P-08 | Model-agnostic architecture | One narrow provider interface |
| P-09 | Privacy by design | Local processing where feasible; explicit disclosure before sending code |
| P-10 | Graceful degradation | Model failure never breaks deterministic results |

---

## 5. Success and metrics

### 5.1 Definition of success

A new user can open the app, load the bundled sample repository or upload a supported ZIP, run an audit, inspect a finding with source evidence, generate a Markdown repair, see the before/after diff, validate the patch, and export it — all without a GitHub token.

The Alan integration is real in the final configured setup, uses a permitted platform and open model, and is explained in the architecture docs and README. A local demo mode is acceptable during development but MUST NOT be presented as a live integration.

### 5.2 MVP quality metrics

Measured on a seeded benchmark repository with 10–20 known defects.

| ID | Metric | Target |
|---|---|---|
| MET-01 | Seeded defects detected | ≥ 80% |
| MET-02 | False positives on clean fixture docs | ≤ 10% of findings |
| MET-03 | Evidence validity (paths and lines exist) | 100% |
| MET-04 | Patches passing deterministic validation | ≥ 90% of generated patches |
| MET-05 | Invalid citations accepted into answers | 0 |
| MET-06 | Audit time on sample repository | ≤ 10 s p95 |

### 5.3 Product metrics (post-launch)

Detection precision and recall on the benchmark; evidence validity rate; patch validation pass rate; share of findings accepted by a human reviewer; time from audit start to first useful finding; median time to a validated patch; failed audit rate; share of questions answered with valid citations.

### 5.4 Reporting rules

Never present acceptance rate or accuracy as meaningful when derived from a tiny or cherry-picked sample. Always state benchmark size and limitations. Do not publish performance numbers before the benchmark has run.

---

# Part II — Requirements

## 6. Functional requirements

### 6.1 Repository intake (ING)

| ID | Requirement | Priority |
|---|---|---|
| ING-01 | Accept a bundled sample repository identifier. | MUST |
| ING-02 | Accept a user-uploaded ZIP containing a single project directory. | MUST |
| ING-03 | Accept a public GitHub URL import. | MAY (v1.1) |
| ING-04 | Require no GitHub token for the core flow. | MUST |
| ING-05 | Create an isolated workspace per repository; return a `repository_id`. | MUST |
| ING-06 | Build a manifest: relative path, size, detected language, is-doc, excluded flag + reason, content hash. | MUST |
| ING-07 | Report progress during extraction and indexing. | MUST |
| ING-08 | Delete a workspace and its session data on request. | MUST |

### 6.2 Indexing (IDX)

| ID | Requirement | Priority |
|---|---|---|
| IDX-01 | Index documentation files: `README.md`, `CONTRIBUTING.md`, `docs/**/*.md`, `*.md`, `openapi.{yaml,json}`, `.env.example`. | MUST |
| IDX-02 | Index source/config files: `*.py`, `pyproject.toml`, `requirements.txt`, `setup.cfg`, `Dockerfile`, `compose.yaml`/`docker-compose.yml`. | MUST |
| IDX-03 | Index Python symbols (module path, functions, classes, parameters, annotations, line ranges) via `ast`. | MUST |
| IDX-04 | Index statically discoverable FastAPI routes (method, path, handler, file, line range). | MUST |
| IDX-05 | Never execute repository code or installer scripts during analysis. | MUST |

Scanning is targeted. Do not walk every file type indiscriminately.

### 6.3 Audit (ANL)

| ID | Requirement | Priority |
|---|---|---|
| ANL-01 | Run an audit over selected checks, defaulting to all supported checks. | MUST |
| ANL-02 | Produce one normalized `Finding` per detected discrepancy with a stable ID. | MUST |
| ANL-03 | Return a summary: files inspected, findings by status, checks run, checks skipped and why. | MUST |
| ANL-04 | Continue and return partial results when a single analyzer fails, where safe. | MUST |
| ANL-05 | Re-run relevant checks on a proposed patch. | MUST |
| ANL-06 | Cancel or bound a running audit. | SHOULD |

### 6.4 Evidence (EVD)

| ID | Requirement | Priority |
|---|---|---|
| EVD-01 | Attach bounded excerpts with path, one-based line range, and role (`documentation`, `source`, `config`, `test`, `other`). | MUST |
| EVD-02 | Derive every excerpt from actual file content at audit time. | MUST |
| EVD-03 | Show documentation and source evidence side by side in the inspector. | MUST |
| EVD-04 | Redact detected secrets from excerpts; never include secret values in findings. | MUST |

### 6.5 Patch and export (FIX)

| ID | Requirement | Priority |
|---|---|---|
| FIX-01 | Generate a patch for a selected finding using the finding, current doc content, and trusted evidence. | MUST |
| FIX-02 | Target documentation files only; reject absolute paths, traversal, and source-code targets. | MUST |
| FIX-03 | Prefer a minimal edit over rewriting the document. | MUST |
| FIX-04 | Preserve line endings where practical. | SHOULD |
| FIX-05 | Render a line-based diff (unified or side-by-side). | MUST |
| FIX-06 | Validate: permitted target, clean application, re-run checks, links/anchors, referenced symbols exist. | MUST |
| FIX-07 | Report each validation step as `passed`, `failed`, `not_run`, or `inconclusive`. | MUST |
| FIX-08 | Never write to the original repository during generation, validation, or preview. | MUST |
| FIX-09 | Export the patch or the revised Markdown file. | MUST |
| FIX-10 | Apply in place after explicit confirmation. | MAY (omit if not safely implemented) |
| FIX-11 | Commit, push, or open a PR automatically. | MUST NOT |

### 6.6 Grounded Q&A (ASK)

| ID | Requirement | Priority |
|---|---|---|
| ASK-01 | Answer questions about the selected repository only, never as a general chatbot. | MUST |
| ASK-02 | Return structured output: answer, citations, limitations, follow-up suggestions. | MUST |
| ASK-03 | Reject any citation that does not map to a retrieved evidence item. | MUST |
| ASK-04 | Display sources inline and in an expandable evidence panel. | MUST |
| ASK-05 | Say so plainly when retrieved evidence does not support an answer. | MUST |
| ASK-06 | Include example prompts, scoped to supported checks. | SHOULD |

### 6.7 AI integration (AI)

| ID | Requirement | Priority |
|---|---|---|
| AI-01 | Integrate the Alan platform/product specified by the current event rules. | MUST |
| AI-02 | Use an open model permitted by the event, identified by name and license in config and README. | MUST |
| AI-03 | Keep all model calls behind a provider interface; no provider-specific types leak into analyzers, API schemas, or UI. | MUST |
| AI-04 | Enforce timeouts, retry limits, input size caps, and structured output validation. | MUST |
| AI-05 | Surface provider mode and status in the UI and API without exposing keys. | MUST |
| AI-06 | Provide a local/demo provider for development and tests, labeled as such everywhere it is used. | MUST |
| AI-07 | Never silently fall back from one provider to another. | MUST |

### 6.8 Interface (UI)

| ID | Requirement | Priority |
|---|---|---|
| UI-01 | Landing page states the value and offers `Try sample repository` and `Upload repository`. | MUST |
| UI-02 | Show GitHub connection only when implemented and configured. | MUST |
| UI-03 | Repository overview shows source type, scan status, file/doc/finding counts, and recent audit summary. | MUST |
| UI-04 | Findings list supports search and filters by status, severity, and check type. | MUST |
| UI-05 | Finding detail shows doc claim, observed fact, paired evidence, status, severity, limitations, and `Generate fix`. | MUST |
| UI-06 | Status and severity are visually and semantically distinct. | MUST |
| UI-07 | Findings and evidence identify file paths and line ranges. | MUST |
| UI-08 | Patch review shows diff, changed files, changed line count, validation checklist, and download actions. | MUST |
| UI-09 | Settings shows operating mode, provider/model label, connection state, and errors. | MUST |
| UI-10 | Every interactive control performs a real action; no inert buttons or fake toggles. | MUST |
| UI-11 | Loading, empty, error, partial, and provider-unavailable states exist for every async surface. | MUST |
| UI-12 | Layout is desktop-first and usable at 360 px width. | MUST |

### 6.9 Operations (OPS)

| ID | Requirement | Priority |
|---|---|---|
| OPS-01 | `GET /api/v1/health` reports app and dependency health without secrets. | MUST |
| OPS-02 | Emit a request ID and log it on every request and error. | MUST |
| OPS-03 | Return safe error payloads with no stack traces or secrets. | MUST |
| OPS-04 | Document mode, mocks, and limitations in the README. | MUST |
| OPS-05 | Provide `.env.example` with placeholders only. | MUST |

---

## 7. Non-functional requirements

Targets marked *proposed* are reasonable defaults; confirm and record in §34 before implementation.

| ID | Requirement | Target | Verified by |
|---|---|---|---|
| NFR-01 | Upload size limit | 20 MB default, configurable | T-SEC-02 |
| NFR-02 | Extraction limits | ≤ 5,000 files, ≤ 2 MB per indexed file, ≤ 200 MB total (*proposed*) | T-SEC-02 |
| NFR-03 | Index performance | ≤ 30 s for 5,000 files / 20 MB on 4 vCPU | Benchmark |
| NFR-04 | Audit performance | ≤ 10 s p95 on sample repo; ≤ 60 s hard cap on bounded repos | Benchmark |
| NFR-05 | API latency | p95 < 500 ms for metadata endpoints, excluding audits and model calls | Manual + logs |
| NFR-06 | Concurrency | One running audit per repository (409 if busy); 8 concurrent workspaces per instance | Integration test |
| NFR-07 | Model call bounds | 30 s timeout, 1 retry, ≤ 32k input tokens, schema-validated output | T-AI-02 |
| NFR-08 | Determinism | Same snapshot produces identical finding IDs, counts, and evidence ranges | T-ANL-02 |
| NFR-09 | Accessibility | WCAG 2.1 AA, full keyboard operation, visible focus, Lighthouse a11y ≥ 95 | Manual audit |
| NFR-10 | Browsers | Last 2 versions of Chrome, Edge, Firefox, Safari | Playwright smoke on Chrome; manual smoke on Edge, Firefox, Safari |
| NFR-11 | Test coverage | ≥ 80% line coverage on analyzers, core/security, and patch_service | CI report |
| NFR-12 | Log hygiene | No secrets, no full file contents, request ID on every line | T-SEC-06 |
| NFR-13 | Workspace lifecycle | TTL 2 h, delete on request, sweep orphans after 24 h | Integration test |
| NFR-14 | Startup and payload | Backend cold start < 3 s; initial frontend bundle ≤ 500 KB gzip | Build output |

---

## 8. Check catalog

### 8.1 Checks

All six are required. At least one MUST be implemented fully end to end for the demo; none may be hard-coded to a fixture.

| ID | `check_id` | Detects | Default status | Default severity |
|---|---|---|---|---|
| CHK-01 | `markdown.internal_link_exists` | Local Markdown link or anchor target missing | `verified` | `medium` |
| CHK-02 | `docs.file_reference_exists` | Setup docs referencing a file that does not exist | `verified` | `medium` |
| CHK-03 | `fastapi.route_matches_docs` | Documented route/method not matching statically discovered routes | `verified` / `needs_review` | `high` |
| CHK-04 | `config.env_var_documented` | Documented env var absent from recognized config sources | `needs_review` | `low` |
| CHK-05 | `python.public_symbol_referenced` | Documented public symbol not found by the static indexer | `needs_review` | `low` |
| CHK-06 | `docs.readme_checklist` | Missing README/setup section from a small explicit checklist | `info` / `needs_review` | `info` |

### 8.2 Check contracts

**CHK-01 — Internal links**
Extract local links and anchors; resolve relative paths from the Markdown file's directory; parse target headings and normalize heading IDs. Report the link's line number. Ignore external URLs, image sources, and code examples.

**CHK-02 — File references**
Extract path-like references from setup/install sections and code blocks. A reference is `verified` only when the path is unambiguous and non-generated. Globs, generated paths, and template variables downgrade to `needs_review`.

**CHK-03 — Routes**
Extract documented method/path pairs from recognized Markdown tables (`Method`, `HTTP Method`, `Endpoint`, `Path`, `Route`), recognized code blocks, or an OpenAPI spec. Compare to decorator forms `@app.get`, `@app.post`, `@router.get`, `@router.api_route(..., methods=[...])`. Record method, path, handler, file, line range.

Reportable outcomes: documented route absent from source; HTTP method mismatch; documented route not parseable. A route present in source but missing from docs is reported only when the docs are clearly intended as a complete API list — otherwise it is noise.

If any router is mounted with an unresolved prefix, or routes are registered via variables, the comparison result MUST be `insufficient_evidence` with a caveat, not "route missing".

**CHK-04 — Environment variables**
Extract `os.getenv("KEY")`, `os.environ["KEY"]`, and documented `KEY=value` / inline `KEY` mentions. Compare with `.env.example`, settings modules, config schemas, and supported source patterns. Sending a variable from deployment is common, so default to `needs_review`. Never read or display values from `.env`.

**CHK-05 — Symbols**
Compare documented `module.function` / `Class` references with the AST index. Static limits (re-exports, dynamic attributes, `__getattr__`) mean this is `needs_review` unless resolution is exact.

**CHK-06 — Checklist**
Configurable list: README exists; install/setup instructions; documented test command; environment setup where relevant; API docs when a supported framework is detected; license file present (presence only, no legal advice).

### 8.3 Status assignment rules

| Condition | Status |
|---|---|
| Deterministic evidence inside the check's stated scope | `verified` |
| Deterministic evidence exists but semantic interpretation is required | `needs_review` |
| Relevant analyzer failed, was skipped, or hit an unsupported pattern | `insufficient_evidence` |
| Previously reported, no longer reproduces | `resolved` |
| User action | `dismissed` |

### 8.4 False-positive policy

Every analyzer MUST record patterns it could not interpret as limitations attached to the finding. An analyzer that cannot parse a file reports `insufficient_evidence` for the affected checks and lists the file — it does not fail the whole audit and does not emit a "missing" finding.

---

## 9. Data model

### 9.1 Entities

| Entity | Key fields | Lifecycle |
|---|---|---|
| `Repository` | `id`, source type, name, status, counts, manifest summary | Session-scoped workspace |
| `RepositoryOverview` | languages, file count, doc files, routes, scan metadata | Derived from index |
| `AuditRun` | `id`, repository, checks run/skipped, summary, timestamps | In-memory, optional persisted |
| `Finding` | see §9.2 | Derived from audit |
| `EvidenceRef` | path, lines, excerpt, role | Derived from files |
| `PatchDraft` | `id`, finding, target path, original content, proposed content, diff, rationale | Session workspace |
| `ValidationResult` | patch, steps, overall outcome | Derived from validation |
| `GroundedAnswer` | answer, citations, limitations, follow-ups | Derived per question |
| `ProviderStatus` | mode, provider, model, state, message | Runtime |
| `ApiError` | code, message, request ID, retryable | Per response |

### 9.2 Canonical `Finding`

```python
from typing import Literal
from pydantic import BaseModel, Field

FindingStatus = Literal[
    "verified", "needs_review", "insufficient_evidence", "resolved", "dismissed"
]
Severity = Literal["high", "medium", "low", "info"]


class EvidenceRef(BaseModel):
    path: str
    start_line: int | None = None
    end_line: int | None = None
    excerpt: str
    role: Literal["documentation", "source", "config", "test", "other"]


class Finding(BaseModel):
    id: str
    check_id: str
    title: str
    summary: str
    status: FindingStatus
    severity: Severity
    confidence_note: str
    documentation_claim: str | None = None
    observed_fact: str | None = None
    evidence: list[EvidenceRef] = Field(default_factory=list)
    limitations: list[str] = Field(default_factory=list)
    suggested_fix: str | None = None
    affected_paths: list[str] = Field(default_factory=list)
```

### 9.3 Identifier scheme

All IDs are opaque, URL-safe, and never parsed by clients.

| Object | Format | Derivation |
|---|---|---|
| Repository | `repo_<12 char>` | Random at creation |
| Audit | `aud_<12 char>` | Random per run |
| Patch | `pat_<12 char>` | Random at creation |
| Finding | `fnd_<12 hex>` | `sha256(check_id + "\x1f" + primary_path + "\x1f" + subject_key)[:12]` |

`subject_key` is the finding's stable identity — the link target, `method + path`, env var name, or symbol name. Line numbers are excluded so that unrelated edits above the defect do not change the ID. Findings are recomputed each audit; a finding present in an earlier run and absent now becomes `resolved`.

### 9.4 Model rules

- `confidence_note` is explanatory text. No invented numeric probabilities.
- Severity and status are separate fields with separate UI treatment.
- Evidence excerpts are bounded (≤ 40 lines and ≤ 4 KB each) and derived from real content.
- All line numbers are one-based.
- Paths are sanitized (relative, forward slashes) before they leave the backend.
- Secret values never enter a finding.

---

## 10. Definition of done

A requirement is done when all of the following hold:

1. Implementation merged and reachable from the primary flow.
2. Acceptance criterion in §28 satisfied and demonstrated.
3. Test covering the requirement exists and passes (§27).
4. Failure behavior defined (§31) and exercised at least once.
5. No secrets, no placeholder data, no inert controls introduced.
6. Docs (`README`, `docs/`) match observed behavior.

A feature is not done because a screen renders it. It is done when the real data path runs end to end and its failure modes are handled.

---

# Part III — Experience

## 11. User journey

| Step | Actor action | System response | Requirements |
|---|---|---|---|
| 1 | Opens app | Landing page with value statement and CTAs | UI-01 |
| 2 | Selects sample repo or uploads ZIP | Workspace created, `repository_id` returned | ING-01, ING-02, ING-05 |
| 3 | Waits for scan | Indexing progress, then overview | ING-07, UI-03 |
| 4 | Reviews overview | Languages, file/doc counts, routes, status | UI-03 |
| 5 | Runs audit | Findings list with summary | ANL-01…03, UI-04 |
| 6 | Filters and selects a finding | Detail with claim, fact, evidence, limits | EVD-01…03, UI-05 |
| 7 | Requests a fix | Minimal patch draft | FIX-01…03 |
| 8 | Reviews diff | Line-based diff and changed-file summary | FIX-05, UI-08 |
| 9 | Validates | Per-step pass/fail/not-run/inconclusive | FIX-06, FIX-07 |
| 10 | Exports | Patch or revised Markdown download | FIX-09 |
| 11 | Asks a question | Grounded answer with citations | ASK-01…05 |

The session records the audit result. Nothing in this journey writes to the source repository.

## 12. Screens

| ID | Screen | Required elements | Must not |
|---|---|---|---|
| SCR-01 | Landing | Headline "Documentation that doesn't lie."; subhead; `Try sample repository`; `Upload repository`; a real product preview (finding + diff); three benefits; MVP scope note; `Connect GitHub` only if configured | Oversized gradients, fake logos, fake metrics, fake testimonials |
| SCR-02 | Repository overview | Name and source type; scan status; files/docs/findings by status; recent audit summary; `Run audit`, `Ask about codebase`, `View findings`; empty state | Fabricated health score |
| SCR-03 | Findings | Search; filters for status, severity, check type; cards with title, summary, path, status, type | Mixing severity and confidence |
| SCR-04 | Evidence inspector | Doc claim; observed fact; side-by-side snippets with path and lines; reasoning; status and limits; `Generate fix`; incomplete-evidence notice | Showing a model guess as verified |
| SCR-05 | Patch review | Diff; files and changed line count; validation checklist with real states; `Download patch`, `Download updated file`; `Apply patch` only if safely implemented | Green "verified" before validation completes |
| SCR-06 | Ask RepoScribe | Chat with example prompts; answers with clickable citations; evidence panel; no-evidence response | Generic chatbot behavior, leaked prompts or secrets |
| SCR-07 | Settings | Operating mode; provider/model label; connection and error state | Exposing keys |

## 13. Design system

### 13.1 Direction

A professional developer tool: dense enough for code review, calm, legible, distinctive. The current build uses
one true-black editorial theme with neutral cards, terminal-green accents, and locally hosted type. It is not a
generic chatbot landing page. There is no light theme in this build.

### 13.2 Tokens (implemented)

| Token | Value |
|---|---|
| Canvas | `#000000` |
| Surface | `#111111`; elevated `#181818`; subtle `#1A1A1A` |
| Ink | `#F7F7F7` primary, `#A3A3A3` secondary, `#808080` faint |
| Border | `#2B2B2B` default, `#474747` strong |
| Accent | Green `#22C55E` (hover `#4ADE80`, strong `#6EE7A0`) |
| Status | success `#22C55E`, warning `#F59E0B`, danger `#F87171`, info `#38BDF8` |
| Type | UI: Inter; display: Bricolage Grotesque; code: JetBrains Mono; accent: Caveat |
| Scale | 10.5 / 12 / 13 / 13.5 / 15.5 / 26 / 36 / 60 px |
| Spacing | 4 px grid (4, 8, 12, 16, 24, 32) |
| Radius | 9 px controls, 16 px panels, pill chips |
| Motion | 160 ms for state changes; short entry animations only |

The four families are self-hosted from `frontend/public/fonts/` and loaded by `frontend/src/styles/fonts.css`;
the app makes no request to a font CDN.

### 13.3 Layout

| Viewport | Structure |
|---|---|
| Desktop ≥ 1024 px | Persistent left sidebar (repository, Overview, Findings, Ask, Settings); sticky top bar; main content. Finding detail separates the documentation claim from source evidence; patch review uses a full-width diff with readable line numbers |
| Tablet 768–1023 px | Sidebar becomes a focus-trapped drawer opened from the top bar; cards stack; diff scrolls horizontally with file identity pinned |
| Mobile < 768 px | Same drawer; single-column content; evidence sits below the finding; no horizontal page overflow |

### 13.4 Component inventory

Implemented modules: `AppShell`, `Sidebar`, `TopBar`, `GlobalSearch`, `FindingCard`, `FilterBar`, `EvidencePane`,
`DiffViewer`, `Notice`, and `Primitives` (`Button`, `Card`, `PageHeader`, `Stat`, `Badge`, `Spinner`,
`EmptyState`, `ErrorNotice`, `ProviderPill`). Screen-specific composition lives in `features/` rather than a
component library; `LandingPage` owns upload intake and `AskPage` owns the citation list.

## 14. States and copy

### 14.1 Async state matrix

Every async surface implements all applicable states. A single global `isLoading` flag is not acceptable.

| State | UI treatment |
|---|---|
| `idle` | Next-action affordance |
| `loading` | Progress with what is happening; no fake skeleton for a completed load |
| `success` | Result plus timestamp |
| `partial` | Result plus what was skipped and why |
| `empty` | Explanation plus the next action |
| `error` | Actionable message, retry, request ID |
| `provider_unavailable` | Deterministic results stay usable; model features disabled with reason |
| `validation_pending` | Neutral state, no success styling |
| `validation_complete` | Per-step outcomes |

### 14.2 Copy deck

| Context | Copy |
|---|---|
| Headline | Documentation that doesn't lie. |
| Subheadline | Detect drift between code and docs. Inspect the evidence. Review a minimal repair. |
| Empty audit | No audit has run for this repository yet. Run an audit to check links, routes, configuration references, and supported documentation rules. |
| No evidence | RepoScribe couldn't establish this claim from the inspected files. This finding needs human review; no automatic repair is recommended. |
| Model unavailable | The AI provider is unavailable. Deterministic checks still work; retry the AI-assisted explanation when the provider is back. |
| Validation scope | Validation checks the proposed documentation against the currently indexed repository. It does not guarantee that every semantic claim is correct. |
| Demo mode | Running in local demo mode. No live Alan connection is configured; AI-generated text comes from a local stub. |

Copy states limitations plainly. No marketing superlatives, no implied accuracy claims.

## 15. Accessibility

- WCAG 2.1 AA contrast for text, borders on interactive elements, and status chips.
- Full keyboard path through navigation, filters, finding selection, diff, and dialogs; focus trapped in dialogs and restored on close.
- Visible focus rings; never `outline: none` without a replacement.
- Status is never communicated by color alone — pair with icon and label.
- Semantic landmarks, headings in order, labelled controls, `aria-live` for async results.
- Diff and code views expose line numbers to assistive tech as text, not images.
- Verify at 200% zoom and with a screen reader on the primary flow.

---

# Part IV — System

## 16. Architecture

### 16.1 Shape

```text
React + TypeScript (Vite)
        |  HTTPS / JSON
        v
FastAPI application
        |
        +--> Repository intake + isolated workspace
        +--> Deterministic analysis engine
        |      file inventory | markdown links | python symbols
        |      fastapi routes | config references | docs routes | checklist
        +--> Evidence store / index
        +--> Model provider interface
        |      +--> Alan adapter (workflow / agent / API)
        |      +--> Local demo adapter
        +--> Documentation draft generator
        +--> Patch builder + validator
        +--> Audit + session state
```

### 16.2 Architectural rules

| ID | Rule |
|---|---|
| AR-01 | The model never invents repository facts. The backend gathers facts and sends a bounded, delimited evidence bundle. |
| AR-02 | The backend validates every model output against a schema and re-checks all paths and citations. |
| AR-03 | Deterministic analyzers have no dependency on the provider layer, in either direction. |
| AR-04 | Writes are confined to a separate patch/session area; the extracted repository stays read-only. |
| AR-05 | Every analyzer is independently runnable and independently testable. |
| AR-06 | One process, one deployable backend. No service mesh, queue, or worker tier in v1.0. |

### 16.3 Backend module map

| Module | Responsibility |
|---|---|
| `app/main.py` | App factory, middleware (request ID, session, rate limit), router wiring, static UI mount |
| `app/api/` | HTTP routes and dependency wiring (`health`, `provider`, `repositories`, `audits`, `findings`, `questions`, `patches`, `deps`) |
| `app/schemas/models.py` | Pydantic request/response models (the public contract) |
| `app/core/settings.py` | Typed configuration |
| `app/core/errors.py` | Error taxonomy and handlers |
| `app/core/security.py` | ZIP extraction, path safety, exclusion rules, redaction |
| `app/services/store.py` | Session-scoped repository registry and workspace lifecycle |
| `app/services/repository_service.py` | Intake, manifest, index refresh, overview |
| `app/services/audit_service.py` | Runs checks, normalizes findings, assigns IDs, resolves/dismisses |
| `app/services/question_service.py` | Retrieval and citation verification |
| `app/services/patch_service.py` | Draft, diff, validation |
| `app/services/export_service.py` | Safe export naming and media types |
| `app/analyzers/common.py` | Markdown and Python parsing, `RepoIndex`, evidence excerpts |
| `app/analyzers/factory.py` | `AnalyzerResult`, stable finding IDs, bounded evidence |
| `app/analyzers/registry.py` | Analyzer list and lookup |
| `app/analyzers/markdown_links.py` | CHK-01 |
| `app/analyzers/docs_references.py` | CHK-02 |
| `app/analyzers/fastapi_routes.py` | CHK-03 (documented routes come from `common.extract_doc_routes`) |
| `app/analyzers/config_references.py` | CHK-04 |
| `app/analyzers/python_symbols.py` | CHK-05 |
| `app/analyzers/readme_checklist.py` | CHK-06 |
| `app/integrations/model_provider.py` | Provider protocol, chunk/proposal types, factory, status |
| `app/integrations/local_demo.py` | Deterministic rule-based provider (default) |
| `app/integrations/alan.py` | Alan adapter, disabled until the contract is verified |

Keep modularity lightweight. Do not create a class per function.

## 17. Stack

Preserve an existing sensible stack. Where nothing exists, use:

| Layer | Choice | Notes |
|---|---|---|
| Frontend | React + TypeScript + Vite | Required |
| Styling | Tailwind CSS | With an existing or minimal local component set |
| Routing | React Router | Only if more than one page |
| Diff | Lightweight diff component or in-house unified diff | Monaco only if it does not destabilize the MVP |
| Backend | Python 3.11+, FastAPI, Pydantic, Uvicorn | Required |
| Parsing | `ast`, stdlib `zipfile`/`pathlib`, tested Markdown link extraction | Tree-sitter only if proven necessary |
| Search | Exact text + symbol search | SQLite FTS5 only if scale demands |
| Vectors | None | Explicitly out of scope for v1.0 |
| Tests | Pytest (+ `httpx` for API tests) | |
| Deploy | Static frontend host + Python host, or one combined service | Dockerfile only if it saves time |

No Redis, no Celery, no Kubernetes, no vector database in v1.0.

## 18. Intake and workspace safety

A ZIP is untrusted input. Treat every entry as hostile.

| ID | Control |
|---|---|
| ING-S1 | Enforce upload size (default 20 MB) before reading the archive. |
| ING-S2 | Enforce max entries, max per-file size, max total extracted size. |
| ING-S3 | Reject absolute paths, `..` traversal, drive prefixes, and entries resolving outside the workspace. |
| ING-S4 | Reject symlinks and hard links. |
| ING-S5 | Skip `.git`, `node_modules`, `.venv`, `venv`, `dist`, `build`, caches, binaries, and generated files. |
| ING-S6 | Never execute repository code or install scripts. |
| ING-S7 | Exclude `.env`, private keys, credentials, and secret-pattern matches from indexing and model context. |
| ING-S8 | Normalize paths and assert every resolved path stays inside its workspace root. |
| ING-S9 | Reject archive bombs via compression-ratio and size caps. |
| ING-S10 | Return actionable errors for malformed or unsupported archives. |

**Workspace layout.** `WORKSPACE_ROOT/{repository_id}/repo` (immutable extracted content) and `WORKSPACE_ROOT/{repository_id}/patch` (drafts, diffs, exports). The manifest lives beside them. Cleanup: on `DELETE`, on TTL expiry (2 h), and a sweep for orphans older than 24 h. File contents never enter logs.

## 19. Analyzer contracts

Every analyzer implements the same shape so the engine can run them independently and degrade safely.

```python
class Analyzer(Protocol):
    check_id: str
    supported_patterns: list[str]
    limitations: list[str]

    def analyze(self, index: RepositoryIndex) -> AnalyzerResult: ...
```

`AnalyzerResult` carries `findings`, `skipped_files` with reasons, and `limitations`. An analyzer MUST NOT raise for unparsable input; it records a skip and returns partial output.

| Analyzer | Input | Output | Failure behavior |
|---|---|---|---|
| `markdown_links` | Doc files | Link and anchor findings | Unparsable file → `skipped_files` |
| `docs_references` | Doc files, manifest | Missing-file findings | Ambiguous path → `needs_review` |
| `python_symbols` | Python files | Symbol index | Syntax error → skipped file |
| `fastapi_routes` | Python files, docs, OpenAPI JSON | Route comparison findings | Unresolved prefix → `insufficient_evidence` |
| `config_references` | Docs, config files, Python | Env var findings | No canonical list → `insufficient_evidence` |
| `readme_checklist` | README, manifest | Checklist findings | Missing README → single finding, not six |

Documented-route extraction lives in `common.extract_doc_routes` (Markdown tables, code-block lines, OpenAPI JSON) and feeds CHK-03; there is no separate `docs_routes` module.

Evidence excerpts are built by `analyzers/factory.py`, so evidence types and bounds are identical for every check.

### 19.1 Retrieval for Q&A

Lexical and symbol retrieval over the index. Rank by exact symbol/path match, then term frequency, then documentation proximity. Return at most 20 evidence chunks, each ≤ 40 lines. No embedding model in v1.0 and no cross-repository retrieval.

## 20. API specification

Base path: `/api/v1`. JSON only. All responses include a request ID header. See §34 D-01 for the versioning decision.

### 20.1 Endpoints

| Method | Path | Purpose | Success |
|---|---|---|---|
| `GET` | `/health` | Liveness, dependency and provider status (no secrets) | 200 |
| `POST` | `/repositories` | Create workspace from `sample` id or ZIP upload | 201 |
| `GET` | `/repositories/{repo_id}` | Metadata and scan status | 200 |
| `POST` | `/repositories/{repo_id}/index` | Run or refresh indexing (synchronous, bounded) | 200 |
| `GET` | `/repositories/{repo_id}/overview` | Counts, languages, docs, routes | 200 |
| `POST` | `/repositories/{repo_id}/audits` | Run an audit | 200 (or 202, see 20.3) |
| `GET` | `/repositories/{repo_id}/audits/{audit_id}` | Audit status and summary | 200 |
| `GET` | `/repositories/{repo_id}/findings` | Paginated, filterable findings | 200 |
| `GET` | `/repositories/{repo_id}/findings/{finding_id}` | One finding plus evidence | 200 |
| `PATCH` | `/repositories/{repo_id}/findings/{finding_id}` | Dismiss or reopen a finding | 200 |
| `POST` | `/repositories/{repo_id}/questions` | Grounded repository Q&A | 200 |
| `GET` | `/repositories/{repo_id}/search` | Bounded repository search | 200 |
| `POST` | `/repositories/{repo_id}/findings/{finding_id}/patches` | Create a patch draft | 201 |
| `GET` | `/repositories/{repo_id}/patches/{patch_id}` | Patch, diff, validation state | 200 |
| `POST` | `/repositories/{repo_id}/patches/{patch_id}/validate` | Run validation | 200 |
| `GET` | `/repositories/{repo_id}/patches/{patch_id}/download` | Download `patch` or `markdown` | 200 |
| `GET` | `/provider` | Provider mode, model label, state | 200 |
| `DELETE` | `/repositories/{repo_id}` | Delete workspace and session data | 204 |

Additions beyond the original contract, added to close gaps: audit-status polling, finding dismissal, repository search, `GET /provider`. They exist because their features have no other endpoint.

### 20.2 Conventions

| Concern | Rule |
|---|---|
| Pagination | `limit` (default 50, max 200) and `cursor`; response includes `next_cursor` |
| Filtering | `status`, `severity`, `check_id`, `q` (bounded length) |
| IDs | Opaque; never parsed; unknown ID → 404 |
| Timestamps | ISO 8601 UTC |
| Errors | `{ "error": { "code", "message", "request_id", "retryable" } }` |
| Auth | Anonymous session cookie (`HttpOnly`, `SameSite=Lax`, `Secure` in production), signed with an HMAC (`SESSION_SECRET`, or a per-process secret); workspaces are scoped to the session |
| Rate limits | 120 requests/min per client address across `/api/v1`, excluding `/api/v1/health` and `/api/v1/provider` (liveness and status polls) → 429 with `Retry-After` |
| Request bodies | Non-multipart bodies capped at `MAX_REQUEST_BODY_MB` (default 1 MB) → 413; uploads capped at `MAX_UPLOAD_MB` and streamed with a byte counter |
| Audit budget | One audit runs inside `AUDIT_TIMEOUT_SECONDS` (default 60); checks that do not finish are reported as skipped, and their findings keep their previous status |
| Finding bounds | Each check reports at most 100 findings and says so; excerpts are bounded |

The limit is keyed on the network peer, not on the session cookie: a client can mint new sessions at will, so
a per-session limit could be reset by clearing the cookie. The session cookie is now signed, which stops a
client from *choosing* an id (session fixation) but does not bound how many sessions it may create. The
current build applies one global per-client limit rather than a separate audit limit; a dedicated audit quota
is deferred.

### 20.3 Long-running work

Audits, indexing, and model calls are bounded (NFR-04, NFR-07). The current build runs audits synchronously and answers within the bound, so `POST /audits` returns `200` with the completed run. The `202` + polling path in `GET /audits/{audit_id}` remains the contract if a future analyzer exceeds the bound. No background queue in v1.0.

### 20.4 Error codes

| Code | HTTP | Meaning |
|---|---|---|
| `invalid_request` | 400 | Malformed input |
| `invalid_archive` | 400 | Unreadable or unsupported ZIP |
| `unsafe_archive_entry` | 400 | Traversal, symlink, or absolute path |
| `payload_too_large` | 413 | Over upload or extraction limits |
| `schema_validation_failed` | 422 | Body failed validation |
| `repository_not_found` | 404 | Unknown or expired workspace |
| `audit_not_found` | 404 | Unknown audit in this repository |
| `finding_not_found` | 404 | Unknown finding in this repository |
| `patch_not_found` | 404 | Unknown patch |
| `audit_in_progress` | 409 | Concurrent audit on one repository |
| `patch_not_available` | 422 | No safe minimal change can be derived for this finding |
| `patch_target_forbidden` | 422 | Target outside documentation allowlist |
| `rate_limited` | 429 | The local per-client request limit was reached; `retryable: true` |
| `provider_unavailable` | 503 | Model unreachable; deterministic results still available |
| `model_output_invalid` | 502 | Output failed schema or citation checks |
| `not_found` | 404 | Unknown route |
| `method_not_allowed` | 405 | Wrong HTTP method |
| `internal_error` | 500 | Unexpected; request ID only, no details |

### 20.5 Example audit response

```json
{
  "repository_id": "repo_demo",
  "audit_id": "aud_01HQ00000000",
  "status": "completed",
  "checks_run": ["markdown.internal_link_exists", "fastapi.route_matches_docs"],
  "checks_skipped": [],
  "summary": {
    "files_inspected": 42,
    "findings_total": 3,
    "verified": 1,
    "needs_review": 2
  },
  "findings": [
    {
      "id": "fnd_7c1a9e2b0d44",
      "check_id": "markdown.internal_link_exists",
      "title": "Broken internal documentation link",
      "status": "verified",
      "severity": "medium",
      "evidence": [
        {
          "path": "README.md",
          "start_line": 18,
          "end_line": 18,
          "excerpt": "[Setup](docs/setup.md)",
          "role": "documentation"
        }
      ],
      "limitations": []
    }
  ]
}
```

Illustrative shape only. Runtime values MUST come from inspection.

### 20.6 Client type contract

`lib/types.ts` mirrors the backend schemas one-to-one. No screen defines its own ad-hoc response shape.

| Type | Mirrors |
|---|---|
| `Repository` | `GET /repositories/{id}` |
| `RepositoryOverview` | `GET /repositories/{id}/overview` |
| `AuditRun`, `AuditSummary` | `POST /audits`, `GET /audits/{id}` |
| `Finding`, `EvidenceRef` | Finding endpoints |
| `PatchDraft`, `ValidationResult`, `ValidationStep` | Patch endpoints |
| `GroundedAnswer`, `Citation` | `POST /questions` |
| `ProviderStatus` | `GET /provider` |
| `ApiError` | Error envelope (§20.2) |

Server state is owned by the feature that uses it. Distinguish `idle`, `loading`, `success`, `partial`, `empty`, `error`, `provider_unavailable`, `validation_pending`, and `validation_complete` per operation (§14.1). A single global `isLoading` flag for unrelated operations is not acceptable. A model response is never styled as a verified backend result.

## 21. AI integration

### 21.1 Division of labor

| Deterministic backend | Model |
|---|---|
| File discovery, path safety, line extraction | Explain a finding in plain language |
| Link and anchor validation | Compare a claim with a bounded evidence bundle |
| Route and symbol extraction | Suggest a minimal documentation correction |
| Config reference extraction | Answer repository questions from retrieved snippets |
| Diff creation, target restrictions | Summarize an audit |
| Validation results, finding IDs | Draft rationale and limitation text |

### 21.2 Verification gate (blocking)

Do not write the Alan adapter until all of these are answered and recorded in `docs/alan-integration.md` and §34:

1. The event's current official instructions, read in full.
2. The exact Alan product, workflow, SDK, or API to integrate.
3. How the application authenticates and invokes it.
4. How model selection works and which open models and licenses are permitted.
5. Whether tool/API invocation is supported and how credentials are supplied.
6. A minimal proof of concept that actually returns a completion.
7. The exact settings names used by the real integration (replacing the placeholders in §25).

If the gate cannot be satisfied, ship the labeled local demo provider and state the limitation without implying a live connection.

### 21.3 Provider interface

```python
class ModelProvider(Protocol):
    def explain_finding(self, finding: Finding, evidence: EvidenceBundle) -> Explanation: ...
    def answer_question(self, question: str, evidence: EvidenceBundle) -> GroundedAnswer: ...
    def draft_patch(self, finding: Finding, evidence: EvidenceBundle,
                    document: str) -> PatchDraft: ...
    def status(self) -> ProviderStatus: ...
```

Every method validates input size, enforces a timeout, and returns a parsed schema object. Errors map to the codes in §20.4.

### 21.4 Agent tools

If the Alan integration supports tool invocation, expose exactly these, with explicit schemas. The model may call tools; tools never inherit authority from model output.

| Tool | Inputs | Guarantees |
|---|---|---|
| `get_repository_overview` | `repository_id` | Session-scoped, read-only |
| `search_repository` | `repository_id`, `query`, optional `allowed_paths` | Bounded results, path allowlist |
| `get_file_excerpt` | `repository_id`, `path`, `start_line`, `end_line` | Workspace-confined, line-capped, secret-redacted |
| `run_documentation_audit` | `repository_id`, optional `check_ids` | No writes |
| `get_finding` | `repository_id`, `finding_id` | Read-only |
| `draft_documentation_patch` | `repository_id`, `finding_id`, `target_path` | Docs-only target, no overwrite |
| `validate_documentation_patch` | `repository_id`, `patch_id` | No commit, no push |

Each tool validates types and bounds, verifies session ownership, restricts paths to the workspace, returns structured JSON, applies timeouts, and never exposes a shell.

### 21.5 Prompt-injection defenses

Repository content is untrusted data, including README text that says "ignore previous instructions" or asks for secrets.

- Never treat repository content as system or developer instructions.
- Put excerpts in delimited, labeled untrusted blocks.
- No unrestricted shell or filesystem capability for the model.
- Tools enforce permissions independently of model output.
- Strip secrets and sensitive files before building context.
- Constrain output to a known schema and reject anything else.
- Validate every proposed target path against a documentation allowlist.
- Require human approval before any write.

### 21.6 Grounded Q&A contract

```json
{
  "answer": "string",
  "citations": [{ "path": "string", "start_line": 1, "end_line": 10 }],
  "limitations": ["string"],
  "follow_up_suggestions": ["string"]
}
```

The backend verifies every citation against the retrieved evidence set and drops or rejects invalid ones (ASK-03). Citations are shown as chips that open the evidence panel.

## 22. Patch pipeline

### 22.1 Generation

| Input | Output |
|---|---|
| Selected finding, current document, relevant source evidence, allowed target path, output format | Proposed content or unified diff, rationale, evidence references, limitations, validation plan |

Rules: documentation only; minimal change; reject absolute and traversing targets; preserve line endings; keep drafts in the patch workspace; never overwrite the original.

**Target allowlist.** `README.md`, `CONTRIBUTING.md`, `docs/**/*.md` within the repository root. Max 40 changed lines per patch draft; beyond that, require a new finding-scoped draft instead of expanding.

### 22.2 Validation pipeline

| Step | Check | Outcome on failure |
|---|---|---|
| V-1 | Target is a permitted Markdown file inside the workspace | `failed`, reject |
| V-2 | Patch applies cleanly to the indexed original | `failed` |
| V-3 | Re-run the finding's source check against the proposed document | `failed` if still reproduces, `inconclusive` if scope changed |
| V-4 | Internal links and anchors in the proposed content | `failed` per broken link |
| V-5 | Referenced source files and symbols exist in the current snapshot | `failed` |
| V-6 | No new secrets, no source-file edits, no unrelated hunks | `failed` |

Overall result is `passed` only when every step is `passed`; any `failed` is a fail; `not_run` or `inconclusive` prevents a pass claim. The UI states that passing is not proof of semantic correctness.

### 22.3 Approval model

Generate → preview → validate → download. No automatic commit, push, or PR in v1.0. `Apply patch` is optional and, if built, requires an explicit confirm dialog naming the file and line range.

## 23. Security and privacy

### 23.1 Threats and controls

| Threat | Control |
|---|---|
| ZIP traversal / zip slip | Path resolution guard, reject unsafe entries (ING-S3) |
| Archive bomb | Size, count, ratio caps (ING-S2, ING-S9) |
| Arbitrary code execution | Static parsing only; never import or run repo code |
| Secret exfiltration via model | Secret-pattern exclusion and redaction before context build |
| Prompt injection from repo text | Delimited untrusted content, no tool authority, schema outputs |
| Model-controlled writes | Docs-only allowlist, separate patch workspace, approval gate |
| SSRF via repo metadata | No outbound fetch in v1.0; GitHub import is v1.1 and allowlisted |
| Path disclosure | Sanitized relative paths only; no absolute server paths in responses |
| Log leakage | No file contents, no secrets, request IDs only |
| Dependency compromise | Pinned versions, lockfiles, dependency audit in CI |

### 23.2 Privacy disclosure (README must state)

- Whether repository contents stay local or are sent to an external provider.
- Exactly which data goes to Alan or the configured model, and in what size.
- How to run deterministic checks with AI disabled.
- Where temporary workspaces live, their TTL, and how deletion works.
- Which integrations are optional.

Do not claim "your code never leaves your machine" if any snippet is sent to a provider.

## 24. Reliability and observability

- Provider timeouts, one retry with backoff, then a clear `provider_unavailable` state.
- Hard caps on prompt size, evidence count, and excerpt length.
- Per-file parse failures degrade to skips, never to a failed audit.
- Partial audit results are returned with `checks_skipped` and reasons.
- Finding IDs are stable across runs for unchanged content (NFR-08).
- No fake progress, no fake success, no silent provider substitution.
- Structured logs: timestamp, level, request ID, route, duration, outcome. No bodies by default.
- `/health` reports: app, workspace writability, provider reachability, version.
- Client errors surface the request ID so a report can be traced.

## 25. Configuration

Typed settings module; no secret ever exposed through a `VITE_` variable.

```env
APP_ENV=development
FRONTEND_ORIGIN=http://localhost:5173
BACKEND_PORT=8000

MAX_UPLOAD_MB=20
MAX_EXTRACTED_FILES=5000
MAX_FILE_MB=2
MAX_EXTRACTED_MB=200
WORKSPACE_ROOT=./.reposcribe-workspaces
WORKSPACE_TTL_MINUTES=120

# Fill only from the verified Alan integration (see 21.2).
ALAN_API_KEY=
ALAN_WORKFLOW_ID=
ALAN_BASE_URL=

MODEL_PROVIDER=local_demo
MODEL_NAME=
MODEL_LICENSE=
MODEL_BASE_URL=
MODEL_API_KEY=

MODEL_TIMEOUT_SECONDS=30
MODEL_MAX_INPUT_TOKENS=32000
```

These names are placeholders until §21.2 is satisfied. `.env.example` contains placeholders only; `.env` is gitignored and never read for analysis.

---

# Part V — Delivery

## 26. Repository structure

Target layout. Create modules as needed; do not scaffold empty files.

```text
reposcribe/
├── README.md
├── SPEC.md                          # this document
├── LICENSE
├── CONTRIBUTING.md
├── .gitignore
├── .env.example
├── .github/workflows/ci.yml
├── docker-compose.yml               # optional
├── frontend/
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── playwright.config.ts
│   ├── e2e/                         # API seed setup, fixtures, smoke spec
│   └── src/
│       ├── app/                     # App.tsx, router.tsx, providers.tsx
│       ├── components/
│       │   ├── layout/
│       │   ├── ui/
│       │   ├── findings/
│       │   ├── evidence/
│       │   └── diff/
│       ├── features/
│       │   ├── repositories/
│       │   ├── audits/
│       │   ├── questions/
│       │   └── patches/
│       ├── lib/                     # api.ts, types.ts, format.ts, shell.ts, useAsync.ts
│       ├── styles/
│       └── main.tsx
├── backend/
│   ├── pyproject.toml
│   ├── app/
│   │   ├── main.py
│   │   ├── api/                     # health, repositories, audits, findings,
│   │   │                            # questions, patches, provider
│   │   ├── schemas/
│   │   ├── core/                    # settings, errors, security
│   │   ├── services/                # store, repository, audit, question,
│   │   │                            # patch, export
│   │   ├── analyzers/               # common, factory, registry,
│   │   │                            # markdown_links, docs_references,
│   │   │                            # fastapi_routes, config_references,
│   │   │                            # python_symbols, readme_checklist
│   │   ├── integrations/            # model_provider, alan, local_demo
│   │   └── data/sample_repo/
│   └── tests/
│       ├── unit/
│       ├── integration/
│       ├── security/
│       └── fixtures/
└── docs/
    ├── architecture.md
    ├── alan-integration.md
    ├── threat-model.md
    ├── evaluation.md
    ├── demo-script.md
    └── archive/
```

**Conventions.** `backend/app` is the only import root. Analyzers are pure functions over an index. Services own orchestration. API handlers contain no business logic. Frontend features own their server state; `lib/api.ts` is the only place that talks HTTP.

## 27. Test strategy

### 27.1 Unit

| ID | Test |
|---|---|
| T-01 | ZIP traversal rejection (`../`, absolute, drive prefix) |
| T-02 | Excluded path handling |
| T-03 | Markdown relative link resolution |
| T-04 | Anchor normalization (case, punctuation, duplicates) |
| T-05 | Python symbol extraction |
| T-06 | FastAPI route extraction for each supported decorator form |
| T-07 | Env var extraction from docs and source |
| T-08 | Status normalization rules |
| T-09 | Evidence line ranges and bounds |
| T-10 | Patch target restriction and allowlist |
| T-11 | Diff generation and clean application |
| T-12 | Secret redaction |
| T-13 | Finding ID determinism across runs |

### 27.2 Integration

Fixture repository with known source and docs. Prefer a real FastAPI app over mocks.

| ID | Test |
|---|---|
| T-14 | Documented route matches source route |
| T-15 | Documented route is stale → finding with correct lines |
| T-16 | Markdown link points to a missing file |
| T-17 | Documented config key missing from canonical list |
| T-18 | Generated patch fixes the seeded issue |
| T-19 | Validation rejects a patch that does not fix the issue |
| T-20 | Provider unavailable → deterministic audit still succeeds |
| T-21 | Unknown repository/finding/patch IDs return safe 404 |
| T-22 | Concurrent audit returns 409 |
| T-23 | Workspace TTL and deletion cleanup |

### 27.3 Security

| ID | Test |
|---|---|
| T-SEC-01 | ZIP contains `../../outside.txt` → rejected |
| T-SEC-02 | Oversized file or entry count → rejected |
| T-SEC-03 | README prompt injection grants no extra tool access |
| T-SEC-04 | Patch targeting `../../.env` → rejected |
| T-SEC-05 | Model cites a nonexistent path → citation rejected |
| T-SEC-06 | Logs contain no secret values or file bodies |
| T-SEC-07 | Uploaded secret-like files excluded from model context |

### 27.4 Benchmark

Seeded repository with 10–20 known defects. Record seeded count, detected, false positives, patches passing validation, invalid citations, and audit time. Publish only measured values, with methodology, in `docs/evaluation.md`.

### 27.5 Commands and CI

Define and document exact commands. The CI workflow is configured to run the available backend suite, the frontend typecheck and build, and the browser end-to-end suite on every push and pull request to `main`. A red suite blocks merge. Never report a suite as passing unless it ran.

**Shipped commands:** `python -m pytest -q` (backend), `npm run typecheck` and `npm run build` (frontend), and `npm run test:e2e` (Playwright: 10 tests, 39 checks). No linter or type checker is configured for Python yet; that remains open work.

Test IDs (`T-01`, `T-SEC-01`, …) are logical identifiers used in §29. Concrete test functions live in `backend/tests/unit`, `backend/tests/integration`, `backend/tests/security`, `backend/tests/test_api_contract.py`, and `frontend/e2e/smoke.spec.ts`.

## 28. Acceptance criteria

Release requires every MUST below.

### 28.1 Functional

| ID | Criterion |
|---|---|
| AC-F-01 | App loads the bundled sample repository |
| AC-F-02 | A supported ZIP uploads and extracts safely |
| AC-F-03 | Overview is derived from real scanned files |
| AC-F-04 | Audit produces real deterministic findings |
| AC-F-05 | Each finding has a stable ID and a meaningful status |
| AC-F-06 | Evidence paths and line ranges point to actual content |
| AC-F-07 | User can inspect documentation and source evidence side by side |
| AC-F-08 | User can ask a repository question and get grounded citations when AI is configured |
| AC-F-09 | User can generate a patch for a supported finding |
| AC-F-10 | Patch renders in a diff viewer |
| AC-F-11 | User can validate and export the patch |
| AC-F-12 | The original repository is never silently modified |
| AC-F-13 | UI distinguishes verified findings from suggestions and uncertainty |
| AC-F-14 | Provider failure leaves deterministic checks usable |
| AC-F-15 | Alan integration is real and accurately documented in the final configured demo |
| AC-F-16 | An eligible open model is used per event rules |
| AC-F-17 | No critical control is fake or inert |

### 28.2 Quality

| ID | Criterion |
|---|---|
| AC-Q-01 | Unit and integration suites pass |
| AC-Q-02 | ZIP traversal tests pass |
| AC-Q-03 | Prompt-injection fixture grants no extra access |
| AC-Q-04 | No secrets committed; `.env.example` holds placeholders only |
| AC-Q-05 | No console errors or unhandled backend exceptions in the primary flow |
| AC-Q-06 | Mobile layout is usable at 360 px |
| AC-Q-07 | README setup verified from a clean environment |
| AC-Q-08 | Demo is repeatable and does not depend on unpredictable model output for the key result |
| AC-Q-09 | Measured benchmark results are reported with methodology |

### 28.3 UX

| ID | Criterion |
|---|---|
| AC-U-01 | The first meaningful action is obvious |
| AC-U-02 | A finding is understandable without reading raw model output |
| AC-U-03 | Evidence and proposed fix are visually distinct |
| AC-U-04 | Loading, empty, error, and success states are implemented |
| AC-U-05 | No fake logos, accuracy numbers, charts, or integrations |
| AC-U-06 | Copy communicates limitations honestly |
| AC-U-07 | Keyboard path works through the primary flow |

## 29. Traceability

| Capability | Requirements | Checks / Tests | Acceptance |
|---|---|---|---|
| Intake | ING-01…08 | T-01, T-02, T-SEC-01, T-SEC-02 | AC-F-01, AC-F-02, AC-Q-02 |
| Index | IDX-01…05 | T-05, T-06, T-07 | AC-F-03 |
| Audit | ANL-01…06 | T-08, T-13, T-14, T-15, T-22 | AC-F-04, AC-F-05, AC-F-14 |
| Evidence | EVD-01…04 | T-09, T-12, T-SEC-06 | AC-F-06, AC-F-07 |
| Patch | FIX-01…11 | T-10, T-11, T-18, T-19, T-SEC-04 | AC-F-09…12 |
| Ask | ASK-01…06 | T-SEC-05 | AC-F-08 |
| AI | AI-01…07 | T-SEC-03, T-20 | AC-F-14…16, AC-Q-03 |
| Interface | UI-01…12 | Manual + Lighthouse | AC-F-17, AC-U-01…07 |
| Security | SEC-01…10 | T-01, T-02, T-SEC-01…07 | AC-Q-02…04 |
| Operations | OPS-01…05, NFR-* | CI + `/health` checks | AC-Q-01, AC-Q-05…09 |

## 30. Build plan

### Phase 0 — Inspect and prove the integration

Inspect the repository; read the event rules; verify the Alan product and permitted open model; build a throwaway proof-of-concept call; confirm dev commands.
**Exit:** one real Alan call works and model eligibility is confirmed in writing (§21.2), or the demo-mode decision is recorded.

### Phase 1 — Deterministic vertical slice

Sample repository; safe inventory; Markdown link check; Python symbol and FastAPI route extraction; route-mismatch finding with real lines; backend tests.
**Exit:** the seeded defect is found correctly with no LLM involved.

### Phase 2 — Evidence and patch workflow

Normalized findings; evidence inspector; patch generation; diff render; deterministic validation; export.
**Exit:** a user goes from finding to validated, downloadable patch without touching the original repo.

### Phase 3 — Alan agent and grounded Q&A

Connect the verified workflow; define narrow tools; add repository search and Q&A with citations; add provider errors and timeouts; test hostile input.
**Exit:** the agent calls real tools and cannot pass an unchecked citation.

### Phase 4 — UI polish

Navigation, overview, findings, inspector, Q&A, diff; loading/error/empty/partial states; responsive and keyboard behavior; remove dead controls and placeholder data.
**Exit:** the primary flow demos without developer intervention.

### Phase 5 — Test, deploy, submit

Full suites; benchmark with real numbers; deploy; README; 1–3 minute recording; public repo and submission link verified; rehearse twice.
**Exit:** every acceptance criterion in §28 is checked with evidence.

**Cut order when time is short:** advanced checks → UI extras → persistence → GitHub import. Never cut tests, evidence quality, the working core workflow, or honesty about what is mocked.

### Shipped status

| Phase | State | Evidence |
|---|---|---|
| 0 — Inspect and prove the integration | **Blocked** | The Alan contract is unverified; `docs/alan-integration.md` holds the open checklist. The demo-mode decision is recorded in `D-06`. |
| 1 — Deterministic vertical slice | Done | Sample repository, safe inventory, all six checks, route mismatch with real lines; `133 passed` |
| 2 — Evidence and patch workflow | Done | Normalized findings, inspector, patch generation, diff, six-step validation, export |
| 3 — Alan agent and grounded Q&A | Partial | Retrieval, citation verification, and provider errors are implemented and tested; the grounded Q&A path runs through the local demo provider. The live Alan call is not implemented. |
| 4 — UI polish | Done | Seven screens, per-operation loading/empty/error/partial states, keyboard-visible focus, responsive down to 360 px, no inert controls |
| 5 — Test, deploy, submit | Partial | Backend, frontend, and Playwright E2E suites are wired into CI; benchmark and deployment are not run, and the README publishes no unmeasured numbers |

## 31. Failure modes

| Condition | Expected behavior |
|---|---|
| Invalid ZIP | Reject with a clear explanation |
| Unsafe archive entry | Reject the entry and report it |
| Unsupported language | Show partial support and list checks that ran |
| Dynamic route unresolved | `insufficient_evidence`; never "route missing" |
| Model unavailable | Deterministic audit remains usable; show provider status |
| Model output invalid | Reject, map to `model_output_invalid`, allow retry |
| Citation not in evidence | Reject or drop; never present as grounded |
| Patch does not apply | Validation `failed`; original files untouched |
| Patch outside docs | Reject with `patch_target_forbidden` |
| Prompt injection in repo | Content stays untrusted; tools unchanged |
| Audit too slow | Progress, then 202 + polling; partial results if safe |
| No findings | Explain which checks ran and their scope |
| No supported checks | Explain why and name supported alternatives |
| Workspace expired | 404 `repository_not_found` with next steps |
| Concurrent audit | 409 `audit_in_progress` |

## 32. Demo

### 32.1 Sample repository

Tiny, readable FastAPI project: `app/main.py`, `app/routes/users.py`, `app/settings.py`, `README.md`, `docs/api.md`, `.env.example`, two route tests. Seed a real defect: README documents `GET /api/users` while the source defines `GET /api/v2/users`. Detection must be genuine — never keyed on repository name.

### 32.2 Two-minute script

1. Open the sample repository.
2. Run the audit.
3. Show the stale route finding.
4. Open evidence: README line versus the decorator.
5. Ask the agent to explain the discrepancy.
6. Generate the minimal patch.
7. Show the diff.
8. Run validation and show the real result.
9. Download the patch.
10. Close on the public repo and setup instructions.

The app must work before recording. A local fallback is allowed only when labeled honestly.

## 33. README contract

The public README contains, in this order: name and one-line pitch; demo GIF/video or screenshot; problem; what it does and does not do; feature list labeled implemented vs planned; architecture diagram; Alan integration explanation; open model name, license, and configuration; tech stack; local setup; `.env.example` reference; test commands; sample repository walkthrough; benchmark methodology and measured results; security and privacy notes; known limitations; roadmap; contribution guide and license.

Never mark planned work complete, and never publish fabricated screenshots, results, or links.

## 34. Risks and decisions

### 34.1 Risks

| ID | Risk | Severity | Mitigation |
|---|---|---|---|
| R-01 | Alan integration unspecified or inaccessible | High | Phase 0 gate; adapter behind interface; labeled demo mode |
| R-02 | Open-model eligibility unclear | High | Verify license against event rules before building; record in README |
| R-03 | Static analysis false positives (prefixes, mounts, re-exports) | High | `insufficient_evidence` status, caveats, scoped claims |
| R-04 | ZIP handling vulnerability | High | Layered caps, path guards, security suite in CI |
| R-05 | Scope creep in UI | Medium | Phase gates; cut order in §30 |
| R-06 | Demo depends on network or model behavior | Medium | Deterministic core carries the key result |
| R-07 | Solo build time | Medium | Vertical slice first; post-MVP list is frozen |

### 34.2 Open decisions

Record the resolution, date, and rationale for each. Status reflects the current `0.3.0` working tree.

| ID | Decision | Resolution | Status |
|---|---|---|---|
| D-01 | API versioning | `/api/v1` prefix | Resolved |
| D-02 | Session/auth model | Anonymous `HttpOnly` session cookie scoped to workspace | Resolved |
| D-03 | Persistence | In-memory session state + on-disk workspace; no database in v1.0 | Resolved |
| D-04 | Extraction limits | 20 MB upload, 5,000 files, 2 MB per file, 200 MB total | Resolved |
| D-05 | License | MIT | Resolved (confirm before publishing publicly) |
| D-06 | Alan product and open model | **Open.** The adapter is implemented but disabled; `verified_contract` is false and `/provider` reports it. Requires the Phase 0 gate (§21.2). | Blocked on external information |
| D-07 | Deployment target | Static frontend build served by the FastAPI app; separate hosts optional | Resolved |
| D-08 | Frontend component base | Tailwind with a small in-repo component set; no third-party component library | Resolved |

## 35. Roadmap

Only after the MVP is stable.

| Release | Contents |
|---|---|
| v1.1 | GitHub import; better Markdown/heading resolution; OpenAPI comparison; changed-file scans; persistent history |
| v1.2 | PR checks; authorized PR comments/patches; repository policies; more Python frameworks; Tree-sitter for selected languages |
| v2.0 | CI action; team policies; dependency impact graph; scheduled audits; optional semantic retrieval; provider evaluation suite; analyzer plugins |

Do not build these before users validate the core workflow.

---

## Appendix A. Glossary

| Term | Meaning |
|---|---|
| Drift | A mismatch between what documentation claims and what the repository contains |
| Finding | A structured, evidence-backed discrepancy record |
| Evidence | A bounded excerpt from a real file with path, lines, and role |
| Verified | Deterministic proof inside the check's stated scope |
| Needs review | Plausible mismatch that requires human or semantic confirmation |
| Insufficient evidence | The tool cannot safely conclude |
| Patch | A proposed documentation-only change with diff and validation |
| Grounded answer | A model answer whose every citation maps to retrieved evidence |
| Demo mode | Local stub provider, explicitly labeled, never presented as live |
| Analyzer | Deterministic module that inspects the index for one check |
| Manifest | Per-file inventory of the extracted repository |
| Snapshot | The immutable extracted repository state an audit ran against |

## Appendix B. Changelog

| Version | Date | Change |
|---|---|---|
| 1.0 | — | Original implementation brief (`docs/archive/RepoScribe_Complete_Technical_Spec_v1.md`) |
| 2.0 | 2026-10-26 | Restructured into five parts; added requirement IDs, check catalog, measurable NFRs, API error taxonomy and missing endpoints, identifier scheme, state matrix, traceability, risk and decision registers, test IDs; converted ad-hoc lists and ASCII tables to Markdown tables; resolved the API-versioning and session-model gaps by recorded decision. No requirement intent removed. |
| 2.1 | 2026-10-26 | Aligned the document with the shipped build: module map, analyzer contracts, API success codes, rate-limit and long-running behaviour, error codes (`patch_not_available`, `audit_not_found`), decision-log resolutions, per-phase shipped status, and the real test and build commands. |
| 2.2 | 2026-10-26 | **0.3.0 hardening (tagged `v0.3.0`)**: rate limit excludes `/health` and `/provider`; findings filters validated against `Literal[...]` so invalid values return 422; cursor validated as a non-negative integer (also 422 on garbage); /health probes workspace writability once per process; version string synced across `pyproject.toml`, `package.json`, FastAPI metadata, `/health.version`, README, and SPEC. See `docs/audit-2026-10.md`. |
| 2.3 | 2026-10-26 | Corrected status and UI documentation to the implemented build: source version `0.3.0`, later tagged `v0.3.0`; true-black editorial tokens and self-hosted fonts in place of the proposed light theme; component inventory aligned with shipped modules. Recorded SPA deep-link fallback, secret-file exclusion from the index/manifest/counts, streaming upload limit, full route-template logging, last-access workspace TTL, the per-repository audit lock, and `133 passed` backend tests. |
| 2.4 | 2026-10-26 | Moved the 39-check browser smoke pass into the repository as a 10-test Playwright suite (API-seeded fixtures, 360 px drawer and overflow coverage) and added it to CI alongside the backend and frontend jobs. Updated the shipped commands and the NFR-10 verification method; no product behavior changed. |
| 2.5 | 2026-10-27 | Added the scroll-driven landing narrative and deployment configuration (Dockerfile, Render Blueprint, Vercel proxy). Fixed CHK-04 single-word variables and restoration of a finding's pre-dismissal status. CI passed on the tagged commit; `v0.3.0` is the first tag. |
