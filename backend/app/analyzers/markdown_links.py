"""CHK-01: internal Markdown links and anchors."""

from __future__ import annotations

from app.analyzers.common import RepoIndex
from app.analyzers.factory import AnalyzerResult, cap_findings, deadline_expired, doc_evidence, make_finding

CHECK_ID = "markdown.internal_link_exists"

LIMITATIONS = [
    "Only relative links inside Markdown documents are checked.",
    "External URLs and site-root paths are not requested, resolved, or validated.",
    "Links inside fenced code blocks and images are ignored.",
]


class MarkdownLinkAnalyzer:
    check_id = CHECK_ID
    supported_patterns = ["inline links", "reference-style headings", "relative paths"]
    limitations = LIMITATIONS

    def analyze(self, index: RepoIndex, *, deadline: float | None = None) -> AnalyzerResult:
        result = AnalyzerResult(check_id=self.check_id, limitations=list(LIMITATIONS))
        for doc in index.docs.values():
            if deadline_expired(deadline):
                result.complete = False
                result.limitations.append(
                    "The audit time budget expired before this check finished; its findings may be incomplete."
                )
                return cap_findings(result)
            for link in doc.links:
                if link.external or not link.checkable:
                    continue
                if not link.exists:
                    evidence = doc_evidence(doc, link.line)
                    resolved_note = (
                        f"No file exists at `{link.resolved_path}`."
                        if link.resolved_path
                        else "The link resolves outside the repository workspace."
                    )
                    result.findings.append(
                        make_finding(
                            check_id=self.check_id,
                            subject_key=f"{doc.path}:{link.target}",
                            title="Broken internal documentation link",
                            summary=f"`{link.target}` does not resolve to a file in this repository.",
                            status="verified",
                            severity="medium",
                            confidence_note="The resolved relative path was not found inside the workspace.",
                            documentation_claim=f"Links to `{link.target}`.",
                            observed_fact=resolved_note,
                            evidence=[evidence],
                            limitations=list(LIMITATIONS),
                        )
                    )
                elif link.missing_anchor:
                    evidence = doc_evidence(doc, link.line)
                    result.findings.append(
                        make_finding(
                            check_id=self.check_id,
                            subject_key=f"{doc.path}:{link.target}",
                            title="Broken anchor in internal documentation link",
                            summary=f"`{link.target}` points at a heading that was not found.",
                            status="verified",
                            severity="medium",
                            confidence_note="The target file exists, but the normalized heading anchor does not.",
                            documentation_claim=f"Links to heading `#{link.anchor}`.",
                            observed_fact=f"`{link.resolved_path}` has no heading matching that anchor.",
                            evidence=[evidence],
                            limitations=[
                                "Heading anchors are approximated with GitHub-style slugs.",
                                *LIMITATIONS,
                            ],
                        )
                    )
        return cap_findings(result)
