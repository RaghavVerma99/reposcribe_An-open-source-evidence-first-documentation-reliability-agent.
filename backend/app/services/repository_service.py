"""Repository intake, manifest building, and overview."""

from __future__ import annotations

import hashlib
import shutil
import uuid
from pathlib import Path

from app.analyzers.common import RepoIndex, build_index
from app.analyzers.registry import CHECKS_SUPPORTED
from app.core.errors import AppError
from app.core.security import is_doc_file, is_secret_path, iter_files, safe_extract_zip
from app.core.settings import Settings
from app.schemas.models import ManifestEntry, Repository, RepositoryOverview, RouteInfo
from app.services.store import RepositoryState, Store, new_workspace, utcnow

LANGUAGES = {
    ".py": "Python",
    ".md": "Markdown",
    ".markdown": "Markdown",
    ".toml": "TOML",
    ".txt": "Text",
    ".json": "JSON",
    ".yaml": "YAML",
    ".yml": "YAML",
    ".cfg": "Config",
    ".ini": "Config",
    ".sh": "Shell",
    ".ps1": "PowerShell",
    ".ts": "TypeScript",
    ".tsx": "TypeScript",
    ".js": "JavaScript",
    ".css": "CSS",
    ".html": "HTML",
}


class RepositoryService:
    def __init__(self, settings: Settings, store: Store) -> None:
        self.settings = settings
        self.store = store

    def create_from_sample(self, session_id: str, sample_id: str = "fastapi-users") -> RepositoryState:
        if sample_id != "fastapi-users":
            raise AppError("invalid_request", f"Unknown sample repository '{sample_id}'.")
        source = self.settings.sample_repo_dir
        if not source.is_dir():
            raise AppError("internal_error", "The bundled sample repository is missing.", 500)
        return self._create(session_id, source.name, "sample", source)

    def create_from_upload(self, session_id: str, filename: str, data: bytes) -> RepositoryState:
        repository_id = f"repo_{uuid.uuid4().hex[:12]}"
        workspace, repo_dir, patch_dir = new_workspace(self.settings, repository_id)
        try:
            project_root, _ = safe_extract_zip(data, repo_dir, self.settings)
        except AppError:
            shutil.rmtree(workspace, ignore_errors=True)
            raise
        state = self._finalize(
            repository_id=repository_id,
            name=_safe_name(filename),
            source="upload",
            session_id=session_id,
            workspace=workspace,
            root=project_root,
            patch_dir=patch_dir,
        )
        self.store.register(state)
        return state

    def _create(self, session_id: str, name: str, source: str, origin: Path) -> RepositoryState:
        repository_id = f"repo_{uuid.uuid4().hex[:12]}"
        workspace, repo_dir, patch_dir = new_workspace(self.settings, repository_id)
        shutil.copytree(origin, repo_dir, dirs_exist_ok=True)
        state = self._finalize(
            repository_id=repository_id,
            name=name,
            source=source,
            session_id=session_id,
            workspace=workspace,
            root=repo_dir,
            patch_dir=patch_dir,
        )
        self.store.register(state)
        return state

    def _finalize(
        self,
        *,
        repository_id: str,
        name: str,
        source: str,
        session_id: str,
        workspace: Path,
        root: Path,
        patch_dir: Path,
    ) -> RepositoryState:
        state = RepositoryState(
            id=repository_id,
            name=name,
            source=source,
            session_id=session_id,
            workspace=workspace,
            root=root,
            patch_dir=patch_dir,
            created_at=utcnow(),
        )
        self.reindex(state)
        return state

    def reindex(self, state: RepositoryState) -> RepoIndex:
        state.status = "indexing"
        try:
            state.manifest = self._manifest(state.root)
            state.index = build_index(state.root)
            state.indexed_at = utcnow()
            state.status = "ready"
            state.limitations = [f"{path}: {reason}" for path, reason in state.index.skipped]
            return state.index
        except Exception as exc:  # pragma: no cover - defensive
            state.status = "failed"
            raise AppError("internal_error", f"Indexing failed: {exc}", 500) from exc

    def _manifest(self, root: Path) -> list[ManifestEntry]:
        entries: list[ManifestEntry] = []
        for rel, absolute, size in iter_files(root):
            language = _language(rel)
            entries.append(
                ManifestEntry(
                    path=rel,
                    size=size,
                    language=language,
                    is_doc=is_doc_file(rel),
                    secret=is_secret_path(rel),
                    sha256=_sha256(absolute),
                )
            )
        return entries

    def delete(self, state: RepositoryState) -> None:
        self.store.remove(state.id)

    def to_model(self, state: RepositoryState) -> Repository:
        findings = list(state.findings.values())
        return Repository(
            id=state.id,
            name=state.name,
            source=state.source,  # type: ignore[arg-type]
            status=state.status,
            created_at=state.created_at,
            files_indexed=len(state.manifest),
            docs_found=len(state.index.docs) if state.index else 0,
            findings_total=len(findings),
            last_audit_at=_last_audit(state),
        )

    def overview(self, state: RepositoryState) -> RepositoryOverview:
        index = state.index
        if index is None:
            raise AppError("internal_error", "Repository has not been indexed.", 500)
        languages: dict[str, int] = {}
        for entry in state.manifest:
            languages[entry.language] = languages.get(entry.language, 0) + 1
        by_status: dict[str, int] = {}
        for finding in state.findings.values():
            by_status[finding.status] = by_status.get(finding.status, 0) + 1
        return RepositoryOverview(
            repository_id=state.id,
            name=state.name,
            source=state.source,  # type: ignore[arg-type]
            status=state.status,
            file_count=len(state.manifest),
            docs_found=len(index.docs),
            doc_files=sorted(index.docs),
            languages=languages,
            routes=[
                RouteInfo(
                    method=route.method,
                    path=route.path,
                    handler=route.handler,
                    file=route.file,
                    start_line=route.start_line,
                    end_line=route.end_line,
                    prefix_resolved=route.prefix_resolved,
                )
                for route in index.routes
            ],
            checks_supported=list(CHECKS_SUPPORTED),
            findings_by_status=by_status,
            last_audit_at=_last_audit(state),
            indexed_at=state.indexed_at,
            limitations=list(state.limitations),
        )


def _language(rel: str) -> str:
    name = Path(rel).name
    if name == "Dockerfile":
        return "Dockerfile"
    return LANGUAGES.get(Path(name).suffix.lower(), "Other")


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with open(path, "rb") as handle:
        for chunk in iter(lambda: handle.read(65536), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _safe_name(filename: str | None) -> str:
    if not filename:
        return "uploaded-repository"
    cleaned = Path(filename).stem.strip().replace("\\", "-").replace("/", "-")
    return cleaned[:80] or "uploaded-repository"


def _last_audit(state: RepositoryState):
    if not state.audits:
        return None
    return max(audit.created_at for audit in state.audits.values())
