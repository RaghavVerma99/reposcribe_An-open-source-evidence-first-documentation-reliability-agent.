"""End-to-end audit and patch workflow (T-13..T-19, T-20, T-22)."""

from __future__ import annotations

import io
import zipfile

import pytest

from app.core.errors import AppError
from app.schemas.models import EvidenceRef, Finding
from app.services.audit_service import AuditService
from app.services.patch_service import PatchService


def _route_finding(state):
    audit = AuditService().run(state)
    return next(
        finding
        for finding in audit.findings
        if finding.check_id == "fastapi.route_matches_docs" and finding.status == "verified"
    ), audit


def test_sample_audit_finds_seeded_drift(sample_state) -> None:
    _, state = sample_state
    audit = AuditService().run(state)

    assert audit.status == "completed"
    assert not audit.checks_skipped
    assert audit.summary.verified >= 5
    checks = {finding.check_id for finding in audit.findings}
    assert checks == {
        "markdown.internal_link_exists",
        "docs.file_reference_exists",
        "fastapi.route_matches_docs",
        "config.env_var_documented",
        "python.public_symbol_referenced",
        "docs.readme_checklist",
    }


def test_route_finding_points_at_real_lines(sample_state) -> None:
    _, state = sample_state
    finding, _ = _route_finding(state)

    doc_evidence = [item for item in finding.evidence if item.role == "documentation"]
    source_evidence = [item for item in finding.evidence if item.role == "source"]
    assert doc_evidence and source_evidence
    assert "/api/users" in doc_evidence[0].excerpt
    assert finding.observed_fact and "/api/v2/users" in finding.observed_fact
    assert any('prefix="/api/v2"' in item.excerpt for item in source_evidence)
    assert any('@router.get("/users"' in item.excerpt for item in source_evidence)
    assert doc_evidence[0].start_line and doc_evidence[0].start_line > 0
    assert doc_evidence[0].path in finding.affected_paths


def test_finding_ids_are_stable_across_runs(sample_state) -> None:
    _, state = sample_state
    first = {finding.id for finding in AuditService().run(state).findings}
    second = {finding.id for finding in AuditService().run(state).findings}
    assert first == second


def test_patch_fixes_the_route_and_validates(sample_state) -> None:
    service, state = sample_state
    finding, _ = _route_finding(state)
    patches = PatchService(service.settings)

    patch = patches.create(state, finding.id)
    assert "/api/v2/users" in patch.diff
    assert patch.target_path == "docs/api.md"
    assert patch.mode == "local_demo"

    result = patches.validate(state, patch.id)
    assert result.outcome == "passed"
    assert all(step.outcome == "passed" for step in result.steps)


def test_validation_detects_a_patch_that_does_not_fix(sample_state) -> None:
    service, state = sample_state
    finding, _ = _route_finding(state)
    patches = PatchService(service.settings)
    patch = patches.create(state, finding.id)

    unfixed = patch.model_copy(
        update={"id": "pat_unfixed", "proposed_content": patch.original_content + "\n<!-- note -->\n"}
    )
    state.patches[unfixed.id] = unfixed

    result = patches.validate(state, unfixed.id)
    assert result.outcome == "failed"
    steps = {step.id: step for step in result.steps}
    assert steps["V-3"].outcome == "failed"


def _route_finding_in(state, doc_path: str):
    return next(
        finding
        for finding in AuditService().run(state).findings
        if finding.check_id == "fastapi.route_matches_docs"
        and finding.documentation_claim == "`GET /api/users`"
        and finding.evidence[0].path == doc_path
    )


def test_route_patch_only_rewrites_the_finding_it_fixes(sample_state) -> None:
    """A patch for `GET /api/users` must not rewrite the `DELETE` row beside it.

    Rewriting every line that contains the old path turned
    `DELETE /api/users/{user_id}` into `DELETE /api/v2/users/{user_id}`, a route
    the source never defines.
    """
    service, state = sample_state
    finding = _route_finding_in(state, "docs/api.md")
    patch = PatchService(service.settings).create(state, finding.id)

    assert "| `GET` | `/api/v2/users` |" in patch.proposed_content
    assert "| `DELETE` | `/api/users/{user_id}` |" in patch.proposed_content
    assert "/api/v2/users/{user_id}" not in patch.proposed_content


def test_validation_ignores_pre_existing_broken_links(sample_state) -> None:
    """A sound patch must not fail because the document already had a bad link."""
    service, state = sample_state
    finding = _route_finding_in(state, "README.md")
    patches = PatchService(service.settings)
    patch = patches.create(state, finding.id)

    result = patches.validate(state, patch.id)
    steps = {step.id: step for step in result.steps}
    assert steps["V-4"].outcome == "passed", steps["V-4"].detail
    assert "pre-existing" in steps["V-4"].detail
    assert result.outcome == "passed"


