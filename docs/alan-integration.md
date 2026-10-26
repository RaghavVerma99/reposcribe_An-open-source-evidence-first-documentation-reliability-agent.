# Alan integration

## Status: not verified, not enabled

This document is the gate described in `SPEC.md` §21.2. Until it is filled in with verified facts, the application
runs in local demo mode and says so in the UI and in `GET /api/v1/provider`.

Nothing in this build pretends to be an Alan connection:

- `MODEL_PROVIDER` defaults to `local_demo`.
- `backend/app/integrations/alan.py` is implemented and wired into the provider factory, but every model call
  raises `provider_unavailable` with the message in `CONTRACT_NOTE`.
- `ProviderStatus.verified_contract` is hard-coded `false`. When the contract is verified and the adapter is
  implemented, this field must be driven by a real successful call, not by a constant.

## Verification checklist

Answer every question from primary sources (the event's current instructions and Alan's current documentation)
before writing adapter code. Record the answers here with a date.

| # | Question | Answer | Verified on |
|---|---|---|---|
| 1 | What exactly does the event require? (paste the relevant text or link) | | |
| 2 | Which Alan product, workflow, SDK, or API is the integration target? | | |
| 3 | How does a server-side application authenticate and invoke it? | | |
| 4 | How is a model selected, and which open models and licenses are permitted? | | |
| 5 | Is tool or workflow invocation supported, and how are credentials supplied? | | |
| 6 | What are the request and response schemas? | | |
| 7 | What are the rate limits, timeouts, and error shapes? | | |
| 8 | What is the exact model name and license to record in the README? | | |

## Do not assume

- The legacy Alan voice SDK, a current Alan agent platform, and a generic OpenAI-compatible endpoint are not
  interchangeable. Verify which one is required.
- An OpenAI-compatible base URL is not automatically supported by Alan. Confirm the route.
- Do not substitute a proprietary model if the event requires an open model.

## Enablement steps once verified

1. Record the answers above and update `SPEC.md` §34 (`D-06`) with the resolution.
2. Set the real variable names in `backend/app/core/settings.py`, `.env.example`, and `README.md`. The current
   `ALAN_*` names are placeholders.
3. Implement `AlanProvider.answer_question` and `AlanProvider.draft_patch`:

   - enforce `MODEL_TIMEOUT_SECONDS` and `MODEL_MAX_INPUT_TOKENS`;
   - parse responses into `GroundedAnswer` / `PatchProposal` and reject anything off-schema with
     `model_output_invalid`;
   - map upstream limits to `provider_rate_limited` (retryable) and outages to `provider_unavailable`.

4. Keep repository content in a delimited untrusted block. Never let repository text become instructions.
5. Make `AlanProvider.status()` reflect a real check, so `verified_contract` is earned.
6. Add a test that the adapter rejects a response containing a citation that was not in the evidence bundle.
7. Update `README.md` with the model name and license, and only then describe the integration as live.

## Local demo provider

`backend/app/integrations/local_demo.py` is not a language model. It is deterministic and rule-based:

- **Answers** are extracted from the top retrieved excerpt and carry the retrieved path and line range. If nothing
  matches, it says so.
- **Patches** are derived from the finding: a route mismatch repoints the documented method and path; a broken
  internal link is repointed to a filename match or de-linked; a stale symbol is replaced with the closest indexed
  name at a similarity threshold. Anything else returns `patch_not_available` rather than guessing.

Both paths are labelled `local_demo` in every response so no surface can mistake them for model output.