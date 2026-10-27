"""CHK-04: environment variables documented but absent from configuration."""

from __future__ import annotations

import re

from app.analyzers.common import ENV_ASSIGN_RE, DocFile, RepoIndex
from app.analyzers.factory import AnalyzerResult, cap_findings, deadline_expired, doc_evidence, make_finding

CHECK_ID = "config.env_var_documented"

ENV_KEY_RE = re.compile(r"^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+$")
SINGLE_WORD_KEY_RE = re.compile(r"^[A-Z][A-Z0-9]{2,}$")
ENV_CONTEXT_RE = re.compile(
    r"\b(?:environment|environmental|env|variable|variables|config|configuration|setting|settings|export)\b",
    re.IGNORECASE,
)
MAX_FINDINGS = 25

STOPLIST = {
    "HTTP_METHOD", "HTTP_STATUS", "API_KEY_HEADER", "JSON_BODY", "CONTENT_TYPE",
    "USER_AGENT", "URL_PATH", "README_MD", "OPENAPI_JSON", "UTF_8", "ISO_8601",
}

# Upper-case tokens that pass the single-word shape but are not configuration
# variables. Without this, `GET` in an API table and `JSON` in prose would be
# reported as undocumented environment variables.
SINGLE_WORD_STOPLIST = {
    "GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS", "TRACE", "CONNECT",
    "JSON", "YAML", "TOML", "HTML", "CSS", "XML", "SQL", "CSV", "PDF", "SVG",
    "HTTP", "HTTPS", "API", "URL", "URI", "CLI", "SDK", "UUID", "TLS", "SSL", "JWT",
    "README", "TODO", "NOTE", "WARNING", "IMPORTANT", "TRUE", "FALSE", "NONE", "NULL",
}


def _is_documented_key(key: str, doc: DocFile, line_no: int, line_text: str) -> bool:
    """Whether a code span names a configuration variable.

    Multi-word names are unambiguous. A single-word name is only compared when
    its line or its nearest heading is about configuration, so HTTP methods and
    media types in an API section are never reported as missing variables.
    """
    if key in STOPLIST or key in SINGLE_WORD_STOPLIST:
        return False
    if ENV_KEY_RE.match(key):
        return True
    if not SINGLE_WORD_KEY_RE.match(key):
        return False
    if ENV_CONTEXT_RE.search(line_text):
        return True
    for heading in reversed(doc.headings):
        if heading.line <= line_no:
            return bool(ENV_CONTEXT_RE.search(heading.text))
    return False


class ConfigReferenceAnalyzer:
    check_id = CHECK_ID
    supported_patterns = ["os.getenv", "os.environ[...]", "os.environ.get", ".env.example"]
    limitations = [
        "A variable injected by the deployment platform may be valid without appearing in the repository.",
        "Values from .env are never read, and secret values are never reported.",
        "Single-word names are compared only when their line or nearest section heading is about configuration.",
    ]

    def analyze(self, index: RepoIndex, *, deadline: float | None = None) -> AnalyzerResult:
        result = AnalyzerResult(check_id=self.check_id, limitations=list(self.limitations))
        documented: list[tuple[str, str, int]] = []
        for doc in index.docs.values():
            if deadline_expired(deadline):
                result.complete = False
                result.limitations.append(
                    "The audit time budget expired before this check finished; its findings may be incomplete."
                )
                return cap_findings(result, MAX_FINDINGS)
            for span in doc.code_spans:
                key = span.text.strip()
                line_text = doc.lines[span.line - 1] if 0 < span.line <= len(doc.lines) else ""
                if _is_documented_key(key, doc, span.line, line_text):
                    documented.append((key, doc.path, span.line))
            for line_no, line in enumerate(doc.lines, start=1):
                match = ENV_ASSIGN_RE.match(line.strip())
                if not match:
                    continue
                key = match.group(1)
                # An explicit `KEY=VALUE` line is configuration evidence on its
                # own, so a single-word name does not need section context.
                if key in STOPLIST or key in SINGLE_WORD_STOPLIST:
                    continue
                if ENV_KEY_RE.match(key) or SINGLE_WORD_KEY_RE.match(key):
                    documented.append((key, doc.path, line_no))

        if not documented:
            return result

        canonical = index.env_defined
        if not canonical:
            result.findings.append(
                make_finding(
                    check_id=self.check_id,
                    subject_key="no-configuration-sources",
                    title="Configuration references could not be verified",
                    summary="Documentation mentions environment variables, but no configuration source was found.",
                    status="insufficient_evidence",
                    severity="low",
                    confidence_note="Without .env.example or source references there is no canonical variable list to compare.",
                    documentation_claim="Documents environment variables.",
                    observed_fact="No .env.example, settings module, or os.getenv reference was found.",
                    evidence=[doc_evidence(index.docs[documented[0][1]], documented[0][2])],
                    limitations=list(self.limitations),
                )
            )
            return result

        seen: set[tuple[str, str]] = set()
        for key, path, line in documented:
            if deadline_expired(deadline):
                result.complete = False
                result.limitations.append(
                    "The audit time budget expired before this check finished; its findings may be incomplete."
                )
                break
            if key in canonical or (key, path) in seen:
                continue
            seen.add((key, path))
            doc = index.docs[path]
            result.findings.append(
                make_finding(
                    check_id=self.check_id,
                    subject_key=f"{path}:{key}",
                    title="Documented environment variable is not defined",
                    summary=f"`{key}` is documented but does not appear in any recognized configuration source.",
                    status="needs_review",
                    severity="low",
                    confidence_note=(
                        "Deployment platforms often inject variables, so absence from the repository is not proof of a defect."
                    ),
                    documentation_claim=f"Requires `{key}`.",
                    observed_fact=f"`{key}` was not found in .env.example or scanned Python sources.",
                    evidence=[doc_evidence(doc, line)],
                    limitations=list(self.limitations),
                )
            )
        return cap_findings(result, MAX_FINDINGS)
