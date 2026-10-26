import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { useAppState } from "../../app/AppState";
import { api, ApiError } from "../../lib/api";
import { checkLabel, statusMeaning } from "../../lib/format";
import { useShell } from "../../lib/shell";
import { useAsync } from "../../lib/useAsync";
import { EvidenceList } from "../../components/evidence/EvidencePane";
import {
  Button,
  Card,
  ErrorNotice,
  PageHeader,
  SeverityBadge,
  Spinner,
  StatusBadge,
} from "../../components/ui/Primitives";

export default function FindingDetailPage() {
  const { repository } = useShell();
  const { findingId = "" } = useParams();
  const navigate = useNavigate();
  const { provider } = useAppState();
  const finding = useAsync(() => api.finding(repository.id, findingId), [repository.id, findingId]);
  const [creating, setCreating] = useState(false);
  const [actionError, setActionError] = useState<ApiError | null>(null);

  async function generateFix() {
    setCreating(true);
    setActionError(null);
    try {
      const patch = await api.createPatch(repository.id, findingId);
      navigate(`/r/${repository.id}/patches/${patch.id}`);
    } catch (caught) {
      setActionError(caught as ApiError);
    } finally {
      setCreating(false);
    }
  }

  async function setStatus(status: "dismissed" | "verified") {
    setActionError(null);
    try {
      await api.updateFinding(repository.id, findingId, status);
      finding.reload();
    } catch (caught) {
      setActionError(caught as ApiError);
    }
  }

  if (finding.state.status === "loading") {
    return (
      <div className="flex items-center gap-2 p-8 text-[13px] text-ink-muted">
        <Spinner className="text-accent-strong" /> Loading finding…
      </div>
    );
  }

  if (finding.state.status === "error" || !finding.state.data) {
    return (
      <div className="p-6">
        {finding.state.error ? <ErrorNotice error={finding.state.error} onRetry={finding.reload} /> : null}
        <p className="mt-4 text-[13px] text-ink-muted">
          <Link to={`/r/${repository.id}/findings`} className="font-medium text-accent-strong hover:underline">
            Back to findings
          </Link>
        </p>
      </div>
    );
  }

  const data = finding.state.data;
  const canPatch = !["resolved", "dismissed"].includes(data.status);

  return (
    <div>
      <PageHeader
        title={data.title}
        subtitle={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-medium text-ink-muted">{checkLabel(data.check_id)}</span>
            <span aria-hidden="true" className="text-line-strong">
              ·
            </span>
            <span className="font-mono text-ink-muted">{data.check_id}</span>
            <span aria-hidden="true" className="text-line-strong">
              ·
            </span>
            <span className="font-mono text-ink-muted">{repository.name}</span>
          </span>
        }
        actions={
          <>
            <Link
              to={`/r/${repository.id}/findings`}
              className="inline-flex h-9 items-center rounded-control border border-line bg-surface px-4 text-[13px] font-medium text-ink transition-colors hover:border-line-strong hover:bg-surface-elevated"
            >
              Back
            </Link>
            <Button
              variant="primary"
              onClick={generateFix}
              loading={creating}
              disabled={!canPatch}
              title={canPatch ? undefined : "Resolved and dismissed findings cannot be patched."}
            >
              Generate fix
            </Button>
          </>
        }
      />

      <div className="space-y-6 p-6">
        <Card className="flex flex-wrap items-center gap-3 px-5 py-3.5">
          <SeverityBadge severity={data.severity} />
          <StatusBadge status={data.status} />
          <span className="body-text flex-1">{statusMeaning(data.status)}</span>
          <span className="font-mono text-2xs text-ink-faint">{data.id}</span>
        </Card>

        {actionError ? <ErrorNotice error={actionError} /> : null}

        <Card className="px-5 py-4">
          <p className="text-[14px] leading-6 text-ink">{data.summary}</p>
          <p className="mt-3 text-2xs text-ink-muted">
            <span className="font-medium text-ink-muted">Why this confidence:</span> {data.confidence_note}
          </p>
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="px-5 py-4">
            <h2 className="text-2xs font-medium uppercase tracking-[0.08em] text-ink-faint">What the documentation claims</h2>
            <p className="mt-2 font-mono text-[13px] leading-6 text-ink">{data.documentation_claim ?? "Not extracted"}</p>
          </Card>
          <Card className="px-5 py-4">
            <h2 className="text-2xs font-medium uppercase tracking-[0.08em] text-ink-faint">What the repository contains</h2>
            <p className="mt-2 font-mono text-[13px] leading-6 text-ink">{data.observed_fact ?? "Not established"}</p>
          </Card>
        </div>

        <section>
          <h2 className="mb-3 text-h3 text-ink">Evidence</h2>
          <EvidenceList evidence={data.evidence} />
        </section>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="px-5 py-4">
            <h2 className="text-h3 text-ink">Scope and limitations</h2>
            {data.limitations.length ? (
              <ul className="mt-2 space-y-1.5 text-2xs text-ink-muted">
                {data.limitations.map((limitation, index) => (
                  <li key={index} className="flex gap-2">
                    <span aria-hidden="true">•</span>
                    <span>{limitation}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-2xs text-ink-muted">No additional limitations were recorded for this check.</p>
            )}
          </Card>

          <Card className="px-5 py-4">
            <h2 className="text-h3 text-ink">Reviewer actions</h2>
            <p className="body-text mt-2">
              {provider?.mode === "live"
                ? "A live provider drafts the patch text from the evidence above."
                : "Demo mode drafts the patch with deterministic rules derived from this finding's evidence."}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {data.status === "dismissed" ? (
                <Button onClick={() => setStatus("verified")}>Reopen finding</Button>
              ) : (
                <Button variant="danger" onClick={() => setStatus("dismissed")}>
                  Dismiss finding
                </Button>
              )}
            </div>
            {data.affected_paths.length ? (
              <p className="mt-3 font-mono text-2xs text-ink-faint">
                affected: {data.affected_paths.join(", ")}
              </p>
            ) : null}
          </Card>
        </div>

        <p className="text-2xs text-ink-faint">
          Nothing in RepoScribe writes to your repository. A patch is a draft you review, validate, and download.
        </p>
      </div>
    </div>
  );
}