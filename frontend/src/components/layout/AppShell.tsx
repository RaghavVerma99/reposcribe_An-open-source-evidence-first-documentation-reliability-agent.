import { useEffect, useState } from "react";
import { Link, Outlet, useParams } from "react-router-dom";

import { useAppState } from "../../app/AppState";
import { api } from "../../lib/api";
import { useAsync } from "../../lib/useAsync";
import Notice from "../ui/Notice";
import { ErrorNotice, Spinner } from "../ui/Primitives";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import Avatar from "./Avatar";

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
      <Notice
        title="Opening repository"
        body="Loading repository metadata…"
        action={<Spinner className="text-accent-strong" />}
      />
    );
  }

  const data = repository.state.data;

  return (
    <div className="flex min-h-screen bg-canvas">
      <div className="hidden shrink-0 lg:block">
        <div className="sticky top-0 h-screen">
          <Sidebar />
        </div>
      </div>

      {navOpen ? (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="h-full shadow-lift">
            <Sidebar onNavigate={() => setNavOpen(false)} />
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
        <TopBar
          left={
            <>
              <button
                type="button"
                onClick={() => setNavOpen(true)}
                aria-label="Open navigation"
                className="grid h-9 w-9 place-items-center rounded-control border border-line bg-surface text-ink-muted transition-colors hover:border-line-strong hover:text-ink lg:hidden"
              >
                <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                  <path d="M2.5 4.5h11M2.5 8h11M2.5 11.5h11" strokeLinecap="round" />
                </svg>
              </button>
            </>
          }
          rightMeta={<Avatar name="Raghav" />}
        />
        <main className="flex-1">
          <Outlet context={{ repository: data, reloadRepository: repository.reload }} />
        </main>
      </div>
    </div>
  );
}