"""CHK-02: setup docs referencing files that do not exist.

Deliberately conservative: placeholders, globs, generated paths, and shell
commands are not reported.

Instructional verbs (``Create``, ``Add``, ``Write``, ``Make``, ``Run``) before a
path reference very often describe a file the reader will create themselves.
We skip those spans unless the document explicitly says it is documenting an
existing project (e.g. on the same line, an adjective like ``existing``,
``current``, ``configured``).
"""

from __future__ import annotations

import re

from app.analyzers.common import PATHLIKE_RE, RepoIndex, _resolve_relative
from app.analyzers.factory import AnalyzerResult, cap_findings, deadline_expired, doc_evidence, make_finding
from app.core.security import is_within

CHECK_ID = "docs.file_reference_exists"

IGNORED_NAMES = {".env", ".env.local", ".env.development", ".env.production"}
SKIP_PREFIXES = ("http://", "https://", "$", "~", "<", ">", "/", "./~")
INSTRUCTIONAL_VERBS = re.compile(
    r"\b(?:create|creates|created|creating|add|adds|added|adding|write|writes|wrote|writing|"
    r"make|makes|made|making|run|runs|ran|running|generate|generates|created)\b",
    re.IGNORECASE,
)
EXISTING_HINTS = re.compile(
    r"\b(?:existing|current|currently|configured|installed|present|actual|"
    r"already)\b",
    re.IGNORECASE,
)


def _instructional_context(window_text: str) -> bool:
    """True if the surrounding text clearly tells the reader to create the file."""
    if not window_text:
        return False
    if EXISTING_HINTS.search(window_text):
        return False  # the doc frames the path as already existing
    if INSTRUCTIONAL_VERBS.search(window_text):
        return True
    return False


class FileReferenceAnalyzer:
    check_id = CHECK_ID
    supported_patterns = ["inline code path references", "relative file paths"]
    limitations = [
        "Only inline-code path references with a known file extension are checked.",
        "Globs, template variables, generated files and absolute paths are not evaluated.",
        "Spans preceded by instructional verbs ('Create <file>', 'Run <cmd>', etc.) are not reported — "
        "these describe files the reader will create, not files the doc is trying to document.",
    ]

    def analyze(self, index: RepoIndex, *, deadline: float | None = None) -> AnalyzerResult:
        result = AnalyzerResult(check_id=self.check_id, limitations=list(self.limitations))
        for doc in index.docs.values():
            if deadline_expired(deadline):
                result.complete = False
                result.limitations.append(
                    "The audit time budget expired before this check finished; its findings may be incomplete."
                )
                return cap_findings(result)
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
                # Decide whether the doc is asking the reader to create this file or
                # document an existing one. Same-line context is the strongest signal.
                line_text = doc.lines[span.line - 1] if 0 < span.line <= len(doc.lines) else ""
                prev_text = doc.lines[span.line - 2] if span.line - 2 >= 0 else ""
                window = f"{prev_text} {line_text}".strip()
                if _instructional_context(window):
                    continue
                resolved = _resolve_relative(doc.path, token)
                if resolved is None or resolved in seen or resolved in link_targets:
                    continue
                absolute = index.root / resolved
                if is_within(index.root, absolute) and absolute.exists():
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
        return cap_findings(result)
