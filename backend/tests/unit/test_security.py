"""Unit tests for untrusted-input handling (T-01, T-02, T-SEC-01, T-SEC-02, T-12)."""

from __future__ import annotations

import io
import zipfile

import pytest

from app.core.errors import AppError
from app.core.security import (
    contains_secret,
    is_doc_file,
    is_excluded,
    is_secret_path,
    redact,
    safe_extract_zip,
    sanitize_rel_path,
)
from tests.conftest import make_zip


def test_sanitize_rejects_traversal() -> None:
    with pytest.raises(AppError) as error:
        sanitize_rel_path("../outside.txt")
    assert error.value.code == "unsafe_archive_entry"


def test_sanitize_rejects_absolute_and_drive_paths() -> None:
    for candidate in ("/etc/passwd", "C:/windows/system32", "c:\\temp\\x.txt"):
        with pytest.raises(AppError):
            sanitize_rel_path(candidate)


def test_sanitize_normalizes_backslashes() -> None:
    assert sanitize_rel_path("docs\\api.md") == "docs/api.md"


def test_excluded_paths() -> None:
    assert is_excluded("node_modules/left-pad/index.js")
    assert is_excluded("app/__pycache__/mod.pyc")
    assert is_excluded(".git/config")
    assert not is_excluded("app/main.py")


def test_doc_detection() -> None:
    assert is_doc_file("README.md")
    assert is_doc_file("docs/guide.markdown")
    assert not is_doc_file("app/main.py")


def test_secret_path_detection() -> None:
    assert is_secret_path(".env")
    assert is_secret_path(".env.production")
    assert is_secret_path("certs/server.pem")
    assert not is_secret_path(".env.example")


def test_redaction_removes_assigned_secrets() -> None:
    text = "SECRET_KEY=abc123\nDATABASE_URL=sqlite:///app.db"
    cleaned = redact(text)
    assert "abc123" not in cleaned
    assert "[redacted]" in cleaned
    assert "sqlite:///app.db" in cleaned


def test_contains_secret_detects_key_material() -> None:
    assert contains_secret("-----BEGIN RSA PRIVATE KEY-----\nMIIE")
    assert not contains_secret("no secrets here")


def test_zip_traversal_is_rejected(tmp_path, settings) -> None:
    payload = make_zip({"../../outside.txt": "pwned"})
    with pytest.raises(AppError) as error:
        safe_extract_zip(payload, tmp_path / "dest", settings)
    assert error.value.code == "unsafe_archive_entry"
    assert not (tmp_path / "outside.txt").exists()


def test_zip_absolute_entry_is_rejected(tmp_path, settings) -> None:
    payload = make_zip({"/tmp/abs.txt": "pwned"})
    with pytest.raises(AppError):
        safe_extract_zip(payload, tmp_path / "dest", settings)


def test_zip_symlink_is_rejected(tmp_path, settings) -> None:
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as archive:
        info = zipfile.ZipInfo("link")
        info.external_attr = (0o120777 << 16)
        archive.writestr(info, "target")
    with pytest.raises(AppError) as error:
        safe_extract_zip(buffer.getvalue(), tmp_path / "dest", settings)
    assert error.value.code == "unsafe_archive_entry"


def test_zip_entry_count_limit(tmp_path, monkeypatch) -> None:
    monkeypatch.setenv("MAX_EXTRACTED_FILES", "3")
    from app.core import settings as settings_module

    settings_module.get_settings.cache_clear()
    small = settings_module.get_settings()
    payload = make_zip({f"file{i}.txt": "x" for i in range(6)})
    with pytest.raises(AppError) as error:
        safe_extract_zip(payload, tmp_path / "dest", small)
    assert error.value.code == "payload_too_large"
    settings_module.get_settings.cache_clear()


def test_zip_size_limit(tmp_path, monkeypatch) -> None:
    monkeypatch.setenv("MAX_UPLOAD_MB", "1")
    from app.core import settings as settings_module

    settings_module.get_settings.cache_clear()
    small = settings_module.get_settings()
    with pytest.raises(AppError) as error:
        safe_extract_zip(b"x" * (2 * 1024 * 1024), tmp_path / "dest", small)
    assert error.value.code == "payload_too_large"
    settings_module.get_settings.cache_clear()


def test_non_zip_payload_is_rejected(tmp_path, settings) -> None:
    with pytest.raises(AppError) as error:
        safe_extract_zip(b"not a zip", tmp_path / "dest", settings)
    assert error.value.code == "invalid_archive"


def test_zip_with_single_root_is_collapsed(tmp_path, settings) -> None:
    payload = make_zip({"project/README.md": "# hi", "project/app.py": "x = 1\n"})
    root, count = safe_extract_zip(payload, tmp_path / "dest", settings)
    assert count == 2
    assert root.name == "project"
    assert (root / "README.md").is_file()