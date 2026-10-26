"""Untrusted-input handling: ZIP extraction, path safety, secret redaction.

Every guard in SPEC 18 lives here so it can be unit tested independently.
"""

from __future__ import annotations

import re
import zipfile
from io import BytesIO
from pathlib import Path, PurePosixPath

from app.core.errors import AppError
from app.core.settings import Settings

MB = 1024 * 1024

EXCLUDED_DIRS = {
    ".git", "node_modules", ".venv", "venv", "dist", "build", "__pycache__",
    ".pytest_cache", ".mypy_cache", ".ruff_cache", ".idea", ".vscode",
    "coverage", "htmlcov", ".next", "target", ".tox", ".eggs",
}
EXCLUDED_SUFFIXES = {
    ".pyc", ".pyo", ".so", ".dll", ".dylib", ".exe", ".bin", ".zip", ".tar",
    ".gz", ".7z", ".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico", ".woff",
    ".woff2", ".ttf", ".eot", ".mp4", ".mov", ".pdf", ".lockb",
}
DOC_SUFFIXES = {".md", ".markdown"}
DOC_NAMES = {"readme.md", "contributing.md", "changelog.md", "license.md"}

SECRET_NAMES = {"id_rsa", "id_ed25519", "id_dsa", "credentials", "secrets", ".netrc", ".npmrc"}
SECRET_SUFFIXES = {".pem", ".key", ".p12", ".pfx", ".keystore", ".jks"}

SECRET_CONTENT_PATTERNS = [
    re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----"),
    re.compile(r"\bAKIA[0-9A-Z]{16}\b"),
    re.compile(r"\bgh[pousr]_[A-Za-z0-9]{20,}\b"),
    re.compile(r"\bsk-[A-Za-z0-9]{20,}\b"),
]

SENSITIVE_ASSIGNMENT = re.compile(
    r"(?i)\b([A-Z0-9_]*(?:SECRET|TOKEN|PASSWORD|PASSWD|API_KEY|PRIVATE_KEY|CREDENTIAL)[A-Z0-9_]*)"
    r"\s*=\s*([^\s#]+)"
)


def sanitize_rel_path(path: str) -> str:
    """Return a normalized relative POSIX path, or raise on anything unsafe."""
    candidate = path.replace("\\", "/").strip()
    if not candidate or candidate.startswith("/") or re.match(r"^[A-Za-z]:", candidate):
        raise AppError("unsafe_archive_entry", "Archive contains an absolute path.")
    parts = [p for p in PurePosixPath(candidate).parts if p not in ("", ".")]
    if any(p == ".." for p in parts):
        raise AppError("unsafe_archive_entry", "Archive contains a path traversal entry.")
    if not parts:
        raise AppError("unsafe_archive_entry", "Archive contains an empty entry name.")
    return "/".join(parts)


def is_within(base: Path, candidate: Path) -> bool:
    try:
        candidate.resolve().relative_to(base.resolve())
        return True
    except ValueError:
        return False


def is_excluded(rel_path: str) -> bool:
    parts = PurePosixPath(rel_path).parts
    if any(part in EXCLUDED_DIRS for part in parts[:-1]):
        return True
    name = parts[-1].lower()
    if name in EXCLUDED_DIRS:
        return True
    return PurePosixPath(name).suffix in EXCLUDED_SUFFIXES


def is_doc_file(rel_path: str) -> bool:
    lowered = rel_path.lower()
    name = PurePosixPath(lowered).name
    if name in DOC_NAMES:
        return True
    if PurePosixPath(lowered).suffix in DOC_SUFFIXES:
        return True
    return lowered.startswith("docs/") and name.endswith((".md", ".markdown"))


def is_secret_path(rel_path: str) -> bool:
    lowered = rel_path.lower()
    name = PurePosixPath(lowered).name
    if name == ".env.example" or name == ".env.sample":
        return False
    if name == ".env" or name.startswith(".env."):
        return True
    if name in SECRET_NAMES:
        return True
    return PurePosixPath(name).suffix in SECRET_SUFFIXES


