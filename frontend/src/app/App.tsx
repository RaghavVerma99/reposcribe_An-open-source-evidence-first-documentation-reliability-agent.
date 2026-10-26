import { Link, Route, Routes } from "react-router-dom";

import AppShell from "../components/layout/AppShell";
import OverviewPage from "../features/repositories/OverviewPage";
import Notice from "../components/ui/Notice";
import FindingsPage from "../features/audits/FindingsPage";
import FindingDetailPage from "../features/audits/FindingDetailPage";
import PatchPage from "../features/patches/PatchPage";
import AskPage from "../features/questions/AskPage";
import SettingsPage from "../features/settings/SettingsPage";
import LandingPage from "../features/repositories/LandingPage";

export default function App() {
  return (
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
              <Link to="/" className="text-[13px] font-medium text-accent-strong hover:underline">
                Back to the start
              </Link>
            }
          />
        }
      />
    </Routes>
  );
}