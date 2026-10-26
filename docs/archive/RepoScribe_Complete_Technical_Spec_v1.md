# RepoScribe --- Complete Product & Technical Implementation Specification

## Claude Code / Claude Implementation Brief

**Document type:** Product requirements + technical architecture +
implementation plan\
**Project:** RepoScribe\
**Tagline:** Documentation that doesn't lie.\
**Version:** 1.0\
**Primary goal:** Build a polished, open-source, evidence-first
documentation reliability agent using Alan AI and an eligible open
model, suitable for a solo hackathon submission and continued
development afterward.

------------------------------------------------------------------------

# 0. Instructions to the Implementing Agent

You are the senior product engineer responsible for turning this
specification into a real, working application.

Do not merely generate a mockup, a static dashboard, or a generic
chatbot. Build a functional end-to-end product with real repository
analysis, reproducible checks, evidence-backed findings, patch previews,
and tests.

## Non-negotiable implementation rules

1.  **Inspect before implementing.** If a repository already exists,
    inspect its files, package configuration, scripts, and current state
    before changing anything. Preserve useful existing work.
2.  **Deliver a working vertical slice first.** The first end-to-end
    workflow must ingest a small repository, detect a known
    documentation defect, show evidence, generate a patch, validate it,
    and render a diff.
3.  **Do not fake integrations.** Do not create buttons that pretend to
    connect to GitHub or Alan AI. If credentials or platform access are
    unavailable, provide an explicit, clearly labeled local/demo mode
    and document exactly what is mocked.
4.  **Verify Alan AI's current integration.** The hackathon may specify
    a particular Alan product, workflow model, SDK, or account
    capability. Read the official event instructions and current
    official Alan documentation before choosing an SDK. Do not assume
    the legacy voice SDK is the correct product.
5.  **Respect the open-model requirement.** Confirm the event's
    definition of an eligible open model and its license. Make the model
    provider configurable. Do not silently substitute a proprietary
    model if the rules require an open model.
6.  **Never fabricate evidence.** File paths, line numbers, symbol
    names, route names, and validation results must originate from
    repository inspection or actual tool output.
7.  **Keep the product honest.** Distinguish a mechanically verified
    contradiction from a model-generated suspicion. Do not label a
    semantic guess as proven.
8.  **Protect the user's repository.** The default workflow is
    read-only. Generate a patch preview; never overwrite, commit, push,
    or open a pull request without explicit user approval.
9.  **Make it beautiful and usable.** The interface must feel like a
    carefully designed developer tool, not a generic AI chat template.
10. **Run tests and report what actually passed.** Never claim that a
    command or test succeeded unless it was executed and its result was
    observed.
11. **Build incrementally.** Do not over-engineer with microservices,
    multiple agents, a vector database, or complex infrastructure before
    the core workflow works.
12. **If a requirement is ambiguous, choose the smallest safe
    implementation and record the assumption in the README.** Ask the
    human only when a decision blocks implementation.

## Definition of success

A new user can open the app, select a bundled sample repository or
upload a supported ZIP, run an audit, inspect a finding with source
evidence, generate a Markdown repair, see the before/after diff,
validate the proposed patch, and export the patch---all without needing
a GitHub token.

The Alan AI integration must be real in the final intended setup, use
the platform and model permitted by the hackathon, and be explained
clearly in the architecture and README. A local demo mode is acceptable
during development but must never be misrepresented as a live Alan
integration.

------------------------------------------------------------------------

# 1. Executive Summary

RepoScribe is an open-source documentation reliability tool for software
repositories. It identifies likely gaps and contradictions between a
codebase and its technical documentation, explains findings using source
evidence, and proposes minimal documentation changes that developers can
review before applying.

RepoScribe is **not simply a repository chatbot or an AI README
generator**. Its central value is a verifiable workflow:

**Inspect repository → extract facts → identify documentation claims →
detect discrepancies → produce evidence-backed findings → draft a
minimal patch → validate → request human approval.**

The initial version should focus on Python repositories, especially
FastAPI projects, because routes, Pydantic models, environment
variables, and setup instructions offer tractable checks and a
compelling live demo.

## One-sentence product statement

> RepoScribe is an evidence-first documentation reliability agent that
> detects documentation drift between software source code and technical
> docs, traces findings to real source locations, and proposes
> validated, reviewable Markdown repairs.

## Short pitch

Software changes faster than its documentation. RepoScribe scans a
repository, detects concrete documentation mismatches, explains why they
matter with source evidence, and prepares a patch developers can verify
before accepting.

## Core product promise

Every important finding should answer: - What does the documentation
claim? - What does the inspected repository actually contain? - What
evidence supports the comparison? - How certain is the finding, and what
limitations remain? - What minimal correction is proposed? - Which
validation checks passed or failed?

------------------------------------------------------------------------

# 2. The Problem

## 2.1 The user problem

Documentation becomes stale as teams rename routes, change
configuration, alter function signatures, reorganize files, or change
setup procedures. These changes often happen in pull requests where the
developer focuses on application behavior and forgets related docs.

Consequences include: - New contributors following broken setup
instructions. - API consumers using obsolete endpoints or request
fields. - Developers wasting time searching for symbols or configuration
that no longer exists. - Support and onboarding costs caused by
contradictory instructions. - AI coding assistants using stale docs as
context and producing further mistakes. - Reviewers struggling to tell
whether a documentation change is grounded in actual code.

Traditional documentation generators tend to generate text from code,
while generic repository chatbots answer questions. RepoScribe focuses
on a more precise task: **detecting and explaining potential
inconsistencies between existing docs and repository facts, then
producing a reviewable correction.**

## 2.2 Initial target users

Primary: - Solo developers and maintainers of small-to-medium
open-source repositories. - Backend developers maintaining API
documentation and setup guides. - Small engineering teams using AI
coding assistants. - Contributors onboarding to unfamiliar
Python/FastAPI projects.

Secondary, later: - Engineering teams that want documentation checks in
CI. - Developer-platform teams managing internal API docs. - Open-source
maintainers who want lightweight docs-quality automation.

## 2.3 Jobs to be done

1.  "Tell me which instructions in this README no longer match the
    code."
2.  "Show me where this API endpoint is actually defined."
3.  "Find environment variables mentioned in docs that are not present
    in the current configuration."
4.  "Generate an accurate setup guide from this repository."
5.  "Show me a safe patch and the evidence behind each proposed change."
6.  "Tell me which findings are verified and which need a human to
    investigate."

