"""Shared parsing and index structures.

Analyzers consume a read-only ``RepoIndex``. Nothing here executes repository
code; Python files are parsed with ``ast`` only.
"""

from __future__ import annotations

import ast
import json
import re
from dataclasses import dataclass, field, replace
from pathlib import Path, PurePosixPath

from app.core.security import is_doc_file, is_excluded, is_secret_path, iter_files

HEADING_RE = re.compile(r"^(#{1,6})\s+(.+?)\s*#*\s*$")
LINK_RE = re.compile(r"(?<!!)\[([^\]]*)\]\(\s*([^)\s]+?)(?:\s+[\"'][^\"']*[\"'])?\s*\)")
CODE_SPAN_RE = re.compile(r"`([^`\n]+)`")
EXTERNAL_RE = re.compile(r"^(?:[a-z][a-z0-9+.-]*:|//)", re.IGNORECASE)
METHODS = {"get", "post", "put", "patch", "delete", "head", "options"}
METHOD_NAMES = {m.upper() for m in METHODS}
ROUTE_LINE_RE = re.compile(r"^(?:[-*+]\s+|\d+\.\s+|\$\s+)?([A-Z]{3,7})\s+(/[^\s`'\"]*)")
ENV_ASSIGN_RE = re.compile(r"^([A-Z][A-Z0-9_]{2,})\s*=")
PATHLIKE_RE = re.compile(r"^[\w./-]+\.(?:py|md|json|ya?ml|toml|txt|cfg|ini|env|sh|ps1|js|ts|tsx|html|css)$", re.IGNORECASE)
DOTTED_RE = re.compile(r"^[A-Za-z_][\w]*(?:\.[A-Za-z_][\w]*)+$")


def read_text(path: Path) -> str | None:
    try:
        data = path.read_bytes()
    except OSError:
        return None
    if len(data) > 2 * 1024 * 1024:
        return None
    for encoding in ("utf-8", "utf-8-sig", "latin-1"):
        try:
            return data.decode(encoding)
        except UnicodeDecodeError:
            continue
    return None


def slugify_heading(text: str) -> str:
    """Approximate GitHub heading anchors."""
    lowered = text.strip().lower()
    lowered = re.sub(r"`", "", lowered)
    lowered = re.sub(r"[^\w\s-]", "", lowered)
    lowered = re.sub(r"\s+", "-", lowered)
    return lowered.strip("-")


@dataclass(frozen=True)
class Heading:
    text: str
    level: int
    line: int
    slug: str


@dataclass(frozen=True)
class DocLink:
    source_path: str
    line: int
    raw: str
    target: str
    anchor: str
    external: bool
    resolved_path: str | None
    exists: bool
    missing_anchor: bool


@dataclass(frozen=True)
class DocRoute:
    method: str
    path: str
    doc_path: str
    line: int


@dataclass(frozen=True)
class CodeSpan:
    text: str
    line: int


@dataclass
class Table:
    header: list[str]
    rows: list[list[str]]
    line: int


@dataclass
class DocFile:
    path: str
    text: str
    lines: list[str]
    headings: list[Heading]
    links: list[DocLink]
    code_spans: list[CodeSpan]
    code_lines: list[tuple[int, str]] = field(default_factory=list)
    tables: list[Table] = field(default_factory=list)


@dataclass(frozen=True)
class Symbol:
    name: str
    kind: str
    path: str
    module: str
    start_line: int
    end_line: int
    public: bool


@dataclass(frozen=True)
class Route:
    method: str
    path: str
    handler: str
    file: str
    start_line: int
    end_line: int
    prefix_resolved: bool = True
    prefix_line: int | None = None


@dataclass
class PyFile:
    path: str
    text: str
    symbols: list[Symbol] = field(default_factory=list)
    routes: list[Route] = field(default_factory=list)
    env_refs: list[tuple[str, int]] = field(default_factory=list)
    route_prefix_unresolved: bool = False
    parse_error: str | None = None


def _is_inside_fence(flags: list[bool], index: int) -> bool:
    return flags[index]


