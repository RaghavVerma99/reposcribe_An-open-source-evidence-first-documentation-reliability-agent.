# Threat model

The repository under analysis is untrusted input. Every control below is implemented in the current build and
covered by a test unless noted.

## Threats and controls

| Threat | Control | Where | Test |
|---|---|---|---|
| Zip slip / path traversal (`../../x`, absolute paths, drive prefixes) | Entry names are sanitized and every resolved target must stay inside the workspace | `core/security.safe_extract_zip`, `sanitize_rel_path`, `is_within` | `T-SEC-01`, `T-01` |
| Symlink or hardlink escape | Entries whose mode marks a symlink are rejected outright | `core/security._entry_is_symlink` | `test_zip_symlink_is_rejected` |
| Archive bomb / compressed bomb | Entry count, per-file size, total extracted size, and compression ratio caps | `safe_extract_zip` | `T-SEC-02`, `test_zip_entry_count_limit` |
| Oversized upload | Body size checked before the archive is opened | `api/repositories.create_repository` | `T-SEC-02` |
| Malformed or encrypted archive | Clear `invalid_archive` error; encrypted entries rejected | `safe_extract_zip` | `test_non_zip_payload_is_rejected` |
| Arbitrary code execution | Python files are parsed with `ast`; nothing is imported or executed, no install scripts run | `analyzers/common.parse_python` | suite-wide (no subprocess in the image) |
| Secret exfiltration through model context | `.env`, key files, and credential files are excluded from the index and never read for values | `is_secret_path`, `build_index` | `T-SEC-07`, `test_secret_files_are_excluded_from_index_and_search` |
| Secret leakage in output | Assignments to secret-shaped names and key material are redacted from every excerpt | `security.redact`, `contains_secret` | `T-12`, `T-SEC-06` |
| Prompt injection from repository text | Repository content is never treated as instructions; outputs are schema-constrained; citation and path allowlists are enforced by the backend | `question_service._verify_citations`, `patch_service` | `T-SEC-03` |
| Model-controlled writes | Patch targets are restricted to the Markdown allowlist, drafts live in a separate directory, and no commit or push path exists | `patch_service.is_allowed_target` | `T-SEC-04` |
| Path disclosure | Only sanitized repo-relative paths leave the backend | `EvidenceRef`, `sanitize_rel_path` | `T-SEC-01` |
| Server-side request forgery | No outbound fetch in v1.0; GitHub import is deferred | n/a | not applicable yet |
| Log leakage | Logs carry a request ID, route, duration, and outcome; file bodies and secrets are never logged | `main.py` middleware, `core/errors` | `T-SEC-06` |
| Unbounded resource use | Bounded audit time, bounded excerpts, capped findings per check, capped search results, workspace TTL | `settings`, analyzers, `question_service` | `NFR-01`..`NFR-04` |
| Workspace retention | Workspaces are deleted on request, on TTL expiry, and by an orphan sweep | `services/store` | `T-23`, `test_workspace_is_deleted_on_request` |
| Cross-session data access | A workspace is only visible to the session that created it | `Store.get(..., session_id)` | `test_repository_is_scoped_to_session` |
| Rate abuse | Per-session request cap with `Retry-After` | `main.py` middleware | manual |

## Residual risks

| Risk | Why it remains | Mitigation |
|---|---|---|
| A secret inside a non-standard file name or a prose sentence | Pattern matching cannot identify every secret | Only bounded excerpts are sent, and redaction runs on all outgoing text |
| False negatives from incomplete static parsing | Dynamic route registration, `__getattr__`, and generated code are invisible to `ast` | Findings default to `insufficient_evidence` with an explicit caveat |
| Denial of service through many small requests | The in-process limiter is per instance | Documented; a reverse-proxy limit is required for public deployment |
| Supply chain | Third-party packages are pinned in lockfiles | Dependency audit belongs in CI |

## Out of scope for v1.0

Multi-tenant authentication and authorisation, billing, audit trails with retention guarantees, and outbound
network fetching. Adding any of these requires new controls and a threat-model update in the same change.