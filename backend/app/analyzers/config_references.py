"""CHK-04: environment variables documented but absent from configuration."""

from __future__ import annotations

import re

from app.analyzers.common import ENV_ASSIGN_RE, RepoIndex
from app.analyzers.factory import AnalyzerResult, doc_evidence, make_finding

CHECK_ID = "config.env_var_documented"

ENV_KEY_RE = re.compile(r"^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+$")
MAX_FINDINGS = 25

STOPLIST = {
    "HTTP_METHOD", "HTTP_STATUS", "API_KEY_HEADER", "JSON_BODY", "CONTENT_TYPE",
    "USER_AGENT", "URL_PATH", "README_MD", "OPENAPI_JSON", "UTF_8", "ISO_8601",
}


class ConfigReferenceAnalyzer:
    check_id = CHECK_ID
    supported_patterns = ["os.getenv", "os.environ[...]", "os.environ.get", ".env.example"]
    limitations = [
        "A variable injected by the deployment platform may be valid without appearing in the repository.",
        "Values from .env are never read, and secret values are never reported.",
        "Only variable names with an underscore and uppercase format are compared.",
    ]

    def analyze(self, index: RepoIndex) -> AnalyzerResult:
        result = AnalyzerResult(check_id=self.check_id, limitations=list(self.limitations))
        documented: list[tuple[str, str, int]] = []
        for doc in index.docs.values():
            for span in doc.code_spans:
                key = span.text.strip()
                if ENV_KEY_RE.match(key) and key not in STOPLIST:
                    documented.append((key, doc.path, span.line))
            for line_no, line in enumerate(doc.lines, start=1):
                match = ENV_ASSIGN_RE.match(line.strip())
                if match and ENV_KEY_RE.match(match.group(1)):
                    documented.append((match.group(1), doc.path, line_no))

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
            if key in canonical or (key, path) in seen:
                continue
            if len(result.findings) >= MAX_FINDINGS:
                result.limitations.append(f"Findings were capped at {MAX_FINDINGS} variables.")
                break
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
        return result
