"""Grounded Q&A endpoint (SPEC 20.1)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Request

from app.api.deps import get_app_settings, repo_or_404
from app.core.settings import Settings
from app.schemas.models import GroundedAnswer, QuestionRequest
from app.services.question_service import QuestionService

router = APIRouter(prefix="/repositories/{repository_id}/questions", tags=["questions"])


@router.post("", response_model=GroundedAnswer)
def ask_question(
    request: Request,
    repository_id: str,
    payload: QuestionRequest,
    settings: Settings = Depends(get_app_settings),
) -> GroundedAnswer:
    state = repo_or_404(request, repository_id)
    return QuestionService(settings).ask(state, payload.question)
