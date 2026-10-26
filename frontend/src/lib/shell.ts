import { useOutletContext } from "react-router-dom";

import type { Repository } from "./types";

export interface ShellContext {
  repository: Repository;
  reloadRepository: () => void;
}

export function useShell(): ShellContext {
  return useOutletContext<ShellContext>();
}