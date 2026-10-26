import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { api, ApiError } from "../../lib/api";
import { useShell } from "../../lib/shell";
import { useAsync } from "../../lib/useAsync";
import { usePageTitle } from "../../lib/usePageTitle";
import { DiffSummary, DiffViewer, ValidationChecklist } from "../../components/diff/DiffViewer";
import {
  Badge,
  Button,
  Card,
  ErrorNotice,
  PageHeader,
  Spinner,
} from "../../components/ui/Primitives";

const secondaryAction =
  "inline-flex h-9 items-center rounded-control border border-line bg-surface px-4 text-[13px] font-medium text-ink transition-colors hover:border-line-strong hover:bg-surface-elevated";

const downloadClass =
  "inline-flex h-9 items-center rounded-control border border-line bg-surface px-4 text-[13px] font-medium text-ink transition-colors hover:border-line-strong hover:bg-surface-elevated";

export default function PatchPage() {
  const { repository } = useShell();
  const { patchId = "" } = useParams();
  const detail = useAsync(() => api.patch(repository.id, patchId), [repository.id, patchId]);
  const [validating, setValidating] = useState(false);
  const [validation, setValidation] = useState<Awaited<ReturnType<typeof api.validatePatch>> | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const requestKey = useRef(`${repository.id}:${patchId}`);
  usePageTitle(
    detail.state.data ? `Patch · ${detail.state.data.patch.target_path}` : "Patch review",
  );

  useEffect(() => {
    // A different patch is a different validation result. Drop any state that
    // belongs to the previous id, including an in-flight response.
    requestKey.current = `${repository.id}:${patchId}`;
    setValidation(null);
    setError(null);
    setValidating(false);
  }, [repository.id, patchId]);

  async function validate() {
    const key = `${repository.id}:${patchId}`;
    setValidating(true);
    setError(null);
    try {
      const result = await api.validatePatch(repository.id, patchId);
      if (requestKey.current === key) setValidation(result);
    } catch (caught) {
      if (requestKey.current === key) setError(caught as ApiError);
    } finally {
      if (requestKey.current === key) setValidating(false);
    }
  }

  if (detail.state.status === "loading") {
    return (
      <div className="flex items-center gap-2 p-6 text-[13px] text-ink-muted sm:p-8">
        <Spinner className="text-accent-strong" /> Loading patch…
      </div>
    );
  }

  if (detail.state.status === "error" || !detail.state.data) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        {detail.state.error ? (
          <ErrorNotice error={detail.state.error} onRetry={detail.reload} />
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
              className={secondaryAction}
            >
              View finding
            </Link>
            <Button variant="primary" onClick={validate} loading={validating}>
              Validate patch
            </Button>
          </>
        }
      />

      <div className="space-y-6 p-4 sm:p-6 lg:p-8">
        {error ? <ErrorNotice error={error} onRetry={validate} onDismiss={() => setError(null)} /> : null}

        <div className="flex flex-wrap items-center gap-2.5">
          <Badge tone={patch.mode === "live" ? "ok" : "info"}>{patch.mode} mode</Badge>
          <span className="text-2xs text-ink-muted">
            <DiffSummary diff={patch.diff} />
          </span>
          {existingValidation ? (
            <Badge
              tone={
                existingValidation.outcome === "passed"
                  ? "ok"
                  : existingValidation.outcome === "failed"
                    ? "danger"
                    : "warn"
              }
            >
              validation {existingValidation.outcome.replace(/_/g, " ")}
            </Badge>
          ) : (
            <Badge tone="neutral">not validated yet</Badge>
          )}
          <span className="ml-auto hidden font-hand text-[19px] leading-none text-ink-faint sm:inline">
            a draft, not an edit
          </span>
        </div>

        <Card className="px-5 py-5">
          <p className="eyebrow">Rationale</p>
          <p className="mt-2 max-w-3xl text-[14px] leading-6 text-ink">{patch.rationale}</p>
          {patch.limitations.length ? (
            <ul className="mt-4 space-y-2 border-t border-line pt-3 text-2xs leading-5 text-ink-muted">
              {patch.limitations.map((limitation, index) => (
                <li key={index} className="flex gap-2.5">
                  <span
                    aria-hidden="true"
                    className="mt-2 h-1 w-1 shrink-0 rounded-full bg-warn"
                  />
                  <span>{limitation}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </Card>

        <section aria-labelledby="proposed-change-heading">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 id="proposed-change-heading" className="text-h3 text-ink">
                Proposed change
              </h2>
              <p className="mt-1 text-2xs text-ink-faint">
                The original file is not modified. This is a proposed diff against the indexed
                snapshot.
              </p>
            </div>
            <span className="font-mono text-2xs text-ink-faint">{patch.target_path}</span>
          </div>
          <DiffViewer diff={patch.diff} />
        </section>

        <ValidationChecklist result={existingValidation} />

        <Card className="px-5 py-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 className="text-h3 text-ink">Export</h2>
              <p className="body-text mt-2 max-w-xl">
                The original repository is untouched. Download the patch for review, or the revised
                file to apply yourself.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <a className={downloadClass} href={api.downloadUrl(repository.id, patch.id, "patch")} download>
                Download patch
              </a>
              <a
                className={downloadClass}
                href={api.downloadUrl(repository.id, patch.id, "markdown")}
                download
              >
                Download updated file
              </a>
            </div>
          </div>
          <p className="mt-4 border-t border-line pt-3 text-2xs leading-5 text-ink-faint">
            Applying a patch to the repository in place is not implemented in this build, so no
            control pretends to do it.
          </p>
        </Card>
      </div>
    </div>
  );
}
