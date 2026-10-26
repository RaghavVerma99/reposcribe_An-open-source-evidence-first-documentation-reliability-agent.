"""Alan adapter.

The integration contract is intentionally unimplemented until SPEC 21.2 is
satisfied. This adapter never fabricates a connection: if it is selected
without verified configuration, every call raises a clear provider error and
``/provider`` reports the real state.
"""

from __future__ import annotations

from app.analyzers.common import RepoIndex
from app.core.errors import AppError
from app.core.settings import Settings
from app.integrations.model_provider import Chunk, PatchProposal
from app.schemas.models import Finding, GroundedAnswer, ProviderStatus

CONTRACT_NOTE = (
    "The Alan product, SDK, auth scheme, and permitted open model must be verified "
    "against the current event instructions before this adapter can be enabled. "
    "See docs/alan-integration.md."
)


class AlanProvider:
    name = "alan"

    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    def status(self) -> ProviderStatus:
        configured = self.settings.alan_configured
        return ProviderStatus(
            mode="unavailable",
            provider=self.name,
            model=self.settings.model_name or "unset",
            state="not_configured" if not configured else "error",
            message=(
                "Alan is not configured. Running deterministic checks is unaffected; AI-assisted features are disabled."
                if not configured
                else "Alan settings are present, but the integration contract has not been verified or implemented."
            ),
            verified_contract=False,
        )

    def _unavailable(self) -> AppError:
        return AppError("provider_unavailable", CONTRACT_NOTE, 503, retryable=False)

    def answer_question(self, question: str, chunks: list[Chunk]) -> GroundedAnswer:
        raise self._unavailable()

    def draft_patch(
        self, finding: Finding, document: str, doc_path: str, index: RepoIndex
    ) -> PatchProposal:
        raise self._unavailable()