## 2.4 What RepoScribe should excel at

-   High-confidence checks with clear evidence.
-   Fast onboarding to a repository.
-   Precise file and line citations.
-   Small, reviewable documentation diffs.
-   Clear separation between verified findings and model suggestions.
-   Transparent uncertainty and limitations.
-   Excellent developer experience and an impressive live demo.
-   Being easy to run locally and contribute to as an open-source
    project.

------------------------------------------------------------------------

# 3. What RepoScribe Does and Does Not Do

## 3.1 MVP: must do

1.  Accept a bundled sample repository and a user-uploaded ZIP of a
    supported repository.
2.  Safely extract and inspect repository files.
3.  Detect a defined set of documentation drift cases in Python
    projects.
4.  Index file paths, line numbers, selected symbols, API routes,
    configuration keys, and documentation references.
5.  Display findings with severity, status, explanation, and source
    evidence.
6.  Let users ask questions about the inspected repository, grounded in
    retrieved evidence.
7.  Generate a minimal Markdown patch for a selected finding.
8.  Display a before/after diff.
9.  Validate basic patch properties and re-run relevant deterministic
    checks.
10. Export the patch or revised Markdown without silently modifying the
    original repository.
11. Offer an honest local demo mode for development and tests.
12. Integrate Alan AI through the current supported workflow or API
    specified by the hackathon, and use an eligible open model.
13. Include a polished, responsive UI, useful loading/error/empty
    states, tests, and complete setup instructions.

## 3.2 MVP checks to implement first

Prioritize checks that are deterministic and easy to prove:

-   Internal Markdown links that point to missing local files or
    headings.
-   README/setup instructions referencing files that do not exist.
-   Documented FastAPI paths and HTTP methods that conflict with
    statically discoverable route definitions.
-   Environment variable names documented in setup/config docs that do
    not appear in recognized config or source files, with clear caveats.
-   Public Python function/class references that cannot be found by the
    supported static indexer.
-   Missing README sections or setup information based on a small,
    explicit checklist.

For the hackathon demo, ensure at least one check is genuinely
implemented end to end. Do not make every check a hard-coded scenario.

## 3.3 Should do after MVP

-   Analyze Git diffs to limit scans to changed files and impacted docs.
-   Generate a documentation coverage map.
-   Support OpenAPI schema comparison.
-   Add GitHub repository import and pull-request workflows.
-   Run documentation checks in CI.
-   Add more languages through Tree-sitter or language-specific parsers.
-   Support incremental indexing and persistent audit history.
-   Add an optional semantic retrieval index if evaluation proves it
    improves results.
-   Add configurable policy rules for different repositories.

## 3.4 Explicit non-goals for the hackathon

Do not attempt to build all of the following in the first version: - A
universal code correctness verifier. - A security scanner that claims to
find all vulnerabilities. - A general-purpose autonomous coding agent. -
An agent that rewrites application code. - An agent that commits or
pushes changes automatically. - Full multi-language semantic analysis. -
A large multi-agent system. - A vector database requirement for every
installation. - A full enterprise RBAC, billing, team management, or
analytics platform. - Automatic PR creation as a dependency for the main
demo. - A guarantee that all semantic documentation claims can be
verified mechanically.

## 3.5 Product truthfulness

A route missing from a static scan does not always prove it is absent:
routes can be dynamically registered, imported indirectly, or generated
at runtime. A missing string match is not automatically a defect.

Every check must explain its supported scope and limitations. Findings
should be classified as: - `verified`: supported by deterministic
evidence within the check's stated scope. - `needs_review`: plausible
mismatch requiring semantic or human confirmation. -
`insufficient_evidence`: the tool cannot safely establish a
conclusion. - `resolved`: the issue no longer reproduces after a patch
or rescan. - `dismissed`: a user explicitly dismisses a finding.

Never claim a check is universally correct when it only supports a
subset of framework patterns.

------------------------------------------------------------------------

# 4. Product Principles

1.  **Evidence before prose.** Retrieve source facts before asking the
    model to explain them.
2.  **Deterministic checks before LLM judgment.** Use ordinary code for
    exact links, file existence, route tables, and known config
    references.
3.  **Small patches.** Change only the relevant documentation and avoid
    broad rewrites.
4.  **Human approval by default.** All writes are previews until
    explicitly approved.
5.  **Visible provenance.** Users can inspect the files and lines behind
    a finding.
6.  **Honest uncertainty.** Use confidence/status labels with clear
    meanings, not fake precision.
7.  **Useful even without an LLM.** Core deterministic audits should run
    without a model provider.
8.  **Model-agnostic architecture.** Keep provider-specific code behind
    a small interface.
9.  **Privacy by design.** Process local repositories locally where
    feasible; do not upload code to a model provider without clear
    disclosure and user configuration.
10. **Graceful degradation.** If the model is unavailable, deterministic
    checks and their results should remain usable.

------------------------------------------------------------------------

# 5. Main User Experience

## 5.1 Primary user journey

1.  User opens RepoScribe.
2.  Landing page explains the product in one sentence and offers:
    -   `Try sample repository`
    -   `Upload repository ZIP`
    -   `Connect GitHub` only if implemented and configured.
3.  User selects a repository.
4.  RepoScribe scans the files and displays indexing progress.
5.  Repository overview shows detected languages, file count,
    documentation files, API routes (where supported), and scan status.
6.  User runs an audit.
7.  Findings appear in a filterable list.
8.  User selects a finding and sees:
    -   concise title,
    -   explanation,
    -   status and severity,
    -   documentation evidence,
    -   source-code evidence,
    -   limitations,
    -   proposed fix.
9.  User clicks `Generate fix`.
10. The model proposes a minimal Markdown change using the retrieved
    evidence.
11. RepoScribe renders a line-based diff.
12. User clicks `Validate patch`.
13. Deterministic checks are re-run against the proposed result.
14. User can export a patch or download the updated Markdown.
15. The app records the audit result for the current session.

## 5.2 Main screens

### A. Landing page

Purpose: communicate the value immediately and get the user into a real
workflow.

Required: - Clear headline: "Documentation that doesn't lie." -
Supporting statement: "Find documentation drift. See the evidence.
Review a safe fix." - Primary CTA: `Try sample repository`. - Secondary
CTA: `Upload repository`. - A small real product preview showing one
finding and a diff. - Three benefits: detect drift, trace evidence,
propose verified fixes. - Clear note that the current MVP supports a
limited set of checks and languages. - Avoid oversized marketing
gradients, fake customer logos, fake metrics, or fake testimonials.

