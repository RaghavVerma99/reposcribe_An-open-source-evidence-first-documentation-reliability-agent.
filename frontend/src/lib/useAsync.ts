import { useCallback, useEffect, useState } from "react";

import type { ApiError } from "./api";

export interface AsyncState<T> {
  status: "idle" | "loading" | "success" | "error";
  data?: T;
  error?: ApiError;
}

/**
 * Small per-operation async state holder. Deliberately not a global
 * `isLoading` flag: each screen owns its own request state.
 */
export function useAsync<T>(loader: () => Promise<T>, deps: unknown[]) {
  const [state, setState] = useState<AsyncState<T>>({ status: "loading" });
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    loader()
      .then((data) => {
        if (!cancelled) setState({ status: "success", data });
      })
      .catch((error: ApiError) => {
        if (!cancelled) setState({ status: "error", error });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);

  const reload = useCallback(() => setNonce((value) => value + 1), []);
  return { state, reload, setState };
}