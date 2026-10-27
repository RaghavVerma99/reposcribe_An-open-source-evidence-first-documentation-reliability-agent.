import { Suspense, useEffect, useRef, useState } from "react";
import { Link, Outlet, useLocation, useNavigate, useParams } from "react-router-dom";

import { useAppState } from "../../app/AppState";
import { api } from "../../lib/api";
import { useAsync } from "../../lib/useAsync";
import Notice from "../ui/Notice";
import { ErrorNotice, Spinner } from "../ui/Primitives";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function AppShell() {
  const { repositoryId = "" } = useParams();
  const { provider } = useAppState();
  const navigate = useNavigate();
  const location = useLocation();
  const [navOpen, setNavOpen] = useState(false);
  const repository = useAsync(() => api.repository(repositoryId), [repositoryId]);
  const dialogRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    setNavOpen(false);
  }, [repositoryId]);

  useEffect(() => {
    if (!navOpen) return;
    restoreFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusableItems = () =>
      Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []).filter(
        (element) => element.getClientRects().length > 0,
      );

    const frame = window.requestAnimationFrame(() => {
      focusableItems()[0]?.focus();
    });

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setNavOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusableItems();
      if (!items.length) {
        event.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement as HTMLElement | null;
      const inside = active ? items.includes(active) : false;
      if (event.shiftKey && (!inside || active === first)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (!inside || active === last)) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", onKey);
    return () => {
      window.cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
      if (restoreFocusRef.current?.isConnected) {
        restoreFocusRef.current.focus();
      }
    };
  }, [navOpen]);

  if (repository.state.status === "error" && repository.state.error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas p-6">
        <div className="w-full max-w-lg">
          <ErrorNotice error={repository.state.error} onRetry={repository.reload} />
          <p className="mt-4 text-[13px] text-ink-muted">
            <Link to="/" className="font-medium text-accent-strong hover:underline">
              Choose another repository
            </Link>
          </p>
        </div>
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
      <a
        href="#workspace-main"
        className="sr-only z-50 focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:rounded-control focus:bg-ink focus:px-4 focus:py-2 focus:text-[13px] focus:font-semibold focus:text-canvas"
      >
        Skip to content
      </a>

      <div className="hidden shrink-0 lg:block">
        <div className="sticky top-0 h-screen">
          <Sidebar
            repositoryId={repositoryId}
            repositoryName={data.name}
            repositorySource={data.source}
          />
        </div>
      </div>

      {navOpen ? (
        <div
          ref={dialogRef}
          id="mobile-navigation"
          className="fixed inset-0 z-50 flex animate-fade-in lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Navigation"
        >
          <div className="h-full w-[280px] max-w-[84vw] shadow-lift">
            <Sidebar
              repositoryId={repositoryId}
              repositoryName={data.name}
              repositorySource={data.source}
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
        <TopBar
          repositoryName={data.name}
          providerMode={provider?.mode}
          providerMessage={provider?.message}
          onSearch={(query) =>
            navigate(`/r/${repositoryId}/findings?q=${encodeURIComponent(query)}`)
          }
          left={
            <button
              type="button"
              onClick={() => setNavOpen(true)}
              aria-label="Open navigation"
              aria-expanded={navOpen}
              aria-controls="mobile-navigation"
              className="grid h-9 w-9 place-items-center rounded-control border border-line bg-surface text-ink-muted transition-colors hover:border-line-strong hover:bg-surface-elevated hover:text-ink lg:hidden"
            >
              <svg
                viewBox="0 0 16 16"
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                aria-hidden="true"
              >
                <path d="M2.5 4.5h11M2.5 8h11M2.5 11.5h11" strokeLinecap="round" />
              </svg>
            </button>
          }
        />
        <main id="workspace-main" className="relative flex-1">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[radial-gradient(58%_100%_at_50%_0%,rgba(34,197,94,0.045),transparent_72%)]"
          />
          <div className="relative mx-auto w-full max-w-[1320px]">
            <Suspense
              fallback={
                <div className="flex items-center gap-2 p-6 text-[13px] text-ink-muted sm:p-8">
                  <Spinner className="text-accent-strong" /> Loading view…
                </div>
              }
            >
              <div key={location.pathname} className="animate-fade-up">
                <Outlet context={{ repository: data, reloadRepository: repository.reload }} />
              </div>
            </Suspense>
          </div>
        </main>
      </div>
    </div>
  );
}
