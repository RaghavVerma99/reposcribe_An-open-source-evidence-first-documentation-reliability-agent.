# Contributing to RepoScribe

Thanks for helping. This project values evidence over cleverness: a smaller change that is provably correct beats
a larger one that is merely plausible.

## Before you start

Read `SPEC.md`. It is the source of truth for requirements, and every requirement has an ID (`ING-03`, `CHK-03`,
`NFR-04`, `AC-F-09`). Reference those IDs in issues, commits, and pull requests.

## Setup

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -e ".[dev]"
```

```powershell
cd frontend
npm install
```

## Checks to run before opening a pull request

```powershell
cd backend
.\.venv\Scripts\python.exe -m pytest -q
```

```powershell
cd frontend
npm run typecheck
npm run build
```

A red suite blocks merge. Do not report a suite as passing unless you ran it and saw the result.

## Rules that apply to every change

1. **Never fabricate evidence.** Paths, line numbers, routes, and validation results come from real inspection.
2. **Keep status honest.** A model suspicion is never labelled `verified`. Unsupported static-analysis patterns
   become `insufficient_evidence`, not "missing".
3. **Documentation-only patches.** Patch targets are restricted to Markdown under the allowlist. Never widen this
   without updating `SPEC.md` §22.
4. **No inert controls.** Every button, toggle, and link performs a real action. If it cannot, remove it.
5. **Untrusted input stays untrusted.** Repository text never becomes instructions, and tools enforce their own
   permissions regardless of model output.
6. **Tests come with the change.** A new check needs a unit test for its parsing and an integration test proving it
   fires on a real fixture.
7. **Change the spec in the same change.** If behaviour and `SPEC.md` disagree, amend the document.

## Adding an analyzer

1. Implement the analyzer in `backend/app/analyzers/` with `check_id`, `supported_patterns`, `limitations`, and
   `analyze(index) -> AnalyzerResult`.
2. Never raise on unparsable input — record a skipped file with a reason.
3. Register it in `backend/app/analyzers/registry.py`.
4. Add unit tests for extraction and an integration fixture proving detection.
5. Add the check to the catalog in `SPEC.md` §8 and to the traceability matrix in §29.

## Style

Match the surrounding code. Python uses typed dataclasses and Pydantic v2 models; the frontend uses function
components with feature-scoped state, and talks to the API only through `frontend/src/lib/api.ts`.

## Reporting a problem

Include the request ID shown in the UI or returned in the error body, the exact command you ran, and what you
expected instead. If a finding looked wrong, include the evidence snippets — a false positive with the evidence
attached is fixable.