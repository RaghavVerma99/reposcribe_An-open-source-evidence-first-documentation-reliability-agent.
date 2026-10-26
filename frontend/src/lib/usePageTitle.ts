import { useEffect } from "react";

const DEFAULT_TITLE = "RepoScribe — Documentation that doesn't lie";

/** Keep the browser tab title aligned with the active view. */
export function usePageTitle(title?: string | null) {
  useEffect(() => {
    document.title = title ? `${title} · RepoScribe` : DEFAULT_TITLE;
  }, [title]);
}
