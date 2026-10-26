"""Analyzer registry. Order is presentation order."""

from __future__ import annotations

from app.analyzers.config_references import ConfigReferenceAnalyzer
from app.analyzers.docs_references import FileReferenceAnalyzer
from app.analyzers.fastapi_routes import RouteAnalyzer
from app.analyzers.markdown_links import MarkdownLinkAnalyzer
from app.analyzers.python_symbols import SymbolReferenceAnalyzer
from app.analyzers.readme_checklist import ReadmeChecklistAnalyzer

ANALYZERS = [
    MarkdownLinkAnalyzer(),
    FileReferenceAnalyzer(),
    RouteAnalyzer(),
    ConfigReferenceAnalyzer(),
    SymbolReferenceAnalyzer(),
    ReadmeChecklistAnalyzer(),
]

CHECKS_SUPPORTED = [analyzer.check_id for analyzer in ANALYZERS]


def get_analyzer(check_id: str):
    for analyzer in ANALYZERS:
        if analyzer.check_id == check_id:
            return analyzer
    return None
