import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAppState } from "../../app/AppState";
import { api, ApiError } from "../../lib/api";
import { relativeTime } from "../../lib/format";
import { useShell } from "../../lib/shell";
import { Badge, Button, Card, ErrorNotice, PageHeader } from "../../components/ui/Primitives";

export default function SettingsPage() {
  const { repository, reloadRepository } = useShell();
  const { provider, providerError, reloadProvider, setRepositoryId } = useAppState();
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

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
        actions={<Button onClick={reloadProvider}>Refresh status</Button>}
      />

      <div className="grid gap-6 p-6 xl:grid-cols-2">
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <h2 className="text-[13px] font-semibold tracking-tight text-ink">Model provider</h2>
            {provider ? (
              <Badge tone={provider.mode === "live" ? "ok" : provider.mode === "unavailable" ? "danger" : "info"}>
                {provider.mode}
              </Badge>
            ) : null}
          </div>
          <div className="space-y-2 p-4 text-sm">
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
                <p className="text-2xs text-ink-muted">{provider.message}</p>
              </>
            ) : (
              <p className="text-2xs text-ink-muted">Loading provider statusâ€¦</p>
            )}
            <p className="border-t border-line pt-3 text-2xs text-ink-faint">
              Deterministic checks run without any provider. Credentials live in the backend environment only and are
              never exposed to the browser.
            </p>
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="border-b border-line px-4 py-3">
            <h2 className="text-[13px] font-semibold tracking-tight text-ink">Workspace</h2>
          </div>
          <div className="space-y-2 p-4 text-sm">
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
              <Button
                onClick={async () => {
                  await api.reindex(repository.id);
                  reloadRepository();
                }}
              >
                Re-index files
              </Button>
              <p className="self-center text-2xs text-ink-faint">
                Workspaces expire automatically so uploaded code is not kept indefinitely.
              </p>
            </div>
          </div>
        </Card>

        <Card className="overflow-hidden xl:col-span-2">
          <div className="border-b border-line px-4 py-3">
            <h2 className="text-[13px] font-semibold tracking-tight text-ink">Delete workspace</h2>
          </div>
          <div className="space-y-3 p-4">
            {error ? <ErrorNotice error={error} /> : null}
            <p className="text-sm text-ink-muted">
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