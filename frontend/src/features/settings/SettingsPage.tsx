import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAppState } from "../../app/AppState";
import { api, ApiError } from "../../lib/api";
import { relativeTime } from "../../lib/format";
import { useShell } from "../../lib/shell";
import { Badge, Button, Card, CardHeader, ErrorNotice, PageHeader } from "../../components/ui/Primitives";

export default function SettingsPage() {
  const { repository, reloadRepository } = useShell();
  const { provider, providerError, reloadProvider, setRepositoryId } = useAppState();
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);
  const [reindexBusy, setReindexBusy] = useState(false);
  const [reindexError, setReindexError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

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
      setRepositoryId(null);
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

      <div className="grid gap-6 p-6 xl:grid-cols-2">
        <Card padded={false} className="overflow-hidden">
          <CardHeader
            title="Model provider"
            actions={
              provider ? (
                <Badge tone={provider.mode === "live" ? "ok" : provider.mode === "unavailable" ? "danger" : "info"}>
                  <span
                    aria-hidden="true"
                    className={
                      provider.mode === "live"
                        ? "h-1 w-1 rounded-full bg-ok"
                        : provider.mode === "unavailable"
                          ? "h-1 w-1 rounded-full bg-danger"
                          : "h-1 w-1 rounded-full bg-info"
                    }
                  />
                  {provider.mode}
                </Badge>
              ) : null
            }
          />
          <div className="space-y-2 p-5 text-[13px]">
            {providerError ? <ErrorNotice error={providerError} onRetry={reloadProvider} /> : null}
            {provider ? (
              <>
                <dl className="grid grid-cols-[140px_1fr] gap-y-2 text-2xs">
                  <dt className="text-ink-faint">Provider</dt>
                  <dd className="font-mono text-ink">{provider.provider}</dd>
                  <dt className="text-ink-faint">Model</dt>
                  <dd className="font-mono text-ink">{provider.model}</dd>
                  <dt className="text-ink-faint">State</dt>
                  <dd className="text-ink">{provider.state.replace(/_/g, " ")}</dd>
                  <dt className="text-ink-faint">Contract verified</dt>
                  <dd className="text-ink">{provider.verified_contract ? "yes" : "no"}</dd>
                </dl>
                <p className="body-text">{provider.message}</p>
              </>
            ) : (
              <p className="text-2xs text-ink-muted">Loading provider status…</p>
            )}
            <p className="border-t border-line pt-3 text-2xs text-ink-faint">
              Deterministic checks run without any provider. Credentials live in the backend environment only and are
              never exposed to the browser.
            </p>
          </div>
        </Card>

        <Card padded={false} className="overflow-hidden">
          <CardHeader title="Workspace" />
          <div className="space-y-2 p-5 text-[13px]">
            <dl className="grid grid-cols-[140px_1fr] gap-y-2 text-2xs">
              <dt className="text-ink-faint">Repository id</dt>
              <dd className="font-mono text-ink">{repository.id}</dd>
              <dt className="text-ink-faint">Name</dt>
              <dd className="text-ink">{repository.name}</dd>
              <dt className="text-ink-faint">Source</dt>
              <dd className="text-ink">{repository.source === "sample" ? "Bundled sample" : "Uploaded ZIP"}</dd>
              <dt className="text-ink-faint">Files indexed</dt>
              <dd className="text-ink">{repository.files_indexed}</dd>
              <dt className="text-ink-faint">Documentation files</dt>
              <dd className="text-ink">{repository.docs_found}</dd>
              <dt className="text-ink-faint">Created</dt>
              <dd className="text-ink">{relativeTime(repository.created_at)}</dd>
            </dl>
            <div className="flex flex-wrap gap-2 border-t border-line pt-3">
              <Button loading={reindexBusy} onClick={reindex}>
                Re-index files
              </Button>
              <p className="self-center text-2xs text-ink-faint">
                Workspaces expire automatically so uploaded code is not kept indefinitely.
              </p>
            </div>
            {reindexError ? <div className="pt-3"><ErrorNotice error={reindexError} onRetry={reindex} /></div> : null}
          </div>
        </Card>

        <Card padded={false} className="overflow-hidden xl:col-span-2">
          <CardHeader title="Delete workspace" />
          <div className="space-y-3 p-5">
            {error ? <ErrorNotice error={error} /> : null}
            <p className="body-text">
              Deleting removes the extracted copy and every finding, patch, and answer recorded for this repository.
              Your original repository is not affected.
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