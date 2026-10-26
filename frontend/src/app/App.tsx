import { Suspense, lazy } from "react";
import { Link, Route, Routes } from "react-router-dom";

import AppShell from "../components/layout/AppShell";
import Notice from "../components/ui/Notice";
import { Spinner } from "../components/ui/Primitives";

const LandingPage = lazy(() => import("../features/repositories/LandingPage"));
const OverviewPage = lazy(() => import("../features/repositories/OverviewPage"));
const FindingsPage = lazy(() => import("../features/audits/FindingsPage"));
const FindingDetailPage = lazy(() => import("../features/audits/FindingDetailPage"));
const PatchPage = lazy(() => import("../features/patches/PatchPage"));
const AskPage = lazy(() => import("../features/questions/AskPage"));
const SettingsPage = lazy(() => import("../features/settings/SettingsPage"));

function PageFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas">
      <p className="flex items-center gap-2 text-[13px] text-ink-muted">
        <Spinner className="text-accent-strong" /> Loading RepoScribe…
      </p>
    </div>
  );
}

export default function App() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/r/:repositoryId" element={<AppShell />}>
          <Route index element={<OverviewPage />} />
          <Route path="findings" element={<FindingsPage />} />
          <Route path="findings/:findingId" element={<FindingDetailPage />} />
          <Route path="patches/:patchId" element={<PatchPage />} />
          <Route path="ask" element={<AskPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
        <Route
          path="*"
          element={
            <Notice
              title="Page not found"
              body="That route does not exist in RepoScribe."
              action={
                <Link
                  to="/"
                  className="text-[13px] font-medium text-accent-strong hover:underline"
                >
                  Back to the start
                </Link>
              }
            />
          }
        />
      </Routes>
    </Suspense>
  );
}
