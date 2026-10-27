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
| Unbounded resource use | Bounded excerpts, capped findings per check, capped search results, workspace TTL, per-client request cap, JSON body cap, audit time budget | `settings`, analyzers, `question_service`, `main.py` | `test_broken_links_are_capped_and_reported`, `test_oversized_json_body_is_rejected` |
| Session fixation (a client choosing a session id it likes) | The session cookie is signed with an HMAC; a forged value is ignored and a fresh session is issued | `core/security.sign_session`, `main.py` middleware | `test_tampered_cookie_does_not_grant_access` |
| Workspace retention | Workspaces are deleted on request and on TTL expiry; expiry is evaluated when a repository is accessed | `services/store` | `T-23`, `test_workspace_is_deleted_on_request` |
| Cross-session data access | A workspace is only visible to the session that created it | `Store.get(..., session_id)` | `test_repository_is_scoped_to_session` |
| Slow-acting abuse (an audit that never finishes) | Every audit runs against a wall-clock budget; checks that do not finish are reported as skipped and never mark findings resolved | `services/audit_service`, `AUDIT_TIMEOUT_SECONDS` | `test_time_budget_never_resolves_previous_findings` |
| Rate abuse | Per-client-address request cap with `Retry-After`. The key is the network peer, not the session cookie, because a client can mint sessions at will | `main.py` middleware | `test_rate_limit_survives_cookie_rotation` |

## Residual risks

| Risk | Why it remains | Mitigation |
|---|---|---|
| A secret inside a non-standard file name or a prose sentence | Pattern matching cannot identify every secret | Only bounded excerpts are sent, and redaction runs on all outgoing text |
| False negatives from incomplete static parsing | Dynamic route registration, `__getattr__`, and generated code are invisible to `ast` | Findings default to `insufficient_evidence` with an explicit caveat |
| Denial of service through many small requests | The in-process limiter is per instance and per client address. Behind a reverse proxy the peer address is the proxy's, so every user shares one budget | Documented; a reverse-proxy limit is required for public deployment |
| Multi-worker deployments | The session-signing secret is generated per process unless `SESSION_SECRET` is set; cookies issued by one worker are rejected by another | Set a shared `SESSION_SECRET` when running more than one worker |
| Chunked request bodies without Content-Length | The JSON body cap is enforced on the declared length; a chunked body is only bounded by `AUDIT_TIMEOUT_SECONDS` and per-field schema caps | Send `Content-Length`; a reverse proxy should reject chunked uploads |
| Supply chain | The frontend is pinned by `package-lock.json`; the backend declares lower bounds only and has no lockfile yet | A backend lockfile and a dependency audit belong in CI |

## Out of scope for v1.0

Multi-tenant authentication and authorisation, billing, audit trails with retention guarantees, and outbound
network fetching. Adding any of these requires new controls and a threat-model update in the same change.