def parse_doc(path: str, text: str, docs: dict[str, "DocFile"], root: Path) -> DocFile:
    lines = text.splitlines()
    headings: list[Heading] = []
    links: list[DocLink] = []
    code_spans: list[CodeSpan] = []
    code_lines: list[tuple[int, str]] = []
    tables: list[Table] = []
    fence_flags = [False] * len(lines)

    fence: str | None = None
    for idx, line in enumerate(lines):
        stripped = line.strip()
        if fence is None and stripped.startswith(("```", "~~~")):
            fence = stripped[:3]
            fence_flags[idx] = True
            continue
        if fence is not None:
            fence_flags[idx] = True
            if stripped.startswith(fence):
                fence = None
            else:
                code_lines.append((idx + 1, line))
            continue

    for idx, line in enumerate(lines):
        if fence_flags[idx]:
            continue
        heading = HEADING_RE.match(line)
        if heading:
            headings.append(
                Heading(
                    text=heading.group(2).strip(),
                    level=len(heading.group(1)),
                    line=idx + 1,
                    slug=slugify_heading(heading.group(2)),
                )
            )

    # Links are resolved after every heading is known, so anchors later in the
    # document do not look missing.
    for idx, line in enumerate(lines):
        if fence_flags[idx]:
            continue
        for span in CODE_SPAN_RE.finditer(line):
            code_spans.append(CodeSpan(text=span.group(1).strip(), line=idx + 1))
        for match in LINK_RE.finditer(line):
            target = match.group(2).strip()
            links.append(_resolve_link(path, idx + 1, target, docs, root, headings))

    tables = _parse_tables(lines, fence_flags)
    return DocFile(
        path=path,
        text=text,
        lines=lines,
        headings=headings,
        links=links,
        code_spans=code_spans,
        code_lines=code_lines,
        tables=tables,
    )


def _resolve_link(
    source: str,
    line: int,
    target: str,
    docs: dict[str, DocFile],
    root: Path,
    headings: list[Heading],
) -> DocLink:
    if EXTERNAL_RE.match(target):
        return DocLink(source, line, target, target, "", True, None, True, False)

    path_part, _, anchor = target.partition("#")
    path_part = path_part.split("?", 1)[0]
    anchor = anchor.strip().lower()

    if not path_part:
        slug_map = _slug_map(headings)
        return DocLink(source, line, target, target, anchor, False, source, True, bool(anchor and anchor not in slug_map))

    resolved = _resolve_relative(source, path_part)
    if resolved is None:
        return DocLink(source, line, target, target, anchor, False, None, False, False)

    absolute = root / resolved
    exists = absolute.exists()
    missing_anchor = False
    if exists and anchor and resolved.lower().endswith((".md", ".markdown")):
        target_doc = docs.get(resolved)
        if target_doc is None:
            text = read_text(absolute)
            target_doc = parse_doc(resolved, text or "", docs, root)
        slugs = _slug_map(target_doc.headings)
        missing_anchor = anchor not in slugs
    return DocLink(source, line, target, target, anchor, False, resolved, exists, missing_anchor)


def _slug_map(headings: list[Heading]) -> set[str]:
    seen: dict[str, int] = {}
    slugs: set[str] = set()
    for heading in headings:
        base = heading.slug
        count = seen.get(base, 0)
        slug = base if count == 0 else f"{base}-{count}"
        seen[base] = count + 1
        slugs.add(slug)
    return slugs


def _resolve_relative(source: str, target: str) -> str | None:
    base = PurePosixPath(source).parent
    combined: list[str] = []
    for part in (base / target).parts:
        if part in ("", "."):
            continue
        if part == "..":
            if not combined:
                return None
            combined.pop()
            continue
        combined.append(part)
    if not combined:
        return None
    return "/".join(combined)


def _parse_tables(lines: list[str], fence_flags: list[bool]) -> list[Table]:
    tables: list[Table] = []
    idx = 0
    while idx < len(lines) - 1:
        line = lines[idx].strip()
        nxt = lines[idx + 1].strip()
        if (
            not fence_flags[idx]
            and line.startswith("|")
            and nxt.startswith("|")
            and re.fullmatch(r"\|[\s:|-]+\|", nxt)
        ):
            header = [cell.strip() for cell in line.strip("|").split("|")]
            rows: list[list[str]] = []
            cursor = idx + 2
            while cursor < len(lines) and lines[cursor].strip().startswith("|"):
                rows.append([cell.strip() for cell in lines[cursor].strip().strip("|").split("|")])
                cursor += 1
            tables.append(Table(header=header, rows=rows, line=idx + 1))
            idx = cursor
            continue
        idx += 1
    return tables


