import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

import { api, ApiError } from "../lib/api";
import type { ProviderStatus } from "../lib/types";

interface AppStateValue {
  provider: ProviderStatus | null;
  providerError: ApiError | null;
  reloadProvider: () => void;
}

const AppStateContext = createContext<AppStateValue | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [provider, setProvider] = useState<ProviderStatus | null>(null);
  const [providerError, setProviderError] = useState<ApiError | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

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
      provider,
      providerError,
      reloadProvider: () => setReloadToken((token) => token + 1),
    }),
    [provider, providerError],
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
