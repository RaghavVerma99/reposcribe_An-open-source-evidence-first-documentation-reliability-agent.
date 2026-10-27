"""SQLite persistence for repository state.

The in-memory ``Store`` remains the request-path cache; this module is the
durable copy. It stores the current findings, every audit snapshot, patches,
validations, and the dismissed set. The repository index itself is not stored:
it is rebuilt from the workspace on demand, which keeps the database small and
lets an index-format change ship without a migration.

SQLite is deliberately the only dependency. One worker owns the file, writes
are serialized with a lock, and WAL mode lets a reader (a second process or a
new ``Store`` in a test) open the same file safely.
"""

from __future__ import annotations

import json
import sqlite3
import threading
from datetime import datetime
from pathlib import Path

from app.schemas.models import (
    AuditRun,
    Finding,
    ManifestEntry,
    PatchDraft,
    ValidationResult,
)
from app.services.store import RepositoryState


SCHEMA = """
CREATE TABLE IF NOT EXISTS repositories (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    name TEXT NOT NULL,
    source TEXT NOT NULL,
    status TEXT NOT NULL,
    workspace TEXT NOT NULL,
    root TEXT NOT NULL,
    patch_dir TEXT NOT NULL,
    created_at TEXT NOT NULL,
    last_accessed_at TEXT NOT NULL,
    indexed_at TEXT,
    manifest_json TEXT NOT NULL,
    scan_limitations_json TEXT NOT NULL,
    check_limitations_json TEXT NOT NULL,
    dismissed_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS findings (
    id TEXT NOT NULL,
    repository_id TEXT NOT NULL,
    data_json TEXT NOT NULL,
    -- Finding ids are content-derived, so the same defect in two repositories
    -- has the same id. The repository is part of the key.
    PRIMARY KEY (repository_id, id)
);
CREATE INDEX IF NOT EXISTS findings_repository ON findings(repository_id);

CREATE TABLE IF NOT EXISTS audits (
    id TEXT PRIMARY KEY,
    repository_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    data_json TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS audits_repository ON audits(repository_id, created_at);

CREATE TABLE IF NOT EXISTS patches (
    id TEXT PRIMARY KEY,
    repository_id TEXT NOT NULL,
    data_json TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS patches_repository ON patches(repository_id);

CREATE TABLE IF NOT EXISTS validations (
    patch_id TEXT PRIMARY KEY,
    data_json TEXT NOT NULL
);
"""