def extract_doc_routes(doc: DocFile) -> list[DocRoute]:
    routes: list[DocRoute] = []
    for table in doc.tables:
        normalized = [cell.lower() for cell in table.header]
        method_col = next(
            (i for i, cell in enumerate(normalized) if cell in {"method", "http method", "verb"}),
            None,
        )
        path_col = next(
            (i for i, cell in enumerate(normalized) if cell in {"endpoint", "path", "route", "url"}),
            None,
        )
        if method_col is None or path_col is None:
            continue
        for offset, row in enumerate(table.rows):
            if method_col >= len(row) or path_col >= len(row):
                continue
            method = row[method_col].strip().strip("`*").upper()
            path = row[path_col].strip().strip("`*")
            if method in METHOD_NAMES and path.startswith("/"):
                routes.append(DocRoute(method, path, doc.path, table.line + 2 + offset))
    for line_no, raw in doc.code_lines:
        match = ROUTE_LINE_RE.match(raw.strip())
        if match and match.group(1) in METHOD_NAMES and match.group(2).startswith("/"):
            routes.append(DocRoute(match.group(1), match.group(2).rstrip(".,;"), doc.path, line_no))
    return routes


def parse_openapi(path: str, text: str) -> list[DocRoute]:
    try:
        payload = json.loads(text)
    except (json.JSONDecodeError, TypeError):
        return []
    routes: list[DocRoute] = []
    paths = payload.get("paths") if isinstance(payload, dict) else None
    if not isinstance(paths, dict):
        return routes
    for route_path, operations in paths.items():
        if not isinstance(operations, dict):
            continue
        for method in operations:
            if method.lower() in METHODS and isinstance(route_path, str) and route_path.startswith("/"):
                routes.append(DocRoute(method.upper(), route_path, path, 1))
    return routes


def _module_name(path: str) -> str:
    stem = path[:-3] if path.endswith(".py") else path
    parts = [part for part in stem.split("/") if part not in ("__init__",)]
    return ".".join(parts)


def _decorator_route(node: ast.AST) -> tuple[str, str, str] | None:
    if not isinstance(node, ast.Call) or not isinstance(node.func, ast.Attribute):
        return None
    base = node.func.value
    if not isinstance(base, ast.Name):
        return None
    attr = node.func.attr
    if attr in METHODS:
        if not node.args or not isinstance(node.args[0], ast.Constant) or not isinstance(node.args[0].value, str):
            return None
        return base.id, attr.upper(), node.args[0].value
    if attr == "api_route":
        if not node.args or not isinstance(node.args[0], ast.Constant) or not isinstance(node.args[0].value, str):
            return None
        methods: list[str] = []
        for keyword in node.keywords:
            if keyword.arg == "methods" and isinstance(keyword.value, (ast.List, ast.Tuple)):
                for element in keyword.value.elts:
                    if isinstance(element, ast.Constant) and isinstance(element.value, str):
                        methods.append(element.value.upper())
        if not methods:
            return None
        return base.id, ",".join(sorted(methods)), node.args[0].value
    return None


