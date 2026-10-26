import { useState } from "react";
import { Link, useParams } from "react-router-dom";

import { api, ApiError } from "../../lib/api";
import { useShell } from "../../lib/shell";
import { useAsync } from "../../lib/useAsync";
import { DiffSummary, DiffViewer, ValidationChecklist } from "../../components/diff/DiffViewer";
import { Badge, Button, Card, ErrorNotice, PageHeader, Spinner } from "../../components/ui/Primitives";

const downloadClass =
  "inline-flex h-8 items-center rounded-control border border-line bg-surface px-3 text-[13px] font-medium text-ink transition-colors hover:border-line-strong hover:bg-surface-elevated";

export default function PatchPage() {
  const { repository } = useShell();
  const { patchId = "" } = useParams();
  const detail = useAsync(() => api.patch(repository.id, patchId), [repository.id, patchId]);
  const [validating, setValidating] = useState(false);
  const [validation, setValidation] = useState<Awaited<ReturnType<typeof api.validatePatch>> | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  async function validate() {
    setValidating(true);
    setError(null);
    try {
      const result = await api.validatePatch(repository.id, patchId);
      setValidation(result);
    } catch (caught) {
      setError(caught as ApiError);
    } finally {
      setValidating(false);
    }
  }

  if (detail.state.status === "loading") {
    return (
      <div className="flex items-center gap-2 p-8 text-[13px] text-ink-muted">
        <Spinner className="text-accent-strong" /> Loading patch…
      </div>
    );
  }

  if (detail.state.status === "error" || !detail.state.data) {
    return (
      <div className="p-6">
        {detail.state.error ? <ErrorNotice error={detail.state.error} onRetry={detail.reload} /> : null}
        <p className="mt-4 text-[13px] text-ink-muted">
          <Link to={`/r/${repository.id}/findings`} className="font-medium text-accent-strong hover:underline">
            Back to findings
          </Link>
        </p>
      </div>
    );
  }

  const patch = detail.state.data.patch;
  const existingValidation = validation ?? detail.state.data.validation;

  return (
    <div>
      <PageHeader
        title="Patch review"
        subtitle={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-mono text-ink-muted">{patch.target_path}</span>
            <span aria-hidden="true" className="text-line-strong">
              ·
            </span>
            finding <span className="font-mono text-ink-muted">{patch.finding_id}</span>
            <span aria-hidden="true" className="text-line-strong">
              ·
            </span>
            <span className="font-mono text-ink-muted">{repository.name}</span>
          </span>
        }
        actions={
          <>
            <Link
              to={`/r/${repository.id}/findings/${patch.finding_id}`}
              className={downloadClass}
            >
              View finding
            </Link>
            <Button variant="primary" onClick={validate} loading={validating}>
              Validate patch
            </Button>
          </>
        }
      />

      <div className="space-y-6 p-6">
        {error ? <ErrorNotice error={error} onRetry={validate} /> : null}

        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={patch.mode === "live" ? "ok" : "info"}>{patch.mode} mode</Badge>
          <span className="text-2xs text-ink-muted">
            <DiffSummary diff={patch.diff} />
          </span>
          {existingValidation ? (
            <Badge tone={existingValidation.outcome === "passed" ? "ok" : existingValidation.outcome === "failed" ? "danger" : "warn"}>
              validation {existingValidation.outcome.replace(/_/g, " ")}
            </Badge>
          ) : (
            <Badge tone="neutral">not validated yet</Badge>
          )}
        </div>

        <Card className="px-5 py-4">
          <h2 className="text-h3 text-ink">Rationale</h2>
          <p className="body-text mt-2">{patch.rationale}</p>
          {patch.limitations.length ? (
            <ul className="mt-3 space-y-1.5 text-2xs text-ink-muted">
              {patch.limitations.map((limitation, index) => (
                <li key={index} className="flex gap-2">
                  <span aria-hidden="true">•</span>
                  <span>{limitation}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </Card>

        <section>
          <h2 className="mb-3 text-h3 text-ink">Proposed change</h2>
          <DiffViewer diff={patch.diff} />
        </section>

        <ValidationChecklist result={existingValidation} />

        <Card className="px-5 py-4">
          <h2 className="text-h3 text-ink">Export</h2>
          <p className="body-text mt-2">
            The original repository is untouched. Download the patch for review, or the revised Markdown to apply
            yourself.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <a className={downloadClass} href={api.downloadUrl(repository.id, patch.id, "patch")} download>
              Download patch
            </a>
            <a className={downloadClass} href={api.downloadUrl(repository.id, patch.id, "markdown")} download>
              Download updated file
            </a>
          </div>
          <p className="mt-3 text-2xs text-ink-faint">
            Applying a patch to the repository in place is not implemented in this build, so no control pretends to do
            it.
          </p>
        </Card>
      </div>
    </div>
  );
}