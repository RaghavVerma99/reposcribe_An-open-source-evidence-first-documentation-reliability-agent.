"""CHK-05: documented public symbols that the static index cannot find."""

from __future__ import annotations

from app.analyzers.common import DOTTED_RE, PATHLIKE_RE, RepoIndex, STDLIB_ROOTS
from app.analyzers.factory import AnalyzerResult, cap_findings, deadline_expired, doc_evidence, make_finding

CHECK_ID = "python.public_symbol_referenced"


class SymbolReferenceAnalyzer:
    check_id = CHECK_ID
    supported_patterns = ["dotted symbol references in inline code"]
    limitations = [
        "Only top-level functions and classes in scanned Python files are indexed.",
        "Re-exports, dynamically created attributes, and __getattr__ resolution are unsupported.",
        "Standard-library and third-party dotted references are skipped.",
    ]

    def analyze(self, index: RepoIndex, *, deadline: float | None = None) -> AnalyzerResult:
        result = AnalyzerResult(check_id=self.check_id, limitations=list(self.limitations))
        names = {symbol.name for symbol in index.symbols}
        modules = {symbol.module for symbol in index.symbols}
        if not names:
            result.limitations.append("No Python symbols were indexed.")
            return result

        seen: set[str] = set()
        for doc in index.docs.values():
            if deadline_expired(deadline):
                result.complete = False
                result.limitations.append(
                    "The audit time budget expired before this check finished; its findings may be incomplete."
                )
                return cap_findings(result)
            for span in doc.code_spans:
                token = span.text.strip()
                if not DOTTED_RE.match(token) or PATHLIKE_RE.match(token):
                    continue
                parts = token.split(".")
                if any(part.isdigit() for part in parts):
                    continue
                if parts[0] in STDLIB_ROOTS:
                    continue
                if parts[0] == "self":
                    continue
                last = parts[-1]
                if last in names or token in modules:
                    continue
                if token in seen:
                    continue
                seen.add(token)
                result.findings.append(
                    make_finding(
                        check_id=self.check_id,
                        subject_key=f"{doc.path}:{token}",
                        title="Documented symbol was not found in the index",
                        summary=f"`{token}` is documented but is not a top-level symbol in the scanned Python files.",
                        status="needs_review",
                        severity="low",
                        confidence_note=(
                            "The static index cannot see dynamic attributes, re-exports, or symbols defined outside scanned files."
                        ),
                        documentation_claim=f"References `{token}`.",
                        observed_fact="No indexed top-level function or class has that name.",
                        evidence=[doc_evidence(doc, span.line)],
                        limitations=list(self.limitations),
                    )
                )
        return cap_findings(result)