def contains_secret(text: str) -> bool:
    return any(pattern.search(text) for pattern in SECRET_CONTENT_PATTERNS)


def redact(text: str) -> str:
    """Remove secret-shaped values from text that may reach a client or model."""
    redacted = SENSITIVE_ASSIGNMENT.sub(lambda m: f"{m.group(1)}=[redacted]", text)
    for pattern in SECRET_CONTENT_PATTERNS:
        redacted = pattern.sub("[redacted]", redacted)
    return redacted


def _entry_is_symlink(info: zipfile.ZipInfo) -> bool:
    return (info.external_attr >> 16) & 0o170000 == 0o120000


def safe_extract_zip(data: bytes, dest: Path, settings: Settings) -> tuple[Path, int]:
    """Extract an untrusted archive into ``dest``.

    Returns the project root (inside ``dest``) and the number of files written.
    Raises AppError for every rejected archive condition.
    """
    limit = settings.max_upload_mb * MB
    if len(data) > limit:
        raise AppError("payload_too_large", f"Upload exceeds the {settings.max_upload_mb} MB limit.", 413)

    try:
        archive = zipfile.ZipFile(BytesIO(data))
    except zipfile.BadZipFile as exc:
        raise AppError("invalid_archive", "The uploaded file is not a valid ZIP archive.") from exc

    dest.mkdir(parents=True, exist_ok=True)
    total = 0
    written = 0
    max_files = settings.max_extracted_files
    max_file = settings.max_file_mb * MB
    max_total = settings.max_extracted_mb * MB

    try:
        infos = archive.infolist()
    except Exception as exc:  # pragma: no cover - corrupt central directory
        raise AppError("invalid_archive", "The ZIP archive could not be read.") from exc

    if len(infos) > max_files:
        raise AppError("payload_too_large", f"Archive contains more than {max_files} entries.", 413)

    for info in infos:
        if info.is_dir():
            continue
        if info.flag_bits & 0x1:
            raise AppError("invalid_archive", "Encrypted archives are not supported.")
        if _entry_is_symlink(info):
            raise AppError("unsafe_archive_entry", "Archive contains a symbolic link.")

        rel = sanitize_rel_path(info.filename)
        if info.file_size > max_file:
            raise AppError("payload_too_large", f"A file exceeds the {settings.max_file_mb} MB per-file limit.", 413)
        if info.compress_size > 0 and info.file_size > MB:
            ratio = info.file_size / max(info.compress_size, 1)
            if ratio > 1000:
                raise AppError("payload_too_large", "Archive contains a suspiciously compressed entry.", 413)

        total += info.file_size
        if total > max_total:
            raise AppError("payload_too_large", "Archive exceeds the total extracted size limit.", 413)

        target = dest / rel
        if not is_within(dest, target):
            raise AppError("unsafe_archive_entry", "Archive entry resolves outside the workspace.")

        target.parent.mkdir(parents=True, exist_ok=True)
        with archive.open(info) as source, open(target, "wb") as sink:
            remaining = max_file + 1
            while chunk := source.read(min(64 * 1024, remaining)):
                sink.write(chunk)
                remaining -= len(chunk)
                if remaining <= 0:
                    raise AppError("payload_too_large", "An extracted file exceeded its size limit.", 413)
        written += 1

    if written == 0:
        raise AppError("invalid_archive", "The archive contains no files.")

    return _project_root(dest), written


def _project_root(dest: Path) -> Path:
    """Collapse a single wrapping directory so the project root is stable."""
    entries = [p for p in dest.iterdir() if p.name != "__MACOSX"]
    if len(entries) == 1 and entries[0].is_dir():
        return entries[0]
    return dest


def iter_files(root: Path):
    """Yield (relative path, absolute path, size) for non-excluded files."""
    for path in sorted(root.rglob("*")):
        if not path.is_file():
            continue
        rel = path.relative_to(root).as_posix()
        if is_excluded(rel):
            continue
        yield rel, path, path.stat().st_size