def _router_prefixes(tree: ast.AST) -> dict[str, tuple[str | None, int]]:
    """Map router variable -> (prefix or None when unresolvable, declaration line)."""
    prefixes: dict[str, tuple[str | None, int]] = {}
    for node in ast.walk(tree):
        if not isinstance(node, ast.Assign) or len(node.targets) != 1:
            continue
        target = node.targets[0]
        if not isinstance(target, ast.Name) or not isinstance(node.value, ast.Call):
            continue
        func = node.value.func
        if isinstance(func, ast.Name) and func.id == "APIRouter":
            prefix = ""
            for keyword in node.value.keywords:
                if keyword.arg == "prefix" and isinstance(keyword.value, ast.Constant) and isinstance(keyword.value.value, str):
                    prefix = keyword.value.value
            prefixes[target.id] = (prefix, node.lineno)
    for node in ast.walk(tree):
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute) and node.func.attr == "include_router":
            if node.args and isinstance(node.args[0], ast.Name):
                name = node.args[0].id
                extra = ""
                for keyword in node.keywords:
                    if keyword.arg == "prefix" and isinstance(keyword.value, ast.Constant) and isinstance(keyword.value.value, str):
                        extra = keyword.value.value
                if name in prefixes and prefixes[name][0] is not None:
                    prefixes[name] = ((prefixes[name][0] or "") + extra, prefixes[name][1])
                else:
                    prefixes[name] = (None, node.lineno)
    return prefixes


def parse_python(path: str, text: str) -> PyFile:
    result = PyFile(path=path, text=text)
    try:
        tree = ast.parse(text)
    except SyntaxError as exc:
        result.parse_error = f"{exc.msg} (line {exc.lineno})"
        return result

    module = _module_name(path)
    prefixes = _router_prefixes(tree)
    module_unresolved = any(value is None for value, _ in prefixes.values())

    for node in tree.body:
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            result.symbols.append(
                Symbol(node.name, "function", path, module, node.lineno, getattr(node, "end_lineno", node.lineno) or node.lineno, not node.name.startswith("_"))
            )
        elif isinstance(node, ast.ClassDef):
            result.symbols.append(
                Symbol(node.name, "class", path, module, node.lineno, getattr(node, "end_lineno", node.lineno) or node.lineno, not node.name.startswith("_"))
            )

    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            for decorator in node.decorator_list:
                parsed = _decorator_route(decorator)
                if parsed is None:
                    continue
                base, method, route_path = parsed
                resolved = True
                prefix = ""
                prefix_line: int | None = None
                if base in prefixes:
                    value, declaration_line = prefixes[base]
                    if value is None:
                        resolved = False
                    else:
                        prefix = value
                        prefix_line = declaration_line if value else None
                elif base not in ("app", "application"):
                    resolved = False
                if not resolved:
                    result.route_prefix_unresolved = True
                    continue
                start_line = min(
                    node.lineno, *(item.lineno for item in node.decorator_list)
                )
                for single_method in method.split(","):
                    result.routes.append(
                        Route(
                            method=single_method,
                            path=_join_path(prefix, route_path),
                            handler=node.name,
                            file=path,
                            start_line=start_line,
                            end_line=getattr(node, "end_lineno", node.lineno) or node.lineno,
                            prefix_resolved=True,
                            prefix_line=prefix_line,
                        )
                    )
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute):
            if node.func.attr in {"getenv", "get"} and isinstance(node.func.value, ast.Name) and node.func.value.id == "os":
                if node.args and isinstance(node.args[0], ast.Constant) and isinstance(node.args[0].value, str):
                    result.env_refs.append((node.args[0].value, node.lineno))
            if node.func.attr == "get" and isinstance(node.func.value, ast.Attribute) and node.func.value.attr == "environ":
                if node.args and isinstance(node.args[0], ast.Constant) and isinstance(node.args[0].value, str):
                    result.env_refs.append((node.args[0].value, node.lineno))
        if isinstance(node, ast.Subscript) and isinstance(node.value, ast.Attribute) and node.value.attr == "environ":
            slice_node = node.slice
            if isinstance(slice_node, ast.Constant) and isinstance(slice_node.value, str):
                result.env_refs.append((slice_node.value, node.lineno))

    if module_unresolved:
        result.route_prefix_unresolved = True
    return result


def _join_path(prefix: str, path: str) -> str:
    joined = "/" + "/".join(part.strip("/") for part in (prefix, path) if part.strip("/"))
    return joined or "/"


