import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

import { api, ApiError } from "../lib/api";
import type { ProviderStatus } from "../lib/types";

const STORAGE_KEY = "reposcribe.repositoryId";

interface AppStateValue {
  repositoryId: string | null;
  setRepositoryId: (id: string | null) => void;
  provider: ProviderStatus | null;
  providerError: ApiError | null;
  reloadProvider: () => void;
}

const AppStateContext = createContext<AppStateValue | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [repositoryId, setRepositoryIdState] = useState<string | null>(
    () => window.localStorage.getItem(STORAGE_KEY),
  );
  const [provider, setProvider] = useState<ProviderStatus | null>(null);
  const [providerError, setProviderError] = useState<ApiError | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const setRepositoryId = useCallback((id: string | null) => {
    setRepositoryIdState(id);
    if (id) {
      window.localStorage.setItem(STORAGE_KEY, id);
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    api
      .provider()
      .then((status) => {
        if (!cancelled) {
          setProvider(status);
          setProviderError(null);
        }
      })
      .catch((error: ApiError) => {
        if (!cancelled) setProviderError(error);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  const value = useMemo<AppStateValue>(
    () => ({
      repositoryId,
      setRepositoryId,
      provider,
      providerError,
      reloadProvider: () => setReloadToken((token) => token + 1),
    }),
    [repositoryId, setRepositoryId, provider, providerError],
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState(): AppStateValue {
  const value = useContext(AppStateContext);
  if (!value) {
    throw new Error("useAppState must be used inside AppStateProvider");
  }
  return value;
}