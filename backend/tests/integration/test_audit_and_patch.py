"""End-to-end audit and patch workflow (T-13..T-19, T-20, T-22)."""

from __future__ import annotations

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


def test_patch_target_must_be_documentation(sample_state) -> None:
    service, state = sample_state
    source_finding = Finding(
        id="fnd_source_target",
        check_id="markdown.internal_link_exists",
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