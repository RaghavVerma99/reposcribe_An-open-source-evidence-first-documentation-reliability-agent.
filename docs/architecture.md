# Architecture

## Request path

```mermaid
sequenceDiagram
    participant UI as React UI
    participant API as FastAPI /api/v1
    participant Repo as Repository service
    participant Engine as Deterministic engine
    participant Model as Provider interface
    UI->>API: POST /repositories (sample id or ZIP)
    API->>Repo: extract into isolated workspace
    Repo->>Repo: build manifest + parse index (no execution)
    Repo-->>UI: repository id, file and doc counts
    UI->>API: POST /audits
    API->>Engine: run selected analyzers over the index
    Engine-->>API: findings with evidence, status, limitations
    API-->>UI: audit run + summary
    UI->>API: POST /findings/{id}/patches
    API->>Model: draft_patch(finding, evidence, document)
    Model-->>API: proposed content + rationale
    API->>API: build diff, enforce target and size limits
    UI->>API: POST /patches/{id}/validate
    API->>Engine: rerun every check on the original and proposed documents
    Engine-->>API: six validation step outcomes
    API-->>UI: validation result (passed / failed / inconclusive)
```

## Layers

| Layer | Location | Responsibility |
|---|---|---|
| HTTP | `backend/app/api/` | Routing, session cookie, request IDs, error envelopes. No business logic. |
| Schemas | `backend/app/schemas/models.py` | The public contract. Mirrored by `frontend/src/lib/types.ts`. |
| Core | `backend/app/core/` | Typed settings, error taxonomy, ZIP and path safety, redaction. |
| Analyzers | `backend/app/analyzers/` | Pure functions over a parsed index. No I/O beyond reading files. |
| Services | `backend/app/services/` | Intake, indexing, audit orchestration, Q&A retrieval, patch lifecycle, export. |
| Integrations | `backend/app/integrations/` | Provider protocol, local demo provider, Alan adapter. |
| UI | `frontend/src/` | Screens per feature, one HTTP module, per-operation async state. |

## Architectural rules

| ID | Rule | Where it is enforced |
|---|---|---|
| AR-01 | The model never invents repository facts | Evidence bundles are built by `evidence_service` / analyzers before any provider call |
| AR-02 | Every model output is schema-checked and re-verified | `question_service._verify_citations`, `patch_service.validate` |
| AR-03 | Analyzers never depend on the provider layer | Analyzer modules import nothing from `integrations/` |
| AR-04 | The extracted repository is read-only | Patches are written to `patch/`, never to `repo/` |
| AR-05 | Analyzers are independently runnable and testable | `analyze(index) -> AnalyzerResult`, one test file per concern |
| AR-06 | One process, no queue, no worker tier | Everything runs inside the FastAPI app |

## Index and data flow

`build_index(root)` walks non-excluded files once and produces a `RepoIndex`:

- `docs`: parsed Markdown with headings, links, code spans, tables, and documented routes.
- `py_files`: `ast`-parsed modules with symbols, decorator routes (prefix-resolved), and environment references.
- `env_example_keys`: the canonical variable list from `.env.example`.
- `skipped`: files that could not be read or parsed, surfaced as limitations.

Nothing executes repository code. A file that fails to parse becomes a skip with a reason, never a failed audit.

## Route prefix resolution

A route's real path is the router prefix plus the path in the decorator, and the prefix can live in a
different file than the decorator:

```text
app/main.py     app.include_router(router, prefix="/api")   <- mount prefix
app/routes.py   router = APIRouter(prefix="/v1")             <- declaration prefix
                @router.get("/users")                        <- declared path
```

The index is built in two steps. `parse_python` resolves the prefixes it can see in one module: literal
`APIRouter(prefix=...)` declarations, literal `include_router(prefix=...)` mounts, and nested routers. It
records the routers that are mounted from another module as `RouterInclude` entries together with the
imports that identify them. `build_index` then applies those mount prefixes to the routes of the target
module, so the route above is compared as `/api/v1/users`.

If a mounted router cannot be located in the repository, or its mount prefix is not a literal, the effective
prefix is unknown. Those routes are dropped and the repository is marked as having an unresolved prefix, so
route findings become `insufficient_evidence` instead of a false "missing route".

Validation reuses the same machinery with a document override: `RepoIndex.with_doc_override(path, text)` returns
a new index whose doc-derived structures are rebuilt from the proposed content. Step V-3 runs every analyzer on
both the original and the proposed index and compares findings by `subject_key`, so it fails when the originating
finding still reproduces **and** when the patch introduces a finding elsewhere. Step V-4 fails only on broken
links that the patch itself adds or changes; links that were already broken are reported but not counted.

## State and lifecycle

| Concern | Implementation |
|---|---|
| Session | Anonymous `HttpOnly` cookie minted on first response; the value is `<id>.<hmac>` signed with `SESSION_SECRET` (or a per-process secret) so a client cannot choose an id; workspaces are scoped to it |
| Rate limit | Keyed on the client address, not the cookie: a client can mint sessions at will. Idle buckets are swept so the map cannot grow without bound |
| Request bodies | Non-multipart bodies are rejected above `MAX_REQUEST_BODY_MB` before routing; uploads stream through their own byte counter |
| Audit budget | `AUDIT_TIMEOUT_SECONDS` wall clock; unfinished checks are reported as skipped and cannot mark anything resolved |
| Finding bounds | Each check is capped (100 findings, 25 for configuration) and states the cap in limitations |
| Workspace | `WORKSPACE_ROOT/{repo_id}/repo` (immutable) and `/patch` (drafts, exports) |
| Cleanup | Deleted on `DELETE /repositories/{id}`, on TTL expiry, and by a sweep on access |
| Audit history | SQLite snapshots per run; restored on restart when the database path is on a persistent volume |
| Finding identity | `sha256(check_id, primary_path, subject_key)[:12]`, excluding line numbers |

## Extension points

- **New check:** implement an analyzer, register it, update `SPEC.md` §8 and §29.
- **New language:** add a parser next to `parse_python` that populates the same symbol/route structures.
- **New provider:** implement the `ModelProvider` protocol and extend the factory in
  `integrations/model_provider.py`.