"""Provider abstraction. Deterministic code never depends on this layer."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Protocol

from app.analyzers.common import RepoIndex
from app.core.settings import Settings
from app.schemas.models import Finding, GroundedAnswer, ProviderStatus


@dataclass(frozen=True)
class Chunk:
    path: str
    start_line: int
    end_line: int
    text: str
    role: str = "documentation"


@dataclass
class PatchProposal:
    content: str
    rationale: str
    limitations: list[str] = field(default_factory=list)


class ModelProvider(Protocol):
    name: str

    def status(self) -> ProviderStatus: ...

    def answer_question(self, question: str, chunks: list[Chunk]) -> GroundedAnswer: ...

    def draft_patch(
        self, finding: Finding, document: str, doc_path: str, index: RepoIndex
    ) -> PatchProposal: ...


def build_provider(settings: Settings) -> ModelProvider:
    from app.integrations.alan import AlanProvider
    from app.integrations.local_demo import LocalDemoProvider

    if settings.model_provider.lower() == "alan":
        return AlanProvider(settings)
    return LocalDemoProvider(settings)


def provider_status(settings: Settings) -> ProviderStatus:
    return build_provider(settings).status()
