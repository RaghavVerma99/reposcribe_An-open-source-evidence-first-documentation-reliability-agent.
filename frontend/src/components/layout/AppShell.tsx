import { useEffect, useState } from "react";
import { Link, Outlet, useParams } from "react-router-dom";

import { useAppState } from "../../app/AppState";
import { api } from "../../lib/api";
import { useAsync } from "../../lib/useAsync";
import { ErrorNotice, Spinner } from "../ui/Primitives";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";

export default function AppShell() {
  const { repositoryId = "" } = useParams();
  const { setRepositoryId } = useAppState();
  const [navOpen, setNavOpen] = useState(false);
  const repository = useAsync(() => api.repository(repositoryId), [repositoryId]);

  useEffect(() => {
    if (repositoryId) setRepositoryId(repositoryId);
  }, [repositoryId, setRepositoryId]);

  useEffect(() => {
    setNavOpen(false);
  }, [repositoryId]);

  if (repository.state.status === "error" && repository.state.error) {
    return (
      <div className="mx-auto max-w-xl p-8">
        <ErrorNotice error={repository.state.error} onRetry={repository.reload} />
        <p className="mt-4 text-[13px] text-ink-muted">
          <Link to="/" className="font-medium text-accent-strong hover:underline">
            Choose another repository
          </Link>
        </p>
      </div>
    );
  }

  if (repository.state.status !== "success" || !repository.state.data) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex items-center gap-2.5 rounded-full border border-line bg-surface px-4 py-2 text-[13px] text-ink-muted shadow-panel">
          <Spinner className="text-accent-strong" />
          Opening repository…
        </div>
      </div>
    );
  }

  const data = repository.state.data;

  return (
    <div className="flex min-h-screen bg-canvas">
      <div className="hidden shrink-0 lg:block">
        <div className="sticky top-0 h-screen">
          <Sidebar repositoryId={repositoryId} repositoryName={data.name} />
        </div>
      </div>

      {navOpen ? (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="h-full shadow-lift">
            <Sidebar
              repositoryId={repositoryId}
              repositoryName={data.name}
              onNavigate={() => setNavOpen(false)}
            />
          </div>
          <button
            type="button"
            aria-label="Close navigation"
            className="flex-1 bg-black/75 backdrop-blur-sm"
            onClick={() => setNavOpen(false)}
          />
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar repository={data} onMenu={() => setNavOpen(true)} onAudited={repository.reload} />
        <main className="flex-1">
          <Outlet context={{ repository: data, reloadRepository: repository.reload }} />
        </main>
      </div>
    </div>
  );
}