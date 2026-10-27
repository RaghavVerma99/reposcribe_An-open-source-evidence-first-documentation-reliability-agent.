"""In-memory repository and session registry with workspace lifecycle."""

from __future__ import annotations

import shutil
import threading
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from pathlib import Path

from app.analyzers.common import RepoIndex
from app.core.settings import Settings
from app.schemas.models import (
    AuditRun,
    Finding,
    ManifestEntry,
    PatchDraft,
    RepoStatus,
    ValidationResult,
)


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


@dataclass
class RepositoryState:
    id: str
    name: str
    source: str
    session_id: str
    workspace: Path
    root: Path
    patch_dir: Path
    created_at: datetime
    status: RepoStatus = "created"
    last_accessed_at: datetime = field(default_factory=utcnow)
    manifest: list[ManifestEntry] = field(default_factory=list)
    index: RepoIndex | None = None
    indexed_at: datetime | None = None
    audits: dict[str, AuditRun] = field(default_factory=dict)
    findings: dict[str, Finding] = field(default_factory=dict)
    patches: dict[str, PatchDraft] = field(default_factory=dict)
    validations: dict[str, ValidationResult] = field(default_factory=dict)
    dismissed: set[str] = field(default_factory=set)
    # One audit at a time per repository; the API returns 409 rather than
    # interleaving two result sets over the same mutable state.
    audit_lock: threading.Lock = field(default_factory=threading.Lock, repr=False, compare=False)
    # Issues surfaced during indexing (e.g. files that could not be parsed or read).
    # Populated by repository_service.reindex. Never overwritten by an audit.
    scan_limitations: list[str] = field(default_factory=list)
    # Issues surfaced by the analyzers (check scope caveats + per-analyzer skipped files).
    # Populated by AuditService.run. Reset on each audit.
    check_limitations: list[str] = field(default_factory=list)


class Store:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._repos: dict[str, RepositoryState] = {}
        self._lock = threading.RLock()

    def register(self, state: RepositoryState) -> None:
        with self._lock:
            state.last_accessed_at = utcnow()
            self._repos[state.id] = state

    def get(self, repository_id: str, session_id: str | None = None) -> RepositoryState | None:
        # The sweep takes its own short lock section, so a slow directory
        # removal never blocks this lookup.
        self.sweep_expired()
        with self._lock:
            state = self._repos.get(repository_id)
            if state is None:
                return None
            if session_id is not None and state.session_id != session_id:
                return None
            state.last_accessed_at = utcnow()
            return state

    def remove(self, repository_id: str) -> bool:
        with self._lock:
            state = self._repos.pop(repository_id, None)
        if state is None:
            return False
        shutil.rmtree(state.workspace, ignore_errors=True)
        return True

    def count(self) -> int:
        with self._lock:
            return len(self._repos)

    def sweep_expired(self) -> int:
        """Forget expired repositories and delete their workspaces.

        The dict is updated under the lock (so an expired repository is never
        handed out again), but the directory removal happens outside it: a
        large tree must not stall every other request.
        """
        ttl = timedelta(minutes=self._settings.workspace_ttl_minutes)
        cutoff = utcnow() - ttl
        with self._lock:
            expired_ids = [key for key, state in self._repos.items() if state.last_accessed_at < cutoff]
            states = [self._repos.pop(key) for key in expired_ids]
        removed = 0
        for state in states:
            if shutil.rmtree(state.workspace, ignore_errors=True) is None:
                removed += 1
        return removed


def sweep_orphan_workspaces(settings) -> list[str]:
    """Remove workspace directories that no registered repository owns.

    Session state lives in memory, so after a crash or restart every directory
    on disk belongs to nobody. Left alone they leak irrecoverably, because the
    TTL sweep only knows about registered sessions. Multi-worker deployments
    are not supported until state becomes external (Phase 5): one worker would
    delete another's live workspaces here.
    """
    root = Path(settings.workspace_root)
    if not root.is_dir():
        return []
    removed: list[str] = []
    for entry in root.iterdir():
        if not entry.is_dir():
            continue
        shutil.rmtree(entry, ignore_errors=True)
        removed.append(entry.name)
    return removed


def new_workspace(settings: Settings, repository_id: str) -> tuple[Path, Path, Path]:
    base = settings.ensure_workspace_root() / repository_id
    workspace = base
    repo_dir = base / "repo"
    patch_dir = base / "patch"
    repo_dir.mkdir(parents=True, exist_ok=True)
    patch_dir.mkdir(parents=True, exist_ok=True)
    return workspace, repo_dir, patch_dir


def new_id(prefix: str, seed: str) -> str:
    import hashlib

    return f"{prefix}_{hashlib.sha256(seed.encode()).hexdigest()[:12]}"


def ensure_utc(value: datetime) -> datetime:
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
