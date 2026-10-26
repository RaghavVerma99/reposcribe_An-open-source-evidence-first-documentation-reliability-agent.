import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAppState } from "../../app/AppState";
import { api, ApiError } from "../../lib/api";
import { relativeTime } from "../../lib/format";
import { useShell } from "../../lib/shell";
import { usePageTitle } from "../../lib/usePageTitle";
import {
  Button,
  Card,
  CardHeader,
  ErrorNotice,
  PageHeader,
  ProviderPill,
} from "../../components/ui/Primitives";

const ROW_LABEL = "text-ink-faint";
const ROW_VALUE = "min-w-0 truncate font-mono text-ink";

export default function SettingsPage() {
  const { repository, reloadRepository } = useShell();
  const { provider, providerError, reloadProvider } = useAppState();
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);
  const [reindexBusy, setReindexBusy] = useState(false);
  const [reindexError, setReindexError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  usePageTitle(`${repository.name} settings`);

  async function reindex() {
    setReindexBusy(true);
    setReindexError(null);
    try {
      await api.reindex(repository.id);
      reloadRepository();
    } catch (caught) {
      setReindexError(caught as ApiError);
    } finally {
      setReindexBusy(false);
    }
  }

  async function removeWorkspace() {
    setBusy(true);
    setError(null);
    try {
      await api.deleteRepository(repository.id);
      navigate("/");
    } catch (caught) {
      setError(caught as ApiError);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Settings"
        subtitle="Operating mode, provider state, and workspace lifecycle for this repository."
        meta={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-mono text-ink">{repository.name}</span>
            <span aria-hidden="true" className="text-line-strong">
              ·
            </span>
            <span className="font-mono text-ink">{repository.id}</span>
          </span>
        }
        actions={<Button onClick={reloadProvider}>Refresh status</Button>}
      />

      <div className="grid gap-6 p-4 sm:p-6 lg:p-8 xl:grid-cols-2">
        <Card padded={false} className="overflow-hidden">
          <CardHeader
            title="Model provider"
            subtitle="Credentials live in the backend environment and never reach the browser."
            actions={
              provider ? (
                <ProviderPill mode={provider.mode} message={provider.message} />
              ) : null
            }
          />
          <div className="space-y-4 p-5">
            {providerError ? <ErrorNotice error={providerError} onRetry={reloadProvider} /> : null}
            {provider ? (
              <>
                <dl className="grid grid-cols-[132px_1fr] gap-x-4 gap-y-2.5 text-2xs">
                  <dt className={ROW_LABEL}>Provider</dt>
                  <dd className={ROW_VALUE}>{provider.provider}</dd>
                  <dt className={ROW_LABEL}>Model</dt>
                  <dd className={ROW_VALUE}>{provider.model}</dd>
                  <dt className={ROW_LABEL}>State</dt>
                  <dd className="text-ink">{provider.state.replace(/_/g, " ")}</dd>
                  <dt className={ROW_LABEL}>Contract verified</dt>
                  <dd className="text-ink">{provider.verified_contract ? "yes" : "no"}</dd>
                </dl>
                <p className="rounded-control border border-line bg-canvas px-3 py-2.5 text-2xs leading-5 text-ink-muted">
                  {provider.message}
                </p>
              </>
            ) : (
              <p className="text-2xs text-ink-muted">Loading provider status…</p>
            )}
            <p className="border-t border-line pt-3 text-2xs leading-5 text-ink-faint">
              Deterministic checks run without any provider. The model explains and drafts; it never
              decides whether a finding is true.
            </p>
          </div>
        </Card>

        <Card padded={false} className="overflow-hidden">
          <CardHeader
            title="Workspace"
            subtitle="The indexed snapshot is read-only. Re-indexing refreshes it from the original source."
          />
          <div className="space-y-4 p-5">
            <dl className="grid grid-cols-[132px_1fr] gap-x-4 gap-y-2.5 text-2xs">
              <dt className={ROW_LABEL}>Repository id</dt>
              <dd className={ROW_VALUE}>{repository.id}</dd>
              <dt className={ROW_LABEL}>Name</dt>
              <dd className="min-w-0 truncate text-ink">{repository.name}</dd>
              <dt className={ROW_LABEL}>Source</dt>
              <dd className="text-ink">
                {repository.source === "sample" ? "Bundled sample" : "Uploaded ZIP"}
              </dd>
              <dt className={ROW_LABEL}>Files indexed</dt>
              <dd className="text-ink">{repository.files_indexed}</dd>
              <dt className={ROW_LABEL}>Documentation files</dt>
              <dd className="text-ink">{repository.docs_found}</dd>
              <dt className={ROW_LABEL}>Created</dt>
              <dd className="text-ink">{relativeTime(repository.created_at)}</dd>
            </dl>
            <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
              <Button loading={reindexBusy} onClick={reindex}>
                Re-index files
              </Button>
              <p className="max-w-xs text-2xs leading-5 text-ink-faint">
                Workspaces expire automatically so uploaded code is not kept indefinitely.
              </p>
            </div>
            {reindexError ? (
              <ErrorNotice
                error={reindexError}
                onRetry={reindex}
                onDismiss={() => setReindexError(null)}
              />
            ) : null}
          </div>
        </Card>

        <Card
          padded={false}
          className="overflow-hidden border-danger/25 xl:col-span-2"
        >
          <CardHeader
            title="Delete workspace"
            subtitle="This removes the extracted copy and everything RepoScribe recorded for it."
          />
          <div className="space-y-4 p-5">
            {error ? <ErrorNotice error={error} onDismiss={() => setError(null)} /> : null}
            <p className="body-text max-w-2xl">
              Deleting removes the extracted copy and every finding, patch, and answer recorded for
              this repository. Your original repository is not affected.
            </p>
            {confirming ? (
              <div className="flex flex-wrap items-center gap-3">
                <Button variant="danger" loading={busy} onClick={removeWorkspace}>
                  Yes, delete {repository.id}
                </Button>
                <Button variant="ghost" onClick={() => setConfirming(false)}>
                  Cancel
                </Button>
              </div>
            ) : (
              <Button variant="danger" onClick={() => setConfirming(true)}>
                Delete workspace
              </Button>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