def test_validation_rejects_a_patch_that_introduces_new_drift(sample_state) -> None:
    """Fixing one claim while inventing another must fail V-3.

    Before this check, validation compared only the originating finding, so a
    draft that repaired `GET /api/users` and rewrote the `DELETE` row to
    `DELETE /api/v2/users/{user_id}` (no such route) passed all six steps.
    """
    service, state = sample_state
    finding = _route_finding_in(state, "docs/api.md")
    patches = PatchService(service.settings)
    patch = patches.create(state, finding.id)

    regressed = patch.model_copy(
        update={
            "id": "pat_introduces_drift",
            "proposed_content": patch.proposed_content.replace(
                "/api/users/{user_id}", "/api/v2/users/{user_id}"
            ),
        }
    )
    assert regressed.proposed_content != patch.proposed_content
    state.patches[regressed.id] = regressed

    result = patches.validate(state, regressed.id)
    steps = {step.id: step for step in result.steps}
    assert steps["V-3"].outcome == "failed", steps["V-3"].detail
    assert "introduces" in steps["V-3"].detail
    assert "DELETE /api/v2/users/{user_id}" in steps["V-3"].detail
    assert result.outcome == "failed"


def test_validation_rejects_a_patch_that_adds_a_broken_link(sample_state) -> None:
    """V-4 fails on links the patch breaks, even when others were already broken."""
    service, state = sample_state
    finding = _route_finding_in(state, "README.md")
    patches = PatchService(service.settings)
    patch = patches.create(state, finding.id)

    regressed = patch.model_copy(
        update={
            "id": "pat_breaks_link",
            "proposed_content": patch.proposed_content.replace(
                "(docs/api.md)", "(docs/renamed-api.md)"
            ),
        }
    )
    assert regressed.proposed_content != patch.proposed_content
    state.patches[regressed.id] = regressed

    result = patches.validate(state, regressed.id)
    steps = {step.id: step for step in result.steps}
    assert steps["V-4"].outcome == "failed", steps["V-4"].detail
    assert "docs/renamed-api.md" in steps["V-4"].detail
    assert result.outcome == "failed"


def test_patch_target_must_be_documentation(sample_state) -> None:
    service, state = sample_state
    source_finding = Finding(
        id="fnd_source_target",
        check_id="markdown.internal_link_exists",
        subject_key="README.md:docs/setup.md",
        title="Source target",
        summary="Evidence points at source code.",
        status="verified",
        severity="low",
        confidence_note="test",
        evidence=[EvidenceRef(path="app/main.py", start_line=1, end_line=1, excerpt="x", role="documentation")],
    )
    state.findings[source_finding.id] = source_finding

    with pytest.raises(AppError) as error:
        PatchService(service.settings).create(state, source_finding.id)
    assert error.value.code == "patch_target_forbidden"


def test_unknown_ids_raise_not_found(sample_state) -> None:
    service, state = sample_state
    patches = PatchService(service.settings)
    with pytest.raises(AppError) as error:
        patches.create(state, "fnd_does_not_exist")
    assert error.value.code == "finding_not_found"
    with pytest.raises(AppError) as error:
        patches.get(state, "pat_does_not_exist")
    assert error.value.code == "patch_not_found"


def test_dismissed_findings_stay_dismissed(sample_state) -> None:
    _, state = sample_state
    audits = AuditService()
    finding, _ = _route_finding(state)

    audits.set_status(state, finding.id, "dismissed")
    rerun = audits.run(state)
    persisted = next(item for item in rerun.findings if item.id == finding.id)
    assert persisted.status == "dismissed"
    assert rerun.summary.dismissed == 1


def test_partial_audit_when_a_check_is_unknown(sample_state) -> None:
    _, state = sample_state
    with pytest.raises(AppError):
        AuditService().run(state, ["not.a.real.check"])


def test_resolved_findings_are_reported(sample_state) -> None:
    service, state = sample_state
    audits = AuditService()
    first = audits.run(state)
    link_finding = next(
        finding for finding in first.findings if finding.check_id == "markdown.internal_link_exists"
    )

    readme = state.root / "README.md"
    readme.write_text(
        readme.read_text(encoding="utf-8").replace(
            "[Setup guide](docs/setup.md)", "the setup guide"
        ),
        encoding="utf-8",
    )
    service.reindex(state)
    rerun = audits.run(state)

    resolved = next(finding for finding in rerun.findings if finding.id == link_finding.id)
    assert resolved.status == "resolved"
    assert rerun.summary.resolved >= 1


