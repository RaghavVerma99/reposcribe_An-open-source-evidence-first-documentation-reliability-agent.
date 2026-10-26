# Evaluation

## Status: harness described, benchmark not yet run

No precision, recall, timing, or accuracy figure is published for RepoScribe yet. The procedure below defines how
those numbers must be produced. Publish only measured values, and always with the fixture and method attached.

## Benchmark fixture

Create a seeded repository containing 10–20 known documentation defects, one per line of the table below. The
fixture lives outside the shipped sample so the demo repository stays small and readable.

| Defect class | Check | Seed |
|---|---|---|
| Missing local file link | `markdown.internal_link_exists` | Link to `docs/removed.md` |
| Broken heading anchor | `markdown.internal_link_exists` | Link to `#deleted-section` |
| Setup reference to a removed script | `docs.file_reference_exists` | `` `scripts/seed.py` `` |
| Stale documented route | `fastapi.route_matches_docs` | Docs say `/api/users`, code exposes `/api/v2/users` |
| Documented method mismatch | `fastapi.route_matches_docs` | Docs say `POST`, code exposes `PUT` |
| Documented route that never existed | `fastapi.route_matches_docs` | Docs say `/api/legacy` |
| Undocumented environment variable | `config.env_var_documented` | Docs require `CACHE_URL`, absent from config |
| Stale symbol reference | `python.public_symbol_referenced` | Docs reference a renamed helper |
| Missing setup section | `docs.readme_checklist` | README without installation instructions |
| Missing license file | `docs.readme_checklist` | No LICENSE |
| Unsafe-looking but valid reference | any | Placeholder `*.py` and `<your-token>` must not fire |
| External URL | `markdown.internal_link_exists` | External links must never be fetched or reported |

Also include **clean control documents** with correct links, correct routes, and a complete README. False-positive
rate is measured against the control set, not against the seeded defects.

## Procedure

1. Build the fixture from a committed generator script so the seed is reproducible.
2. Run the audit with all six checks and record every finding with its status.
3. Match findings to seeded defects by `(check_id, primary evidence path, subject)`.
4. Record the numbers below. Do not estimate, and do not round in the product's favour.

| Metric | How it is computed | Result |
|---|---|---|
| Seeded defects | Count in the fixture | not measured |
| Detected | Seeded defects matched by a finding with status `verified` or `needs_review` | not measured |
| Detection recall | Detected / seeded | not measured |
| False positives | Findings on the control set that are not seeded defects | not measured |
| False-positive rate | False positives / control documents | not measured |
| Evidence validity | Share of findings whose path exists and whose line range contains the excerpt | not measured |
| Patch validation pass rate | Share of generated patches whose validation outcome is `passed` | not measured |
| Invalid citations accepted | Citations returned that do not map to retrieved evidence (must be 0) | not measured |
| Audit duration | Wall clock for `POST /audits` on the fixture | not measured |

## Method notes to publish with any result

- Machine and Python version used.
- Fixture size (files, lines) and the exact commit of the generator.
- Which checks were enabled.
- That `needs_review` findings are not equivalent to `verified` findings, and the split between them.
- That deterministic checks cannot see dynamically registered routes, re-exports, or generated files.

## Regression guard

The existing suites are the regression guard, not the benchmark:

```powershell
cd backend
.\.venv\Scripts\python.exe -m pytest -q
```

`tests/integration/test_audit_and_patch.py` asserts that the shipped sample yields all six checks, that a route
finding carries both documentation and source evidence with real line numbers, that finding IDs are stable across
runs, and that validation rejects a patch which does not fix the finding.