### B. Repository overview

Required: - Repository name and source type. - Scan/index status. -
Counts: files inspected, docs found, findings by status. - Recent audit
summary. - Main actions: `Run audit`, `Ask about codebase`,
`View findings`. - Clear empty state if no audit exists. - No fabricated
"health score." If a score is used later, define its formula and label
it as a heuristic.

### C. Findings / audit results

Required: - Search and filters for status, severity, and check type. -
Each finding card includes title, short explanation, file path, status,
and type. - Use severity carefully: `high`, `medium`, `low`, `info`;
severity means likely impact, not confidence. - Confidence/status must
be separate from severity. - Clicking a finding opens its details.

### D. Finding detail / evidence inspector

Required: - What the docs claim. - What the code contains. -
Side-by-side evidence snippets with file path and line ranges. - A clear
explanation of why the check flagged it. - Verification status and scope
limitations. - `Generate fix` button. - A visible statement if evidence
is incomplete.

### E. Patch review

Required: - Before/after or unified diff. - Files changed and number of
changed lines. - Validation checklist with actual pass/fail/unknown
states. - `Download patch` and `Download updated file`. - `Apply patch`
only if safely implemented and clearly confirmed by the user; otherwise
omit it. - Do not display a green "verified" status until actual
validation completes.

### F. Ask RepoScribe

Required: - Chat-style interface with example prompts. - Answers with
clickable source citations. - Retrieved evidence displayed in a side
panel or expandable citation view. - If no evidence supports an answer,
say so. - The chat must be connected to the selected repository, not a
generic chatbot. - Do not expose hidden prompts, secrets, or internal
environment values.

### G. Settings / model status

Required: - Current operating mode: live Alan integration or local/demo
mode. - Provider/model label when known. - Clear connection/error
state. - Never expose API keys in the UI or logs. - If the live Alan
integration is not configured, state that plainly.

------------------------------------------------------------------------

# 6. UI / Visual Design Direction

The UI is a core part of the submission. Make it look like a
professional developer tool: dense enough for technical work, calm,
legible, and visually distinctive.

## 6.1 Visual style

Desired direction: - Modern developer-product interface, not a generic
chatbot landing page. - Light neutral canvas or restrained dark
workspace; choose one coherent theme rather than mixing unrelated
styles. - Dark navy/charcoal text, restrained indigo/blue accent, muted
slate borders, and status colors used semantically. - Strong typography
hierarchy, consistent spacing, crisp borders, subtle shadows only where
useful. - Monospace typography for code, paths, line numbers, diffs, and
identifiers. - Use icons consistently and sparingly. - Responsive
layout: desktop-first for code review, still usable on tablets and
phones. - Subtle transitions only when they communicate state; no
distracting animations.

## 6.2 Layout recommendation

Desktop: - Left sidebar: RepoScribe logo, selected repository, Overview,
Audit findings, Ask, Settings. - Top bar: current repository, scan
status, `Run audit` primary action. - Main content: repository overview
or findings. - Right inspector panel: evidence, source context, or
selected finding. - Diff viewer should use a large central area and
readable line numbers.

Mobile: - Collapsible navigation. - Findings become stacked cards. -
Evidence panels open in a drawer or separate detail view. - Diff view
may scroll horizontally but must keep file identity visible.

## 6.3 UI quality requirements

-   Every interactive control must do something real.
-   Buttons need disabled/loading states.
-   Errors need actionable messages and retry options.
-   Long scans need progress indicators and cancellation where feasible.
-   Empty states should explain the next action.
-   Use skeletons only when content is genuinely loading.
-   Use toasts for transient confirmations, not as the only place
    important errors appear.
-   Keyboard focus must be visible.
-   Support keyboard navigation for dialogs and major controls.
-   Use accessible contrast and semantic labels.
-   Avoid using color as the only way to communicate status.
-   Do not use placeholder chart data in a live repository view.
-   No dead navigation links, fake toggles, or buttons that only
    animate.

## 6.4 UI copy examples

Headline: \> Documentation that doesn't lie.

Subheadline: \> Detect drift between code and docs. Inspect the
evidence. Review a minimal repair.

Empty audit state: \> No audit has run for this repository yet. Run an
audit to check links, routes, configuration references, and supported
documentation rules.

No evidence state: \> RepoScribe couldn't establish this claim from the
inspected files. This finding needs human review; no automatic repair is
recommended.

Model unavailable: \> The AI provider is unavailable. Deterministic
checks still work; retry the AI-assisted explanation when the provider
is back.

Patch validation: \> Validation checks the proposed documentation
against the currently indexed repository. It does not guarantee that
every semantic claim is correct.

------------------------------------------------------------------------

# 7. Recommended Technology Stack

Prefer technologies that make the MVP reliable and fast to ship. If an
existing repository already uses a sensible stack, preserve it unless
there is a compelling reason to change.

## Frontend

-   React
-   TypeScript
-   Vite
-   Tailwind CSS
-   A consistent component library such as shadcn/ui, if compatible with
    the existing setup
-   Monaco Editor or a lightweight diff component only if it can be
    integrated without destabilizing the MVP
-   React Router if multiple pages are needed
-   A small API client module with typed responses

## Backend

-   Python 3.11+ (or the version supported by deployment)
-   FastAPI
-   Pydantic for request and response schemas
-   Uvicorn
-   Pytest
-   `pathlib`, `zipfile`, and other standard-library utilities for basic
    repository handling
-   Tree-sitter only if needed for language parsing; start with Python
    AST and targeted parsers for the MVP

## Repository and retrieval

-   Read-only repository workspace.
-   Python AST for Python symbols and statically discoverable
    route/config patterns.
-   Markdown parser or carefully tested Markdown link extraction for
    local links and headings.
-   Exact text and symbol search first.
-   SQLite FTS5 or BM25 may be added if the index becomes too large for
    simple search.
-   Embeddings/vector database are optional, not mandatory for the first
    version.

## AI / Alan integration

-   Use the exact Alan AI platform, SDK, workflow, or API required by
    the hackathon.
-   Verify official current documentation and account access before
    implementing.
-   Use an open model explicitly permitted by the event.
-   Keep model invocation behind an interface such as `ModelProvider`.
-   Keep the deterministic analyzer independent of the model.
-   Add timeouts, structured outputs, input size limits, and error
    handling.
-   If the platform supports tool/workflow invocation, define narrow
    tools for repository facts, audit execution, evidence retrieval,
    draft generation, and validation.