def test_scan_limitations_survive_audit_run() -> None:
    """#10: the first audit must not erase parse-skip limitations reported
    during the index step. Before the split, the audit service overwrote
    ``state.limitations`` with check caveats, dropping the scan-skipped list."""
    from fastapi.testclient import TestClient

    from app.main import create_app

    payload = _zip_with_broken_python()
    c = TestClient(create_app())
    repo = c.post(
        "/api/v1/repositories", files={"file": ("r.zip", payload, "application/zip")}
    ).json()
    overview_before = c.get(f"/api/v1/repositories/{repo['id']}/overview").json()
    parse_skips_before = [
        l for l in overview_before["limitations"] if "app/main.py" in l
    ]
    assert parse_skips_before, "scan limitation must be present immediately after indexing"

    c.post(f"/api/v1/repositories/{repo['id']}/audits")
    overview_after = c.get(f"/api/v1/repositories/{repo['id']}/overview").json()
    parse_skips_after = [
        l for l in overview_after["limitations"] if "app/main.py" in l
    ]
    assert parse_skips_after, (
        "scan limitation must still be present after the audit runs "
        "(this was the regression that the limitations split fixes)"
    )


def _zip_with_broken_python() -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        z.writestr("README.md", "# App\n\n## Installation\n\npytest\n")
        z.writestr("app/main.py", "def broken(:\n")
    return buf.getvalue()


def test_chk02_skips_instructional_paths_but_flags_real_gaps() -> None:
    """#7: CHK-02 must not fire on lines like 'Create `myapp.py`', and must
    still fire when the doc describes an existing-but-missing file."""
    import io
    import zipfile

    from fastapi.testclient import TestClient

    from app.main import create_app

    def zip_of(files: dict[str, str]) -> bytes:
        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, "w") as z:
            for n, t in files.items():
                z.writestr(n, t)
        return buffer.getvalue()

    test_client = TestClient(create_app())

    # Case A — instructional path on a clean repo must NOT fire.
    files_clean = {
        "README.md": (
            "# App\n\n"
            "## Installation\n\n"
            "Run `pytest`. Create `myapp.py` and add the following:\n\n"
            "```python\nprint('hello')\n```\n"
        ),
        "app.py": "x = 1\n",
    }
    repo_a = test_client.post(
        "/api/v1/repositories", files={"file": ("a.zip", zip_of(files_clean), "application/zip")}
    ).json()
    audit_a = test_client.post(f"/api/v1/repositories/{repo_a['id']}/audits").json()
    instructional_findings = [
        f for f in audit_a["findings"] if f["check_id"] == "docs.file_reference_exists"
    ]
    assert instructional_findings == [], (
        "CHK-02 must skip 'Create `myapp.py`' — it is asking the reader to author the file"
    )

    # Case B — doc says the file is "existing" but it's missing -> MUST fire.
    files_existing = {
        "README.md": (
            "# App\n\n"
            "## Configuration\n\n"
            "The existing `scripts/seed.py` is loaded automatically. "
            "The current `config/loading.py` registers the parser.\n"
        ),
        "app.py": "x = 1\n",
    }
    repo_b = test_client.post(
        "/api/v1/repositories", files={"file": ("b.zip", zip_of(files_existing), "application/zip")}
    ).json()
    audit_b = test_client.post(f"/api/v1/repositories/{repo_b['id']}/audits").json()
    missing_findings = [
        f
        for f in audit_b["findings"]
        if f["check_id"] == "docs.file_reference_exists" and f["status"] == "verified"
    ]
    assert missing_findings, "CHK-02 must still fire when the doc describes the file as existing"

    # Case C — the word "repository" alone must not suppress a real gap.
    files_repository = {
        "README.md": (
            "# App\n\n"
            "## Setup\n\n"
            "This repository's setup notes call `scripts/seed.py`.\n"
        ),
        "app.py": "x = 1\n",
    }
    repo_c = test_client.post(
        "/api/v1/repositories",
        files={"file": ("c.zip", zip_of(files_repository), "application/zip")},
    ).json()
    audit_c = test_client.post(f"/api/v1/repositories/{repo_c['id']}/audits").json()
    repository_word_findings = [
        f
        for f in audit_c["findings"]
        if f["check_id"] == "docs.file_reference_exists" and f["status"] == "verified"
    ]
    assert repository_word_findings, (
        "CHK-02 must not treat the noun 'repository' as proof that a missing file exists"
    )