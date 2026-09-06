import { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { ApiRequestError } from "@/api/client";

/**
 * Shared load-on-focus + optional-poll + stale-response-guard pattern that
 * was copy-pasted across ~13 screens. Each screen previously owned its own
 * requestId ref and race-guard logic independently, so a fix to one copy
 * (or a new screen written slightly differently) could silently diverge.
 */
export function useFocusLoader<T>(
  loader: () => Promise<T>,
  fallbackError: string,
  options?: { pollMs?: number },
) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const latestRequestIdRef = useRef(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(
    async (silent = false) => {
      const requestId = ++latestRequestIdRef.current;
      try {
        const result = await loader();
        if (requestId !== latestRequestIdRef.current) return; // a newer load() already landed
        setData(result);
        setError(null);
      } catch (e) {
        if (requestId !== latestRequestIdRef.current) return;
        if (!silent) setError(e instanceof ApiRequestError ? e.message : fallbackError);
      }
    },
    [loader, fallbackError],
  );

  const pollMs = options?.pollMs;
  useFocusEffect(
    useCallback(() => {
      load();
      if (!pollMs) return;
      pollRef.current = setInterval(() => load(true), pollMs);
      return () => {
        if (pollRef.current) clearInterval(pollRef.current);
      };
    }, [load, pollMs]),
  );

  return { data, setData, error, setError, load };
}
