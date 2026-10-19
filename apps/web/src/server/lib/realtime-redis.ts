import type { FanoutRedis, FanoutSubscription } from "@/lib/realtime/redis-fanout";

let shared: FanoutRedis | null | undefined;

/**
 * Upstash REST client for realtime fan-out, or null when not configured.
 *
 * Uses the same env vars as the cache and rate limiter. PUBLISH goes through
 * the @upstash/redis SDK. SUBSCRIBE uses Upstash's streaming REST endpoint
 * (an HTTP response kept open, the same request the SDK's `subscribe()`
 * makes), read here directly because the SDK (1.39) swallows stream errors
 * and stream ends: a dead subscription would look healthy forever. This
 * reader reports any end that wasn't an unsubscribe as an "error".
 *
 * Always null under NODE_ENV=test: next/jest loads apps/web/.env, which holds
 * production Upstash credentials, and tests must never touch them.
 */
export function getRealtimeRedis(): FanoutRedis | null {
  if (process.env.NODE_ENV === "test") return null;
  if (shared !== undefined) return shared;

  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) {
    shared = null;
    return shared;
  }

  // Lazy require keeps the client out of bundles/tests that never configure it.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Redis } = require("@upstash/redis") as typeof import("@upstash/redis");
  const client = new Redis({ url, token, automaticDeserialization: false, retry: false });
  shared = {
    publish: (channel, message) => client.publish(channel, message),
    subscribe: (channel) => subscribeUpstashStream({ url, token, channel }),
  };
  return shared;
}

type Listeners = {
  message: ((data: { channel: string; message: unknown }) => void)[];
  subscribe: ((count: number) => void)[];
  error: ((error: Error) => void)[];
};

/** Exported for tests, which pass a fake `fetch`. */
export function subscribeUpstashStream(options: {
  url: string;
  token: string;
  channel: string;
  fetchImpl?: typeof fetch;
}): FanoutSubscription {
  const { url, token, channel, fetchImpl = fetch } = options;
  const listeners: Listeners = { message: [], subscribe: [], error: [] };
  const controller = new AbortController();
  let finished = false;

  const fail = (error: Error) => {
    if (finished || controller.signal.aborted) return;
    finished = true;
    for (const l of listeners.error) l(error);
  };

  // Lines look like `data: subscribe,<channel>,<count>` / `data: message,<channel>,<payload>`.
  const handleLine = (line: string) => {
    if (!line.startsWith("data: ")) return;
    const data = line.slice(6);
    const first = data.indexOf(",");
    const second = data.indexOf(",", first + 1);
    if (first === -1 || second === -1) return;
    const type = data.slice(0, first);
    const from = data.slice(first + 1, second);
    const rest = data.slice(second + 1);
    if (type === "subscribe") {
      for (const l of listeners.subscribe) l(Number.parseInt(rest, 10));
    } else if (type === "message") {
      for (const l of listeners.message) l({ channel: from, message: rest });
    }
  };

  void (async () => {
    try {
      const res = await fetchImpl(`${url.replace(/\/+$/, "")}/subscribe/${channel}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "text/event-stream",
          "Cache-Control": "no-cache",
        },
        body: "[]",
        cache: "no-store",
        signal: controller.signal,
      });
      if (!res.ok || !res.body) throw new Error(`subscribe failed: HTTP ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          if (buffer.length > 1_000_000) throw new Error("subscribe stream buffer exceeded");
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) handleLine(line.replace(/\r$/, ""));
        }
      } finally {
        reader.cancel().catch(() => {});
      }
      throw new Error("subscribe stream ended");
    } catch (err) {
      // Error messages here never contain the token (it is only in a header).
      fail(err instanceof Error ? err : new Error(String(err)));
    }
  })();

  return {
    on(type: keyof Listeners, listener: never) {
      (listeners[type] as unknown[]).push(listener);
    },
    async unsubscribe() {
      finished = true;
      controller.abort();
    },
  } as FanoutSubscription;
}