-   Do not assume a generic OpenAI-compatible endpoint is automatically
    supported by Alan. Verify the integration route.

## Deployment

-   Frontend: a static hosting platform compatible with Vite.
-   Backend: a Python-compatible host, or one combined deployment if
    that reduces risk.
-   Use environment variables for configuration.
-   Include `.env.example`, never commit `.env`.
-   Include a Dockerfile only if it helps local reproducibility and does
    not consume disproportionate time.

------------------------------------------------------------------------

# 8. Architecture and Responsibilities

## 8.1 High-level architecture

``` text
React + TypeScript UI
        |
        | HTTPS / JSON
        v
FastAPI application
        |
        +--> Repository intake and safe workspace
        |
        +--> Deterministic analysis engine
        |       +--> File inventory
        |       +--> Markdown link checker
        |       +--> Python symbol index
        |       +--> FastAPI route index
        |       +--> Config reference checker
        |
        +--> Evidence store / index
        |
        +--> Alan AI integration adapter
        |       +--> Supported workflow / agent calls
        |       +--> Approved open-model provider
        |
        +--> Documentation draft generator
        |
        +--> Patch builder and validator
        |
        +--> Audit history / session state
```

## 8.2 Architectural rule

The model must not independently invent repository facts. The backend
gathers trusted facts and passes a limited evidence bundle to the model.
The model may explain and draft, but the backend checks output shape,
validates file targets, and runs deterministic checks.

## 8.3 Suggested backend modules

-   `api/`: HTTP routes and dependency wiring.
-   `schemas/`: Pydantic request/response types.
-   `services/repository_service.py`: intake, extraction, path safety,
    file inventory.
-   `analyzers/markdown_links.py`: internal link and heading checks.
-   `analyzers/python_symbols.py`: AST-based symbol inventory.
-   `analyzers/fastapi_routes.py`: supported static route extraction.
-   `analyzers/config_references.py`: environment/config reference
    checks.
-   `services/evidence_service.py`: evidence snippets and line ranges.
-   `services/audit_service.py`: run checks and normalize findings.
-   `services/model_provider.py`: interface for model operations.
-   `integrations/alan.py`: current Alan integration adapter.
-   `services/question_service.py`: grounded repository Q&A.
-   `services/patch_service.py`: diff generation and patch validation.
-   `services/export_service.py`: safe export of Markdown or patch
    files.
-   `core/settings.py`: configuration and secrets.
-   `core/security.py`: upload and workspace validation.
-   `tests/`: unit, integration, and API tests.

Keep this modularity lightweight. Do not create a class or module for
every trivial function.

------------------------------------------------------------------------

# 9. Repository Intake and File Safety

Repository ingestion is security-sensitive. A ZIP file is untrusted
input.

## 9.1 Supported input for MVP

Required: - Bundled sample repository included with the project. - ZIP
upload containing a project directory.

Optional stretch: - Public GitHub repository URL import. - GitHub App /
OAuth integration.

Do not require a GitHub token for the core demo.

## 9.2 File handling requirements

-   Enforce upload size limit, e.g. 20 MB by default, configurable.
-   Enforce maximum extracted file count and maximum per-file size.
-   Prevent ZIP path traversal (`../`, absolute paths, drive prefixes).
-   Reject symlinks or handle them safely.
-   Ignore `.git`, `node_modules`, `.venv`, `venv`, `dist`, `build`,
    caches, binaries, and generated files by default.
-   Never execute repository code during analysis.
-   Do not run arbitrary install scripts.
-   Do not read or send secret files such as `.env`, private keys,
    credential files, or files matching configurable secret patterns to
    the model.
-   Detect likely secrets and exclude them from model context; do not
    log their contents.
-   Normalize paths and ensure every resolved path remains inside the
    assigned workspace.
-   Do not allow a user-controlled path to read arbitrary files from the
    server.
-   Clean up temporary workspaces according to a documented policy.
-   Return actionable errors for malformed or unsupported archives.

## 9.3 Repository manifest

Create a manifest containing: - Relative path. - File size. - Detected
file type/language. - Whether it is a documentation file. - Whether it
was excluded and why. - Content hash for incremental re-indexing if
implemented.

Do not store full source contents in logs.

------------------------------------------------------------------------

# 10. Deterministic Analysis Engine

The analysis engine is the core of RepoScribe. It should work without an
LLM.

## 10.1 File inventory

Find likely documentation files: - `README.md` - `CONTRIBUTING.md` -
`docs/**/*.md` - `*.md` - OpenAPI specs such as `openapi.yaml` or
`openapi.json` - Config examples such as `.env.example`, excluding
secret-bearing files

Find likely source/config files: - Python `.py` - `pyproject.toml` -
`requirements.txt` - `setup.cfg` - `Dockerfile` - `docker-compose.yml` /
`compose.yaml` - recognized config files

Avoid scanning all file types indiscriminately.

## 10.2 Markdown internal links

Implement: - Extract local links and anchor links. - Resolve relative
paths from the Markdown file's directory. - Check whether referenced
files exist. - For anchors, parse the target Markdown headings and
normalize heading IDs. - Ignore external URL checks in the MVP unless
explicitly implemented. - Report line numbers for the link where
possible. - Avoid false positives for image references, code examples,
or intentionally external references.

Finding example: - Check ID: `markdown.internal_link_exists` - Status:
`verified` if the referenced local file/anchor is absent within the
supported parser rules. - Evidence: Markdown line containing the link
and the resolved missing target.

## 10.3 Python symbol index

Use `ast` to collect: - Module paths. - Top-level functions and
classes. - Public functions and classes. - Function parameters and
selected annotations. - Imports where statically discoverable. - Source
line ranges.

Never execute the Python file to inspect it.

## 10.4 FastAPI route extraction

Support common static forms first, such as: - `@app.get("/path")` -
`@app.post("/path")` - `@router.get("/path")` -
`@router.api_route("/path", methods=[...])` where statically parseable

Record: - HTTP method. - Route path. - Function name. - Source file and
line range. - Static parsing limitations.

Do not assume all routes are discoverable. Routers may be included with
prefixes, mounted dynamically, or registered through variables. Add
prefix resolution only if it can be done reliably. Mark unsupported
dynamic patterns as unknown rather than absent.

## 10.5 Documentation route comparison

Extract route/method pairs from documentation using: - Markdown tables
with recognized headers (`Method`, `HTTP Method`, `Endpoint`, `Path`,
`Route`). - Explicit code blocks or links only when their format is
recognized. - OpenAPI spec, if available.

