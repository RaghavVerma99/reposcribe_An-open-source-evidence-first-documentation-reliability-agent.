import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { useAppState } from "../../app/AppState";
import { api, ApiError } from "../../lib/api";
import { checkLabel, statusMeaning } from "../../lib/format";
import { useShell } from "../../lib/shell";
import { useAsync } from "../../lib/useAsync";
import { usePageTitle } from "../../lib/usePageTitle";
import type { Finding } from "../../lib/types";
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

const secondaryLink =
  "inline-flex h-9 items-center rounded-control border border-line bg-surface px-4 text-[13px] font-medium text-ink transition-colors hover:border-line-strong hover:bg-surface-elevated";

type ReopenStatus = "verified" | "needs_review" | "insufficient_evidence";

/** Restore what the reviewer dismissed; never invent a stronger or weaker status. */
function reopenStatus(finding: Finding): ReopenStatus {
  const previous = finding.status_before_dismissal;
  return previous === "verified" || previous === "insufficient_evidence"
    ? previous
    : "needs_review";
}

export default function FindingDetailPage() {
  const { repository } = useShell();
  const { findingId = "" } = useParams();
  const navigate = useNavigate();
  const { provider } = useAppState();
  const finding = useAsync(() => api.finding(repository.id, findingId), [repository.id, findingId]);
  const [creating, setCreating] = useState(false);
  const [statusBusy, setStatusBusy] = useState<ReopenStatus | "dismissed" | null>(null);
  const [actionError, setActionError] = useState<ApiError | null>(null);
  usePageTitle(finding.state.data ? finding.state.data.title : "Finding");

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

  async function setStatus(
    status: "dismissed" | "verified" | "needs_review" | "insufficient_evidence",
    revision: number,
  ) {
    setStatusBusy(status);
    setActionError(null);
    try {
      await api.updateFinding(repository.id, findingId, status, revision);
      finding.reload();
    } catch (caught) {
      setActionError(caught as ApiError);
    } finally {
      setStatusBusy(null);
    }
  }

  if (finding.state.status === "loading") {
    return (
      <div className="flex items-center gap-2 p-6 text-[13px] text-ink-muted sm:p-8">
        <Spinner className="text-accent-strong" /> Loading finding…
      </div>
    );
  }

  if (finding.state.status === "error" || !finding.state.data) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        {finding.state.error ? (
          <ErrorNotice error={finding.state.error} onRetry={finding.reload} />
        ) : null}
        <p className="mt-4 text-[13px] text-ink-muted">
          <Link
            to={`/r/${repository.id}/findings`}
            className="font-medium text-accent-strong hover:underline"
          >
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
            <Link to={`/r/${repository.id}/findings`} className={secondaryLink}>
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

      <div className="space-y-6 p-4 sm:p-6 lg:p-8">
        <Card className="flex flex-wrap items-center gap-3 px-5 py-3.5">
          <SeverityBadge severity={data.severity} />
          <StatusBadge status={data.status} />
          <p className="min-w-0 flex-1 text-2xs leading-5 text-ink-muted">
            {statusMeaning(data.status)}
          </p>
          <span className="font-mono text-2xs text-ink-faint">{data.id}</span>
        </Card>

        {actionError ? <ErrorNotice error={actionError} onDismiss={() => setActionError(null)} /> : null}

        <Card className="px-5 py-5">
          <p className="eyebrow">Finding</p>
          <p className="mt-2 max-w-3xl text-[15px] leading-7 text-ink">{data.summary}</p>
          <p className="mt-4 border-t border-line pt-3 text-2xs leading-5 text-ink-muted">
            <span className="font-medium text-ink">Confidence.</span> {data.confidence_note}
          </p>
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="px-5 py-4">
            <div className="flex items-center gap-2">
              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-ink-faint" />
              <h2 className="eyebrow">Documentation claims</h2>
            </div>
            <p className="mt-3 rounded-control border border-line bg-canvas px-3.5 py-3 font-mono text-[12.5px] leading-6 text-ink">
              {data.documentation_claim ?? (
                <span className="font-sans text-ink-faint">Not extracted from the documentation.</span>
              )}
            </p>
          </Card>
          <Card className="px-5 py-4">
            <div className="flex items-center gap-2">
              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-accent" />
              <h2 className="eyebrow">Repository contains</h2>
            </div>
            <p className="mt-3 rounded-control border border-line bg-canvas px-3.5 py-3 font-mono text-[12.5px] leading-6 text-ink">
              {data.observed_fact ?? (
                <span className="font-sans text-ink-faint">Not established by the checks.</span>
              )}
            </p>
          </Card>
        </div>

        <section aria-labelledby="evidence-heading">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 id="evidence-heading" className="text-h3 text-ink">
                Evidence
              </h2>
              <p className="mt-1 text-2xs text-ink-faint">
                Retrieved from the indexed snapshot. Nothing here is inferred from a file name.
              </p>
            </div>
            <span className="font-mono text-2xs text-ink-faint">
              {data.evidence.length} excerpt{data.evidence.length === 1 ? "" : "s"}
            </span>
          </div>
          <EvidenceList evidence={data.evidence} />
        </section>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="px-5 py-4">
            <h2 className="text-h3 text-ink">Scope and limitations</h2>
            {data.limitations.length ? (
              <ul className="mt-3 space-y-2 text-2xs leading-5 text-ink-muted">
                {data.limitations.map((limitation, index) => (
                  <li key={index} className="flex gap-2.5">
                    <span
                      aria-hidden="true"
                      className="mt-2 h-1 w-1 shrink-0 rounded-full bg-warn"
                    />
                    <span>{limitation}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-2xs leading-5 text-ink-muted">
                No additional limitations were recorded for this check.
              </p>
            )}
          </Card>

          <Card className="px-5 py-4">
            <h2 className="text-h3 text-ink">Reviewer actions</h2>
            <p className="body-text mt-3">
              {!provider
                ? "Checking the provider before drafting…"
                : provider.mode === "live"
                  ? "A live provider drafts the patch text from the evidence above."
                  : provider.mode === "unavailable"
                    ? provider.message ||
                      "The provider is unavailable. Drafts come from the deterministic rules only."
                    : "Demo mode drafts the patch with deterministic rules derived from this finding's evidence."}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {data.status === "dismissed" ? (
                <Button
                  onClick={() => setStatus(reopenStatus(data), data.revision)}
                  loading={statusBusy === reopenStatus(data)}
                  disabled={statusBusy !== null}
                >
                  Reopen finding
                </Button>
              ) : (
                <Button
                  variant="danger"
                  onClick={() => setStatus("dismissed", data.revision)}
                  loading={statusBusy === "dismissed"}
                  disabled={statusBusy !== null}
                >
                  Dismiss finding
                </Button>
              )}
              {canPatch ? (
                <Button variant="ghost" onClick={generateFix} loading={creating}>
                  Generate draft fix
                </Button>
              ) : null}
            </div>
            {data.affected_paths.length ? (
              <p className="mt-4 border-t border-line pt-3 font-mono text-2xs leading-5 text-ink-faint">
                affected: {data.affected_paths.join(", ")}
              </p>
            ) : null}
          </Card>
        </div>

        <p className="flex items-start gap-2 text-2xs leading-5 text-ink-faint">
          <svg
            viewBox="0 0 16 16"
            className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent-strong"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M8 1.75 13.25 4.25v6.5L8 13.25 2.75 10.75v-6.5Z" />
            <path d="m5.6 8.5 1.8 1.8 3.2-3.5" />
          </svg>
          Nothing in RepoScribe writes to your repository. A patch is a draft you review, validate,
          and download.
        </p>
      </div>
    </div>
  );
}
