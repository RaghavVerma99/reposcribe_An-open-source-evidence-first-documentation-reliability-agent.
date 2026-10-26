"""CHK-03: documented HTTP routes versus statically discoverable FastAPI routes."""

from __future__ import annotations

import difflib

from app.analyzers.common import DocRoute, RepoIndex, Route
from app.analyzers.factory import AnalyzerResult, doc_evidence, file_evidence, make_finding

CHECK_ID = "fastapi.route_matches_docs"

LIMITATIONS = [
    "Only decorator-style FastAPI routes in scanned Python files are discovered.",
    "Routers mounted dynamically or imported without a resolvable prefix are not compared as verified.",
]


class RouteAnalyzer:
    check_id = CHECK_ID
    supported_patterns = ["@app.get", "@app.post", "@router.get", "@router.api_route"]
    limitations = LIMITATIONS

    def analyze(self, index: RepoIndex) -> AnalyzerResult:
        result = AnalyzerResult(check_id=self.check_id, limitations=list(LIMITATIONS))
        documented = _dedupe(index.documented_routes)
        if not documented:
            result.limitations.append("No documented routes were parsed from Markdown tables, code blocks, or OpenAPI JSON.")
            return result

        discovered = index.routes
        pairs = {(route.method, route.path) for route in discovered}
        by_path: dict[str, list[Route]] = {}
        for route in discovered:
            by_path.setdefault(route.path, []).append(route)

        for doc_route in documented:
            if (doc_route.method, doc_route.path) in pairs:
                continue
            doc = index.docs.get(doc_route.doc_path)
            if doc is None:
                continue
            evidence = [doc_evidence(doc, doc_route.line)]

            if doc_route.path in by_path:
                routes = by_path[doc_route.path]
                methods = sorted({route.method for route in routes})
                evidence.extend(_route_evidence(index.root, routes[0]))
                result.findings.append(
                    make_finding(
                        check_id=self.check_id,
                        subject_key=f"{doc_route.doc_path}:{doc_route.method} {doc_route.path}",
                        title="HTTP method mismatch in API documentation",
                        summary=(
                            f"Docs describe `{doc_route.method} {doc_route.path}` "
                            f"but the route is defined as {', '.join(methods)}."
                        ),
                        status="verified",
                        severity="high",
                        confidence_note="The path matches a statically parsed route, but the HTTP method differs.",
                        documentation_claim=f"`{doc_route.method} {doc_route.path}`",
                        observed_fact=f"`{', '.join(methods)} {doc_route.path}`",
                        evidence=evidence,
                        limitations=list(LIMITATIONS),
                    )
                )
                continue

            closest = _closest(doc_route, discovered)
            if closest is not None:
                evidence.extend(_route_evidence(index.root, closest))

            unresolved = index.route_prefix_unresolved
            status = "insufficient_evidence" if unresolved else "verified"
            severity = "medium" if unresolved else "high"
            note = (
                "At least one router prefix could not be resolved statically, so the route may exist under a prefix."
                if unresolved
                else "No statically discoverable route matches this method and path."
            )
            result.findings.append(
                make_finding(
                    check_id=self.check_id,
                    subject_key=f"{doc_route.doc_path}:{doc_route.method} {doc_route.path}",
                    title="Documented API route was not found in source",
                    summary=f"Docs describe `{doc_route.method} {doc_route.path}`, which no scanned route defines.",
                    status=status,
                    severity=severity,
                    confidence_note=note,
                    documentation_claim=f"`{doc_route.method} {doc_route.path}`",
                    observed_fact=(
                        f"Closest discovered route: `{closest.method} {closest.path}`."
                        if closest
                        else "No routes were discoverable in the scanned Python files."
                    ),
                    evidence=evidence,
                    limitations=list(LIMITATIONS),
                )
            )
        return result


def _route_evidence(root, route: Route) -> list:
    """Decorator lines plus the router prefix declaration, so the path is provable."""
    items = [file_evidence(root, route.file, route.start_line, route.end_line)]
    if route.prefix_line:
        items.insert(0, file_evidence(root, route.file, route.prefix_line, route.prefix_line))
    return items


def _dedupe(routes: list[DocRoute]) -> list[DocRoute]:
    seen: set[tuple[str, str, str]] = set()
    unique: list[DocRoute] = []
    for route in routes:
        key = (route.method, route.path, route.doc_path)
        if key not in seen:
            seen.add(key)
            unique.append(route)
    return unique


def _closest(doc_route: DocRoute, routes: list[Route]) -> Route | None:
    if not routes:
        return None
    scored = [
        (
            difflib.SequenceMatcher(None, doc_route.path, route.path).ratio()
            + (0.25 if route.method == doc_route.method else 0),
            route,
        )
        for route in routes
    ]
    score, best = max(scored, key=lambda item: item[0])
    return best if score >= 0.5 else None
