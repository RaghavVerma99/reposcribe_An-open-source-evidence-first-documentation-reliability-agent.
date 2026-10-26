"""Grounded repository Q&A with citation verification."""

from __future__ import annotations

import re

from app.analyzers.common import RepoIndex
from app.core.errors import AppError
from app.core.settings import Settings
from app.integrations.model_provider import Chunk, build_provider
from app.schemas.models import GroundedAnswer
from app.services.store import RepositoryState

MAX_QUESTION_CHARS = 500
MAX_CHUNKS = 8
WINDOW_BEFORE = 2
WINDOW_AFTER = 8


class QuestionService:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    def ask(self, state: RepositoryState, question: str) -> GroundedAnswer:
        cleaned = question.strip()
        if not cleaned:
            raise AppError("invalid_request", "Question must not be empty.")
        if len(cleaned) > MAX_QUESTION_CHARS:
            raise AppError("invalid_request", f"Question exceeds {MAX_QUESTION_CHARS} characters.")
        if state.index is None:
            raise AppError("internal_error", "Repository has not been indexed.", 500)

        chunks = retrieve(state.index, cleaned)
        provider = build_provider(self.settings)
        answer = provider.answer_question(cleaned, chunks)
        return _verify_citations(answer, chunks)


def retrieve(index: RepoIndex, query: str, limit: int = MAX_CHUNKS) -> list[Chunk]:
    terms = [term for term in re.split(r"\W+", query.lower()) if len(term) > 2]
    if not terms:
        return []

    scored: list[tuple[float, Chunk]] = []
    for doc in index.docs.values():
        chunk = _best_window(doc.path, doc.lines, terms, "documentation")
        if chunk:
            path_bonus = sum(1 for term in terms if term in doc.path.lower()) * 2
            scored.append((_score(chunk.text, terms) + path_bonus, chunk))
    for py_file in index.py_files.values():
        lines = py_file.text.splitlines()
        chunk = _best_window(py_file.path, lines, terms, "source")
        if chunk:
            path_bonus = sum(1 for term in terms if term in py_file.path.lower()) * 2
            scored.append((_score(chunk.text, terms) + path_bonus, chunk))

    scored.sort(key=lambda item: (-item[0], item[1].path))
    return [chunk for _, chunk in scored[:limit]]


def _best_window(path: str, lines: list[str], terms: list[str], role: str) -> Chunk | None:
    if not lines:
        return None
    hits = [sum(line.lower().count(term) for term in terms) for line in lines]
    if not any(hits):
        return None
    best = max(range(len(hits)), key=lambda idx: hits[idx])
    start = max(0, best - WINDOW_BEFORE)
    end = min(len(lines), best + WINDOW_AFTER + 1)
    text = "\n".join(lines[start:end]).strip()
    if not text:
        return None
    return Chunk(path=path, start_line=start + 1, end_line=end, text=text, role=role)


def _score(text: str, terms: list[str]) -> float:
    lowered = text.lower()
    return float(sum(lowered.count(term) for term in terms))


def _verify_citations(answer: GroundedAnswer, chunks: list[Chunk]) -> GroundedAnswer:
    """Drop citations that do not map to retrieved evidence (SPEC 12.6)."""
    valid = []
    rejected = 0
    for citation in answer.citations:
        matches = [
            chunk
            for chunk in chunks
            if chunk.path == citation.path
            and _ranges_overlap(
                chunk.start_line, chunk.end_line, citation.start_line or 0, citation.end_line or 0
            )
        ]
        if matches:
            chunk = matches[0]
            valid.append(
                citation.model_copy(
                    update={
                        "start_line": max(citation.start_line or chunk.start_line, chunk.start_line),
                        "end_line": min(citation.end_line or chunk.end_line, chunk.end_line),
                        "excerpt": chunk.text,
                    }
                )
            )
        else:
            rejected += 1

    limitations = list(answer.limitations)
    if rejected:
        limitations.append(f"{rejected} citation(s) were removed because they did not match retrieved evidence.")
    return answer.model_copy(update={"citations": valid, "limitations": limitations})


def _ranges_overlap(a_start: int, a_end: int, b_start: int, b_end: int) -> bool:
    return a_start <= b_end and b_start <= a_end