Compare documented route/method pairs with statically extracted routes.

Possible findings: - Documented route absent from discovered routes. -
Route exists in code but is not mentioned in the relevant API docs (only
if the docs are clearly intended as a complete API list). - HTTP method
mismatch. - Documentation route could not be parsed.

Do not claim a route is nonexistent if the repository uses unsupported
dynamic route registration. Include a caveat in the finding.

## 10.6 Configuration reference checks

Identify environment variable references in supported forms,
e.g. `os.getenv("KEY")`, `os.environ["KEY"]`, and documented `KEY=value`
or inline `KEY` mentions.

Compare against recognized sources: - `.env.example` - configuration
schemas - explicit settings definitions - supported Python source
patterns

Important: - `.env` should be excluded from model context and should not
be required. - A documented variable missing from `.env.example` is not
necessarily invalid if it is injected by deployment. - Use
`needs_review` unless the repository clearly defines a canonical
configuration list. - Never expose secret values in findings.

## 10.7 Missing documentation checklist

Use a small configurable checklist, not a fake universal score: - README
exists. - Installation/setup instructions exist. - A test command is
documented. - Environment/configuration setup is documented where
relevant. - Public API docs exist if a supported API framework is
detected. - License file exists (report presence only; do not give legal
advice).

A missing checklist item is a suggestion, not necessarily a defect. Mark
as `needs_review` or `info`.

------------------------------------------------------------------------

# 11. Finding Data Model

Every finding must be a structured object with stable identifiers.

Suggested Pydantic shape:

