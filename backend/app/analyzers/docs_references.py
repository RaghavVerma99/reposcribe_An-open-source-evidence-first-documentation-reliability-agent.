"""CHK-02: setup docs referencing files that do not exist.

Deliberately conservative: placeholders, globs, generated paths, and shell
commands are not reported.
"""

from __future__ import annotations

from app.analyzers.common import PATHLIKE_RE, RepoIndex, _resolve_relative
from app.analyzers.factory import AnalyzerResult, doc_evidence, make_finding

CHECK_ID = "docs.file_reference_exists"

IGNORED_NAMES = {".env", ".env.local", ".env.development", ".env.production"}
SKIP_PREFIXES = ("http://", "https://", "$", "~", "<", ">", "/", "./~")


class FileReferenceAnalyzer:
    check_id = CHECK_ID
    supported_patterns = ["inline code path references", "relative file paths"]
    limitations = [
        "Only inline-code path references with a known file extension are checked.",
        "Globs, template variables, generated files and absolute paths are not evaluated.",
    ]

    def analyze(self, index: RepoIndex) -> AnalyzerResult:
        result = AnalyzerResult(check_id=self.check_id, limitations=list(self.limitations))
        for doc in index.docs.values():
            link_targets = {link.resolved_path for link in doc.links if link.resolved_path}
            seen: set[str] = set()
            for span in doc.code_spans:
                token = span.text.strip()
                if not token or " " in token or token in IGNORED_NAMES:
                    continue
                if token.startswith(SKIP_PREFIXES) or "*" in token or "{" in token or "$" in token:
                    continue
                if not PATHLIKE_RE.match(token):
                    continue
                resolved = _resolve_relative(doc.path, token)
                if resolved is None or resolved in seen or resolved in link_targets:
                    continue
                if (index.root / resolved).exists():
                    continue
                seen.add(resolved)
                result.findings.append(
                    make_finding(
                        check_id=self.check_id,
                        subject_key=f"{doc.path}:{resolved}",
                        title="Documented file does not exist",
                        summary=f"The documentation references `{token}`, which is not present in the repository.",
                        status="verified",
                        severity="medium",
                        confidence_note="The path was resolved relative to the document and does not exist.",
                        documentation_claim=f"References `{token}`.",
                        observed_fact=f"`{resolved}` is missing.",
                        evidence=[doc_evidence(doc, span.line)],
                        limitations=list(self.limitations),
                    )
                )
        return result
