"""CHK-06: a small, explicit README and setup checklist.

This is a suggestion list, not a quality score.
"""

from __future__ import annotations

import re
from pathlib import Path

from app.analyzers.common import RepoIndex
from app.analyzers.factory import AnalyzerResult, doc_evidence, make_finding

CHECK_ID = "docs.readme_checklist"

SETUP_RE = re.compile(r"(?i)\b(install|installation|setup|getting started|quick ?start)\b")
TEST_RE = re.compile(r"(?i)\b(pytest|npm (run )?test|yarn test|pnpm test|make test|tox|python -m unittest)\b")
LICENSE_NAMES = {"license", "license.md", "license.txt", "copying", "copying.md"}


class ReadmeChecklistAnalyzer:
    check_id = CHECK_ID
    supported_patterns = ["README presence", "setup section", "test command", "environment setup", "API docs", "license file"]
    limitations = [
        "Checklist items are suggestions, not correctness claims.",
        "Presence checks do not evaluate whether the content itself is accurate.",
    ]

    def analyze(self, index: RepoIndex) -> AnalyzerResult:
        result = AnalyzerResult(check_id=self.check_id, limitations=list(self.limitations))
        readme = _readme(index)
        if readme is None:
            result.findings.append(
                make_finding(
                    check_id=self.check_id,
                    subject_key="readme-missing",
                    title="README is missing",
                    summary="No README file was found at the repository root.",
                    status="needs_review",
                    severity="info",
                    confidence_note="A README is expected for a usable open-source project, but its absence is a suggestion.",
                    documentation_claim="No README exists.",
                    observed_fact="No README.md or README.markdown at the repository root.",
                    evidence=[],
                    limitations=list(self.limitations),
                )
            )
            return result

        evidence = doc_evidence(readme, 1, min(3, len(readme.lines)) or 1)

        if not any(SETUP_RE.search(heading.text) for heading in readme.headings):
            result.findings.append(
                _finding(
                    "readme-install-section",
                    "README has no installation or setup section",
                    "No heading mentions installation, setup, or getting started.",
                    "info",
                    "info",
                    evidence,
                )
            )
        if not TEST_RE.search(readme.text):
            result.findings.append(
                _finding(
                    "readme-test-command",
                    "README does not document a test command",
                    "No recognized test command (for example `pytest`) appears in the README.",
                    "needs_review",
                    "low",
                    evidence,
                )
            )
        if _has_config(index) and not _mentions_config(readme):
            result.findings.append(
                _finding(
                    "readme-env-setup",
                    "README does not document environment configuration",
                    "The repository defines configuration, but the README does not mention environment setup.",
                    "info",
                    "info",
                    evidence,
                )
            )
        if index.routes and not _has_api_docs(index):
            result.findings.append(
                _finding(
                    "readme-api-docs",
                    "API routes are defined without documented API reference",
                    "FastAPI routes were discovered, but no documentation lists them.",
                    "needs_review",
                    "medium",
                    evidence,
                )
            )
        if not _has_license(index.root):
            result.findings.append(
                _finding(
                    "license-missing",
                    "License file is missing",
                    "No LICENSE or COPYING file was found. This reports presence only and is not legal advice.",
                    "info",
                    "info",
                    evidence,
                )
            )
        return result


def _finding(subject: str, title: str, summary: str, status: str, severity: str, evidence):
    return make_finding(
        check_id=CHECK_ID,
        subject_key=subject,
        title=title,
        summary=summary,
        status="needs_review" if status == "info" else status,  # type: ignore[arg-type]
        severity=severity,  # type: ignore[arg-type]
        confidence_note="This is a documentation-completeness suggestion, not a contradiction.",
        documentation_claim="Documentation checklist item is absent.",
        observed_fact=summary,
        evidence=[evidence],
        limitations=[
            "Checklist presence checks do not evaluate content quality.",
        ],
    )


def _readme(index: RepoIndex):
    for path, doc in index.docs.items():
        if "/" not in path and path.lower() in ("readme.md", "readme.markdown"):
            return doc
    return None


def _has_config(index: RepoIndex) -> bool:
    return bool(index.env_defined) or (index.root / ".env.example").exists()


def _mentions_config(doc) -> bool:
    if ".env" in doc.text or "environment variable" in doc.text.lower():
        return True
    return any(re.search(r"\b[A-Z][A-Z0-9]*_[A-Z0-9_]+\b", line) for line in doc.lines)


def _has_api_docs(index: RepoIndex) -> bool:
    return bool(index.documented_routes)


def _has_license(root: Path) -> bool:
    for path in root.iterdir():
        if path.is_file() and path.name.lower() in LICENSE_NAMES:
            return True
    return False