class StateDB:
    """Durable state for one process. Safe for the threadpool FastAPI uses."""

    def __init__(self, path: Path) -> None:
        self.path = path
        path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.RLock()
        self._conn = sqlite3.connect(str(path), check_same_thread=False)
        self._conn.row_factory = sqlite3.Row
        with self._lock, self._conn:
            self._conn.execute("PRAGMA journal_mode=WAL")
            self._conn.execute("PRAGMA synchronous=NORMAL")
            self._conn.executescript(SCHEMA)

    # -- restore -----------------------------------------------------------

    def load_all(self) -> dict[str, RepositoryState]:
        with self._lock:
            states: dict[str, RepositoryState] = {}
            for row in self._conn.execute("SELECT * FROM repositories"):
                states[row["id"]] = RepositoryState(
                    id=row["id"],
                    name=row["name"],
                    source=row["source"],
                    session_id=row["session_id"],
                    workspace=Path(row["workspace"]),
                    root=Path(row["root"]),
                    patch_dir=Path(row["patch_dir"]),
                    created_at=datetime.fromisoformat(row["created_at"]),
                    status=row["status"],
                    last_accessed_at=datetime.fromisoformat(row["last_accessed_at"]),
                    manifest=[
                        ManifestEntry.model_validate(item)
                        for item in json.loads(row["manifest_json"])
                    ],
                    indexed_at=(
                        datetime.fromisoformat(row["indexed_at"]) if row["indexed_at"] else None
                    ),
                    scan_limitations=json.loads(row["scan_limitations_json"]),
                    check_limitations=json.loads(row["check_limitations_json"]),
                    dismissed=set(json.loads(row["dismissed_json"])),
                )

            for row in self._conn.execute("SELECT * FROM findings"):
                state = states.get(row["repository_id"])
                if state is not None:
                    state.findings[row["id"]] = Finding.model_validate_json(row["data_json"])

            for row in self._conn.execute("SELECT * FROM audits"):
                state = states.get(row["repository_id"])
                if state is not None:
                    audit = AuditRun.model_validate_json(row["data_json"])
                    state.audits[audit.id] = audit

            for row in self._conn.execute("SELECT * FROM patches"):
                state = states.get(row["repository_id"])
                if state is not None:
                    patch = PatchDraft.model_validate_json(row["data_json"])
                    state.patches[patch.id] = patch

            patch_owner = {
                row["id"]: row["repository_id"]
                for row in self._conn.execute("SELECT id, repository_id FROM patches")
            }
            for row in self._conn.execute("SELECT * FROM validations"):
                repository_id = patch_owner.get(row["patch_id"])
                state = states.get(repository_id) if repository_id else None
                if state is not None:
                    validation = ValidationResult.model_validate_json(row["data_json"])
                    state.validations[validation.patch_id] = validation

            return states

    # -- writes ------------------------------------------------------------

    def persist(self, state: RepositoryState) -> None:
        """Replace the durable copy of one repository in a single transaction."""
        with self._lock, self._conn:
            self._conn.execute(
                """
                INSERT INTO repositories (
                    id, session_id, name, source, status, workspace, root, patch_dir,
                    created_at, last_accessed_at, indexed_at, manifest_json,
                    scan_limitations_json, check_limitations_json, dismissed_json
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    session_id=excluded.session_id,
                    name=excluded.name,
                    source=excluded.source,
                    status=excluded.status,
                    workspace=excluded.workspace,
                    root=excluded.root,
                    patch_dir=excluded.patch_dir,
                    last_accessed_at=excluded.last_accessed_at,
                    indexed_at=excluded.indexed_at,
                    manifest_json=excluded.manifest_json,
                    scan_limitations_json=excluded.scan_limitations_json,
                    check_limitations_json=excluded.check_limitations_json,
                    dismissed_json=excluded.dismissed_json
                """,
                (
                    state.id,
                    state.session_id,
                    state.name,
                    state.source,
                    state.status,
                    str(state.workspace),
                    str(state.root),
                    str(state.patch_dir),
                    state.created_at.isoformat(),
                    state.last_accessed_at.isoformat(),
                    state.indexed_at.isoformat() if state.indexed_at else None,
                    json.dumps([entry.model_dump() for entry in state.manifest]),
                    json.dumps(state.scan_limitations),
                    json.dumps(state.check_limitations),
                    json.dumps(sorted(state.dismissed)),
                ),
            )

            self._conn.execute("DELETE FROM findings WHERE repository_id = ?", (state.id,))
            self._conn.executemany(
                "INSERT INTO findings (id, repository_id, data_json) VALUES (?, ?, ?)",
                [
                    (finding.id, state.id, finding.model_dump_json())
                    for finding in state.findings.values()
                ],
            )

            self._conn.execute("DELETE FROM audits WHERE repository_id = ?", (state.id,))
            self._conn.executemany(
                "INSERT INTO audits (id, repository_id, created_at, data_json) VALUES (?, ?, ?, ?)",
                [
                    (audit.id, state.id, audit.created_at.isoformat(), audit.model_dump_json())
                    for audit in state.audits.values()
                ],
            )

            self._conn.execute(
                "DELETE FROM validations WHERE patch_id IN "
                "(SELECT id FROM patches WHERE repository_id = ?)",
                (state.id,),
            )
            self._conn.execute("DELETE FROM patches WHERE repository_id = ?", (state.id,))
            self._conn.executemany(
                "INSERT INTO patches (id, repository_id, data_json) VALUES (?, ?, ?)",
                [
                    (patch.id, state.id, patch.model_dump_json())
                    for patch in state.patches.values()
                ],
            )
            self._conn.executemany(
                "INSERT INTO validations (patch_id, data_json) VALUES (?, ?)",
                [
                    (validation.patch_id, validation.model_dump_json())
                    for validation in state.validations.values()
                ],
            )

    def touch(self, repository_id: str, when: datetime) -> None:
        with self._lock, self._conn:
            self._conn.execute(
                "UPDATE repositories SET last_accessed_at = ? WHERE id = ?",
                (when.isoformat(), repository_id),
            )

    def delete(self, repository_id: str) -> None:
        with self._lock, self._conn:
            self._conn.execute(
                "DELETE FROM validations WHERE patch_id IN "
                "(SELECT id FROM patches WHERE repository_id = ?)",
                (repository_id,),
            )
            self._conn.execute(
                "DELETE FROM patches WHERE repository_id = ?", (repository_id,)
            )
            self._conn.execute(
                "DELETE FROM audits WHERE repository_id = ?", (repository_id,)
            )
            self._conn.execute(
                "DELETE FROM findings WHERE repository_id = ?", (repository_id,)
            )
            self._conn.execute("DELETE FROM repositories WHERE id = ?", (repository_id,))

    def close(self) -> None:
        with self._lock:
            self._conn.close()