``` python
from typing import Literal
from pydantic import BaseModel, Field

FindingStatus = Literal[
    "verified",
    "needs_review",
    "insufficient_evidence",
    "resolved",
    "dismissed",
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

Requirements: - `confidence_note` is explanatory, not a fake numeric
probability. - Severity and verification status are separate concepts. -
Evidence excerpts must be derived from actual file contents. - Line
numbers are one-based. - Excerpts should be bounded in size. - Stable
IDs should be based on check ID, path, and relevant content/line
information, not random IDs on every run. - Sanitize paths before
returning them. - Do not include secret contents in evidence.

------------------------------------------------------------------------

# 12. AI Agent Design and Alan AI Integration

## 12.1 Responsibilities

Use Alan AI as the required agent/workflow layer according to the
current hackathon rules and supported platform.

Use the open model for tasks where language understanding is genuinely
useful: - Explain a deterministic finding in clear language. - Compare a
documentation claim against a small, trusted evidence bundle. - Suggest
a minimal documentation correction. - Answer repository questions based
on retrieved snippets. - Summarize audit results.

Use deterministic backend code for: - File discovery. - Path safety. -
Line number extraction. - Link validation. - Route extraction. - Exact
symbol checks. - Diff creation. - Patch target restrictions. -
Validation results.

## 12.2 Integration verification checklist

Before implementing the adapter: 1. Read the hackathon's official
current instructions. 2. Identify the exact Alan product/workflow/SDK
expected. 3. Confirm how to invoke workflows from the application. 4.
Confirm how model selection works and which open models are permitted.
5. Confirm whether tool/API invocation is supported and how credentials
are supplied. 6. Build a minimal proof of concept and test it before the
rest of the app. 7. Record the official docs and exact setup in the
README.

Do not assume the older Alan voice SDK, a new Alan agent platform, and a
generic model API are interchangeable.

## 12.3 Agent tools

Expose narrow tools with explicit schemas, for example: -
`get_repository_overview(repository_id)` -
`search_repository(repository_id, query, allowed_paths?)` -
`get_file_excerpt(repository_id, path, start_line, end_line)` -
`run_documentation_audit(repository_id, check_ids?)` -
`get_finding(repository_id, finding_id)` -
`draft_documentation_patch(repository_id, finding_id, target_path)` -
`validate_documentation_patch(repository_id, patch_id)`

Each tool must: - Validate input types and bounds. - Validate repository
ownership/session access. - Restrict paths to the repository
workspace. - Return structured JSON. - Apply timeouts and size limits. -
Avoid arbitrary shell execution. - Avoid writes unless a separate
approval flow is explicitly implemented.

## 12.4 Prompt injection defenses

Repository content is untrusted data. A README may contain text that
says "ignore previous instructions" or requests secrets.

Defenses: - Never treat source files or docs as system/developer
instructions. - Keep repository excerpts in clearly delimited untrusted
context. - Do not give the model unrestricted shell or filesystem
access. - Tools enforce permissions independently of model output. -
Exclude secrets and sensitive files from model context. - Restrict model
output to known schemas. - Validate proposed target paths against an
allowlist of documentation paths. - Require human approval before
applying changes.

## 12.5 Model interface

Define a small provider abstraction: -
`explain_finding(finding, evidence_bundle) -> explanation` -
`answer_repository_question(question, evidence_bundle) -> grounded_answer` -
`draft_markdown_patch(finding, evidence_bundle, current_document) -> patch_draft`

The Alan integration should invoke the correct supported workflow and
model. If the platform has its own workflow semantics, adapt to those
rather than forcing an unrelated abstraction.

## 12.6 Grounded Q&A output

Require a structured response: - `answer`: concise answer. -
`citations`: source path and line range from retrieved evidence. -
`limitations`: unsupported aspects or missing context. -
`follow_up_suggestions`: optional useful next queries.

Backend must check that each citation points to a retrieved evidence
item. The model cannot invent arbitrary citations.

------------------------------------------------------------------------

# 13. Patch Generation and Validation

## 13.1 Patch generation

Inputs: - A selected finding. - Current documentation contents. -
Relevant source evidence. - Allowed target path. - Explicit output
format.

Outputs: - Proposed new Markdown content or unified diff. - Short
rationale. - Evidence references. - Limitations. - Validation plan.

Requirements: - Modify documentation only in the MVP. - Prefer a minimal
patch over rewriting an entire document. - Never target a source code
file. - Reject absolute paths and path traversal. - Preserve line
endings where practical. - Do not overwrite the original repository on
generation. - Store patches in a separate temporary or session
workspace.

## 13.2 Validation pipeline

At minimum: 1. Confirm patch target is a permitted Markdown file. 2.
Confirm patch applies cleanly to the expected original content. 3.
Re-run relevant deterministic checks on the proposed document. 4. Verify
internal links and anchors in the proposed content. 5. Verify referenced
source files/symbols still exist within the current indexed snapshot. 6.
Display validation outcomes as `passed`, `failed`, `not_run`, or
`inconclusive`.

A patch passing these checks is not proof that every semantic sentence
is correct. State this in the UI.

## 13.3 Approval model

For MVP: - Generate patch. - Preview diff. - Validate. - Download patch
or revised file.

Do not add automatic commit/push in the first version. If later
implemented, require explicit confirmation and use the official GitHub
integration with narrowly scoped permissions.

------------------------------------------------------------------------

# 14. API Design

Use versioned, typed JSON APIs. Adapt names if the existing app has a
consistent convention.

## 14.1 Core endpoints

### `GET /api/health`

Returns application and dependency health without exposing secrets.

### `POST /api/repositories`

Creates a repository workspace from an uploaded ZIP or a bundled sample
identifier.

### `GET /api/repositories/{repository_id}`

Returns repository metadata and scan status.

### `POST /api/repositories/{repository_id}/index`

Runs or refreshes indexing.

### `GET /api/repositories/{repository_id}/overview`

Returns file counts, detected languages, docs files, indexed routes, and
scan metadata.

### `POST /api/repositories/{repository_id}/audits`

Runs an audit with optional selected check IDs.

### `GET /api/repositories/{repository_id}/findings`

Returns paginated/filterable findings.

### `GET /api/repositories/{repository_id}/findings/{finding_id}`

Returns one finding and its evidence.

### `POST /api/repositories/{repository_id}/questions`

Answers a repository question using retrieved evidence and the
configured agent/model.

### `POST /api/repositories/{repository_id}/findings/{finding_id}/patches`

Creates a proposed documentation patch.

### `POST /api/repositories/{repository_id}/patches/{patch_id}/validate`

Validates the proposed patch.

### `GET /api/repositories/{repository_id}/patches/{patch_id}`

Returns patch metadata, diff, and validation results.

### `GET /api/repositories/{repository_id}/patches/{patch_id}/download`

Downloads a safe patch or updated Markdown file.

### `DELETE /api/repositories/{repository_id}`

Deletes the temporary workspace and related session data.

## 14.2 Example audit response

``` json
{
  "repository_id": "repo_demo",
  "audit_id": "audit_example",
  "status": "completed",
  "summary": {
    "files_inspected": 42,
    "findings_total": 3,
    "verified": 1,
    "needs_review": 2
  },
  "findings": [
    {
      "id": "finding_example",
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

This is an example contract only. Runtime values must be generated from
actual inspection, not hard-coded.

## 14.3 API quality

-   Return clear 4xx errors for invalid requests.
-   Return 413 for uploads exceeding limits.
-   Return 422 for schema validation errors.
-   Return 404 for unknown workspace/finding/patch IDs.
-   Return 429 or a clear retryable response for provider rate limits.
-   Return 503 when a required provider is unavailable.
-   Use request IDs for debugging.
-   Never return stack traces or secrets to clients.
-   Add pagination or bounded result sizes to repository search.
-   Keep long-running tasks bounded; use a simple task status model if
    synchronous requests are too slow.

------------------------------------------------------------------------

# 15. Frontend Data Types and State

Define TypeScript types matching the backend schemas: - `Repository` -
`RepositoryOverview` - `AuditRun` - `Finding` - `EvidenceRef` -
`PatchDraft` - `ValidationResult` - `GroundedAnswer` -
`ProviderStatus` - `ApiError`

UI state must distinguish: - initial / empty, - loading, - success, -
partial success, - failed, - provider unavailable, - validation
pending, - validation complete.

Avoid a single global boolean such as `isLoading` for unrelated
operations. Keep state scoped to the current operation or use a query
library if already present.

The UI must not make a model response look like a verified backend
result. Show source evidence and validation state separately.

------------------------------------------------------------------------

# 16. Suggested Project Directory Structure

``` text
reposcribe/
├── README.md
├── SPEC.md
├── LICENSE
├── CONTRIBUTING.md
├── .gitignore
├── .env.example
├── docker-compose.yml              # optional
├── frontend/
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   └── src/
│       ├── app/
│       │   ├── App.tsx
│       │   ├── router.tsx
│       │   └── providers.tsx
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
│       ├── lib/
│       │   ├── api.ts
│       │   ├── types.ts
│       │   └── utils.ts
│       ├── styles/
│       └── main.tsx
├── backend/
│   ├── pyproject.toml
│   ├── app/
│   │   ├── main.py
│   │   ├── api/
│   │   │   ├── health.py
│   │   │   ├── repositories.py
│   │   │   ├── audits.py
│   │   │   ├── questions.py
│   │   │   └── patches.py
│   │   ├── schemas/
│   │   ├── core/
│   │   │   ├── settings.py
│   │   │   ├── errors.py
│   │   │   └── security.py
│   │   ├── services/
│   │   │   ├── repository_service.py
│   │   │   ├── indexing_service.py
│   │   │   ├── evidence_service.py
│   │   │   ├── audit_service.py
│   │   │   ├── question_service.py
│   │   │   ├── patch_service.py
│   │   │   └── export_service.py
│   │   ├── analyzers/
│   │   │   ├── markdown_links.py
│   │   │   ├── python_symbols.py
│   │   │   ├── fastapi_routes.py
│   │   │   ├── config_references.py
│   │   │   └── docs_routes.py
│   │   ├── integrations/
│   │   │   ├── alan.py
│   │   │   └── model_provider.py
│   │   └── data/
│   │       └── sample_repo/
│   └── tests/
│       ├── unit/
│       ├── integration/
│       ├── security/
│       └── fixtures/
└── docs/
    ├── architecture.md
    ├── threat-model.md
    ├── evaluation.md
    └── demo-script.md
```

This is a target structure, not a requirement to create empty files.
Create modules as needed and keep the actual implementation cohesive.

------------------------------------------------------------------------

# 17. Security, Privacy, and Reliability

## 17.1 Security checklist

-   ZIP slip/path traversal prevention.
-   Upload size and extracted-file limits.
-   No arbitrary code execution.
-   No arbitrary shell tool exposed to the model.
-   No model-controlled unrestricted file writes.
-   Documentation-only patch targets.
-   Secret file exclusion and secret redaction.
-   Server-side provider credentials only.
-   Strict path normalization and workspace isolation.
-   Validate all model-produced paths and structured outputs.
-   Treat repository text as untrusted input.
-   Clear temporary workspace lifecycle.
-   No secrets or full repository contents in logs.
-   Safe error messages without stack traces.

## 17.2 Privacy statement

The README must clearly explain: - Whether repository contents stay
local or are sent to an external provider. - Which data is sent to Alan
AI or the configured model provider. - How to run deterministic checks
without AI, if supported. - How temporary workspaces are stored and
deleted. - Which integrations are optional.

Do not claim "your code never leaves your machine" if the model provider
receives source snippets.

## 17.3 Reliability requirements

-   Model timeout and retry limits.
-   Clear provider failure state.
-   Maximum prompt/context size.
-   Bounded file excerpts.
-   Graceful behavior if a file cannot be parsed.
-   Partial audit results when one analyzer fails, where safe.
-   Stable finding identifiers.
-   Repeatable deterministic checks.
-   No fake progress or success messages.
-   No silent fallback to a different provider.

------------------------------------------------------------------------

# 18. Testing Strategy

Tests are part of the product, not optional polish.

## 18.1 Unit tests

Test: - ZIP path traversal rejection. - Excluded file handling. -
Markdown relative link resolution. - Anchor normalization. - Python
symbol extraction. - FastAPI route extraction for supported decorator
patterns. - Configuration reference extraction. - Finding status
normalization. - Evidence line ranges. - Patch target restrictions. -
Diff generation and patch application. - Secret redaction.

## 18.2 Integration tests

Use a small fixture repository with known source and docs.

At least test: 1. A documented route matches the source route. 2. A
documented route is stale. 3. A Markdown link points to a missing file.
4. A documented configuration key is missing from the canonical config
list. 5. A generated patch fixes the seeded issue. 6. The validation
engine detects a patch that does not fix the issue. 7. Model/provider
unavailable still allows deterministic audit results. 8. Invalid
repository IDs return a safe error.

## 18.3 Security tests

-   ZIP contains `../../outside.txt`.
-   ZIP includes an oversized file or too many files.
-   README contains prompt injection instructions.
-   A proposed patch targets `../../.env`.
-   A model response attempts to cite a nonexistent path.
-   A model response includes unsupported claims.
-   Uploaded files contain likely secrets.

## 18.4 Benchmark

Create 10--20 known defects in a sample repository. Record: - Number of
seeded defects. - Number detected. - Number of false positives. - Number
of patches passing deterministic checks. - Number of invalid
citations. - Average audit time, if measured.

Do not report performance claims until the benchmark has actually run.
Include the limitations and test fixture methodology in
`docs/evaluation.md`.

------------------------------------------------------------------------

# 19. Demo Repository and Signature Scenario

Create or include a tiny, understandable FastAPI sample repository: -
`app/main.py` - `app/routes/users.py` - `app/settings.py` -
`README.md` - `docs/api.md` - `.env.example` - tests for one or two
routes

Seed a known documentation defect, such as: - README documents
`GET /api/users`. - Source defines `GET /api/v2/users`.

Make sure the analyzer truly detects the mismatch. Do not hard-code the
result by repository name.

## Demo sequence (about 2 minutes)

1.  Open the sample repository in RepoScribe.
2.  Run an audit.
3.  Show the stale route finding.
4.  Open the evidence inspector and show the README line and actual
    route definition.
5.  Ask the Alan-powered agent to explain the discrepancy.
6.  Generate a minimal documentation patch.
7.  Show the diff.
8.  Run validation and show the real result.
9.  Download the patch or updated Markdown.
10. Close with the public repository and setup instructions.

The app must work before recording the demo. Keep a local fallback only
if it is honestly labeled and does not misrepresent the required
Alan/model integration.

------------------------------------------------------------------------

# 20. Evaluation and Acceptance Criteria

The MVP is complete only when all critical acceptance criteria are met.

## Functional acceptance

-   [ ] User can open the app and load the bundled sample repository.
-   [ ] User can upload a supported ZIP safely.
-   [ ] Repository overview is based on real scanned files.
-   [ ] Audit produces real deterministic findings.
-   [ ] Each finding has a stable ID and a meaningful status.
-   [ ] Evidence paths and line ranges refer to actual files.
-   [ ] User can inspect the documentation and source evidence.
-   [ ] User can ask a repository question and receive grounded
    citations, when AI is configured.
-   [ ] User can generate a documentation patch for a supported finding.
-   [ ] Patch is shown in a diff viewer.
-   [ ] User can validate and export the patch.
-   [ ] Original source repository is not silently modified.
-   [ ] UI distinguishes verified findings from suggestions and
    uncertainty.
-   [ ] Provider failure is handled without crashing deterministic
    checks.
-   [ ] Alan AI integration is real and accurately documented in the
    final configured demo.
-   [ ] Eligible open model is used according to event rules.
-   [ ] No critical controls are fake or inert.

## Quality acceptance

-   [ ] Unit and integration tests run successfully.
-   [ ] ZIP path traversal tests pass.
-   [ ] Prompt-injection fixture does not grant additional tool access.
-   [ ] No secrets are committed.
-   [ ] `.env.example` contains placeholders only.
-   [ ] No console errors or unhandled backend exceptions in the primary
    flow.
-   [ ] Mobile layout is usable.
-   [ ] README setup instructions have been tested from a clean
    environment.
-   [ ] Demo is repeatable and does not depend on unpredictable model
    behavior for the key result.

## UX acceptance

-   [ ] The first meaningful action is obvious.
-   [ ] The user can understand a finding without reading raw model
    output.
-   [ ] The evidence and proposed fix are visually distinct.
-   [ ] Loading, empty, error, and success states are implemented.
-   [ ] No fake customer logos, fake accuracy numbers, fake charts, or
    fake integrations.
-   [ ] UI copy communicates limitations honestly.

------------------------------------------------------------------------

# 21. Build Plan and Priorities

## Phase 0 --- Inspect and prove integration

-   Inspect the existing repository.
-   Read hackathon requirements.
-   Verify the current Alan AI platform and permitted open model.
-   Build a tiny proof-of-concept workflow.
-   Confirm frontend/backend development commands.

**Exit criterion:** one real Alan workflow or platform-supported call
works, and the model eligibility is confirmed.

## Phase 1 --- Deterministic vertical slice

-   Build sample repository.
-   Implement safe repository inventory.
-   Implement Markdown internal-link checks.
-   Implement Python symbol and supported FastAPI route extraction.
-   Implement a route mismatch finding with real line references.
-   Add backend tests.

**Exit criterion:** a seeded defect is found correctly without relying
on an LLM.

## Phase 2 --- Evidence and patch workflow

-   Normalize finding schema.
-   Build evidence inspector.
-   Generate a minimal patch using evidence and the model.
-   Implement diff preview.
-   Implement deterministic patch validation and export.

**Exit criterion:** user can go from a finding to a validated,
downloadable patch.

## Phase 3 --- Alan-powered agent and grounded Q&A

-   Connect the verified Alan workflow.
-   Define narrow tools and input schemas.
-   Add repository Q&A with citations.
-   Add provider errors and timeouts.
-   Test unsupported and malicious inputs.

**Exit criterion:** the agent calls real repository tools and cannot
invent valid citations unchecked.

## Phase 4 --- UI polish

-   Implement navigation, overview, findings, evidence panel, Q&A, and
    diff view.
-   Add loading/error/empty states.
-   Add responsive behavior and keyboard accessibility.
-   Remove dead controls and placeholder data.

**Exit criterion:** primary flow can be demoed without developer
intervention.

## Phase 5 --- Test, deploy, submit

-   Run unit, integration, and security tests.
-   Run benchmark and document actual results.
-   Deploy frontend/backend.
-   Write complete README.
-   Record a 1--3 minute demo.
-   Verify public repository and submission link.
-   Rehearse the demo twice.

**Priority rule:** If time is short, remove advanced features, not
tests, evidence, or the working core workflow.

------------------------------------------------------------------------

# 22. README Requirements

The public GitHub README should contain:

1.  Project name and one-line pitch.
2.  Short demo GIF/video or screenshot.
3.  Problem statement.
4.  What RepoScribe does and does not do.
5.  Feature list with implemented vs planned labels.
6.  Architecture diagram.
7.  Alan AI integration explanation.
8.  Open model name, license, and configuration.
9.  Tech stack.
10. Local setup instructions.
11. `.env.example` reference.
12. Test commands.
13. Sample repository demo instructions.
14. Benchmark methodology and actual results.
15. Security and privacy notes.
16. Known limitations.
17. Roadmap.
18. Contribution guide and license.

Do not mark planned features as complete. Do not include fabricated
screenshots, benchmark results, or deployment links.

------------------------------------------------------------------------

# 23. Environment Configuration

Use environment variables and a typed settings module. Exact variables
depend on the verified Alan integration, but likely categories include:

``` env
APP_ENV=development
FRONTEND_ORIGIN=http://localhost:5173
BACKEND_PORT=8000
MAX_UPLOAD_MB=20
WORKSPACE_ROOT=./.reposcribe-workspaces

# Add only the exact credentials/config required by the
# currently supported Alan AI integration.
ALAN_API_KEY=
ALAN_WORKFLOW_ID=

# Model configuration should follow the approved provider.
MODEL_PROVIDER=
MODEL_NAME=
MODEL_BASE_URL=
MODEL_API_KEY=
```

These are illustrative placeholders, not confirmation that every
variable is required or that these are the official Alan variable names.
Verify and document the exact integration contract. Do not expose
secrets through a frontend `VITE_` variable.

------------------------------------------------------------------------

# 24. Failure Modes and Expected Behavior

  -----------------------------------------------------------------------
  Failure                             Expected behavior
  ----------------------------------- -----------------------------------
  Invalid ZIP                         Reject with clear explanation

  ZIP traversal path                  Reject unsafe archive entries

  Unsupported repository language     Show partial support and available
                                      checks

  Dynamic route cannot be statically  Mark result inconclusive; do not
  resolved                            claim route is missing

  Model unavailable                   Keep deterministic audit usable;
                                      show provider status

  Model returns invalid schema        Reject output and show retryable
                                      error

  Citation does not match retrieved   Reject or remove citation; do not
  evidence                            present as grounded

  Patch fails to apply                Mark validation failed and preserve
                                      original files

  Patch points outside docs           Reject it

  Repository contains prompt          Treat content as untrusted; tools
  injection                           remain constrained

  Audit takes too long                Show progress, allow cancellation
                                      where feasible, and return partial
                                      status if safe

  No findings                         Explain checks performed and scope;
                                      don't invent issues

  No supported checks                 Explain why and offer supported
                                      options
  -----------------------------------------------------------------------

------------------------------------------------------------------------

# 25. Post-Hackathon Roadmap

Only after the MVP is stable:

## V1.1

-   GitHub public repository import.
-   Better Markdown parser and heading resolution.
-   OpenAPI contract comparison.
-   Incremental scan based on changed files.
-   Persistent audit history.

## V1.2

-   GitHub pull request checks.
-   Proposed PR comments or patches with explicit user authorization.
-   Configurable repository policies.
-   Additional Python frameworks.
-   Tree-sitter support for selected additional languages.

## V2

-   CI action.
-   Team policies and shared rules.
-   More robust dependency/impact graph.
-   Scheduled audits.
-   Optional semantic retrieval.
-   Evaluation suite for comparing model/provider changes.
-   Plugin architecture for custom analyzers.

Do not build these until users have validated the core workflow.

------------------------------------------------------------------------

# 26. Product Metrics

Measure real usage and quality, not vanity numbers.

Core metrics: - Detection precision on the benchmark. - Detection recall
on the benchmark. - Evidence validity rate. - Patch validation pass
rate. - Percentage of findings accepted by a human reviewer (once there
are enough real users). - Time from audit start to useful finding. -
Median time to produce a validated patch. - Failed audit rate. -
Percentage of queries answered with valid citations.

Avoid presenting acceptance rate or accuracy as meaningful if based on a
tiny, cherry-picked sample. Explain benchmark size and limitations.

------------------------------------------------------------------------

# 27. Final Direction

Build RepoScribe as a focused, evidence-first documentation reliability
agent---not a universal AI coding platform.

Its competitive advantage should be: - Deterministic checks for concrete
mismatches. - Source-linked findings. - Clear uncertainty labels. -
Minimal repair patches. - Real validation. - A polished developer
interface. - A reproducible open-source demo. - A truthful, technically
sound Alan AI + eligible open-model integration.

The best hackathon story is simple:

> RepoScribe finds a documentation claim that no longer matches the
> code, shows the exact evidence, proposes a minimal repair, validates
> it, and leaves the final decision to the developer.

## First task for the implementing agent

Start by inspecting the existing repository and reporting: 1. Current
stack and repository structure. 2. What already works. 3. What is
missing for the first end-to-end workflow. 4. The exact Alan AI
integration required by the hackathon and what must be verified. 5. A
short implementation plan.

Then implement the smallest end-to-end slice and run its tests before
expanding the scope.