@dataclass
class RepoIndex:
    root: Path
    docs: dict[str, DocFile]
    py_files: dict[str, PyFile]
    doc_routes: list[DocRoute]
    openapi_routes: list[DocRoute]
    env_example_keys: set[str]
    skipped: list[tuple[str, str]] = field(default_factory=list)
    scanned_files: int = 0

    @property
    def symbols(self) -> list[Symbol]:
        return [symbol for py_file in self.py_files.values() for symbol in py_file.symbols]

    @property
    def routes(self) -> list[Route]:
        return [route for py_file in self.py_files.values() for route in py_file.routes]

    @property
    def env_defined(self) -> dict[str, list[tuple[str, int]]]:
        defined: dict[str, list[tuple[str, int]]] = {key: [(".env.example", 0)] for key in self.env_example_keys}
        for py_file in self.py_files.values():
            for key, line in py_file.env_refs:
                defined.setdefault(key, []).append((py_file.path, line))
        return defined

    @property
    def route_prefix_unresolved(self) -> bool:
        return any(py_file.route_prefix_unresolved for py_file in self.py_files.values())

    @property
    def documented_routes(self) -> list[DocRoute]:
        return [*self.doc_routes, *self.openapi_routes]

    def with_doc_override(self, path: str, text: str) -> "RepoIndex":
        docs = dict(self.docs)
        pending = {path: text}
        docs[path] = parse_doc(path, text, docs, self.root)
        doc_routes: list[DocRoute] = []
        for doc in docs.values():
            doc_routes.extend(extract_doc_routes(doc))
        return replace(self, docs=docs, doc_routes=doc_routes)


def build_index(root: Path, doc_overrides: dict[str, str] | None = None) -> RepoIndex:
    """Parse the repository into an index without executing any of it."""
    overrides = doc_overrides or {}
    docs: dict[str, DocFile] = {}
    py_files: dict[str, PyFile] = {}
    env_example_keys: set[str] = set()
    skipped: list[tuple[str, str]] = []
    scanned = 0

    raw_docs: dict[str, str] = {}
    for rel, absolute, size in iter_files(root):
        scanned += 1
        if is_secret_path(rel) or size == 0:
            continue
        if rel.lower().endswith((".md", ".markdown")):
            text = overrides.get(rel, read_text(absolute))
            if text is None:
                skipped.append((rel, "unreadable or too large"))
                continue
            raw_docs[rel] = text
        elif rel.endswith(".py"):
            text = read_text(absolute)
            if text is None:
                skipped.append((rel, "unreadable or too large"))
                continue
            py_file = parse_python(rel, text)
            if py_file.parse_error:
                skipped.append((rel, f"parse error: {py_file.parse_error}"))
            py_files[rel] = py_file

    for rel, text in raw_docs.items():
        docs[rel] = parse_doc(rel, text, docs, root)

    env_path = root / ".env.example"
    if env_path.is_file():
        text = read_text(env_path) or ""
        for line in text.splitlines():
            match = ENV_ASSIGN_RE.match(line.strip())
            if match:
                env_example_keys.add(match.group(1))

    doc_routes: list[DocRoute] = []
    for doc in docs.values():
        doc_routes.extend(extract_doc_routes(doc))
    openapi_routes: list[DocRoute] = []
    for rel in list(docs) + [p for p in _all_files(root) if p.lower().endswith(".json")]:
        if rel.endswith("openapi.json"):
            text = overrides.get(rel) or read_text(root / rel)
            if text:
                openapi_routes.extend(parse_openapi(rel, text))

    return RepoIndex(
        root=root,
        docs=docs,
        py_files=py_files,
        doc_routes=doc_routes,
        openapi_routes=openapi_routes,
        env_example_keys=env_example_keys,
        skipped=skipped,
        scanned_files=scanned,
    )


def _all_files(root: Path) -> list[str]:
    return [rel for rel, _, _ in iter_files(root)]


def excerpt(lines: list[str], start: int, end: int | None = None, limit: int = 40) -> str:
    start = max(1, start)
    end = min(len(lines), end or start)
    if end < start:
        end = start
    end = min(end, start + limit - 1)
    return "\n".join(lines[start - 1 : end])


def line_of(text: str, needle: str) -> tuple[int, int] | None:
    lines = text.splitlines()
    for idx, line in enumerate(lines):
        if needle in line:
            return idx + 1, idx + 1
    return None


def is_doc(rel: str) -> bool:
    return is_doc_file(rel) and not is_excluded(rel)
