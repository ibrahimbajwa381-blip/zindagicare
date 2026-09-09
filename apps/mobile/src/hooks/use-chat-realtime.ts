import { useCallback, useRef } from "react";
import { useFocusEffect } from "expo-router";
import { fetch as expoFetch } from "expo/fetch";
import { API_URL } from "@/lib/config";
import { getStoredTokens } from "@/lib/token-storage";
import { refreshAccessTokenShared } from "@/api/client";
import type { ChatRealtimeEvent } from "@/api/chat";

const MAX_RECONNECT_DELAY_MS = 30_000;

/**
 * SSE client for /api/v1/chat/events. Must use `expo/fetch` (not the global
 * polyfilled fetch) — it's the only fetch in this Expo version whose
 * Response.body streams incrementally rather than buffering the whole
 * response, which a live SSE stream needs. Also, EventSource can't send a
 * custom Authorization header, and this endpoint authenticates mobile via a
 * Bearer token rather than a cookie session — see apps/mobile/AGENTS.md.
 *
 * Connects only while the screen is focused (mirrors the useFocusLoader
 * polling pattern already used across chat screens) and reconnects with
 * exponential backoff on drops.
 */
export function useChatRealtime(onEvent: (event: ChatRealtimeEvent) => void) {
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useFocusEffect(
    useCallback(() => {
      let stopped = false;
      let abortController: AbortController | null = null;
      let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
      let reconnectAttempts = 0;

      async function connect() {
        if (stopped) return;
        abortController = new AbortController();

        try {
          const { accessToken } = await getStoredTokens();
          if (!accessToken) throw new Error("No access token");

          const res = await expoFetch(`${API_URL}/api/v1/chat/events`, {
            headers: { Authorization: `Bearer ${accessToken}`, Accept: "text/event-stream" },
            signal: abortController.signal,
          });

          if (res.status === 401) {
            // A screen that relies solely on this hook for live updates has no
            // other apiFetch call that would otherwise trigger a token refresh —
            // without this, every reconnect attempt just backs off and retries
            // with the same stale token forever. Refresh once and retry
            // immediately with the new token instead.
            const refreshed = await refreshAccessTokenShared();
            if (stopped) return;
            if (refreshed) {
              reconnectAttempts = 0;
              return connect();
            }
          }

          if (!res.ok || !res.body) throw new Error(`SSE connect failed: ${res.status}`);

          reconnectAttempts = 0;
          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";

          while (!stopped) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });

            let sepIndex: number;
            while ((sepIndex = buffer.indexOf("\n\n")) !== -1) {
              const rawEvent = buffer.slice(0, sepIndex);
              buffer = buffer.slice(sepIndex + 2);

              const data = rawEvent
                .split("\n")
                .filter((line) => line.startsWith("data:"))
                .map((line) => line.slice(5).trimStart())
                .join("\n");
              if (!data) continue;

              try {
                const payload = JSON.parse(data) as { type?: string };
                if (!payload.type || payload.type === "connected") continue;
                onEventRef.current(payload as ChatRealtimeEvent);
              } catch {
                // Ignore malformed events.
              }
            }
          }
        } catch {
          // Falls through to the reconnect scheduling below.
        }

        if (stopped) return;
        const delay = Math.min(1_000 * 2 ** reconnectAttempts, MAX_RECONNECT_DELAY_MS);
        reconnectAttempts += 1;
        reconnectTimer = setTimeout(connect, delay);
      }

      connect();

      return () => {
        stopped = true;
        if (reconnectTimer) clearTimeout(reconnectTimer);
        abortController?.abort();
      };
    }, []),
  );
}
