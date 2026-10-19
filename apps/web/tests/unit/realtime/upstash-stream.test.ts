/**
 * The Upstash streaming SUBSCRIBE reader, against a fake fetch. Unlike the
 * SDK's subscriber, every end that isn't our own unsubscribe must surface as
 * one "error" so the fan-out can replace the subscription.
 */
import { getRealtimeRedis, subscribeUpstashStream } from "@/server/lib/realtime-redis";

function streamingFetch() {
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  const body = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c;
    },
  });
  const encoder = new TextEncoder();
  const calls: { url: string; init: RequestInit }[] = [];
  const fetchImpl = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    init.signal?.addEventListener("abort", () => {
      try {
        controller.error(Object.assign(new Error("aborted"), { name: "AbortError" }));
      } catch {
        // already closed
      }
    });
    return new Response(body, { status: 200 });
  }) as unknown as typeof fetch;
  return {
    fetchImpl,
    calls,
    push: (text: string) => controller.enqueue(encoder.encode(text)),
    end: () => controller.close(),
  };
}

const tick = () => new Promise((r) => setTimeout(r, 0));

function collect(sub: ReturnType<typeof subscribeUpstashStream>) {
  const got = { subscribe: [] as number[], message: [] as unknown[], error: [] as string[] };
  sub.on("subscribe", (n) => got.subscribe.push(n));
  sub.on("message", (m) => got.message.push(m));
  sub.on("error", (e) => got.error.push(e.message));
  return got;
}

test("never constructs a real client under NODE_ENV=test", () => {
  expect(getRealtimeRedis()).toBeNull();
});

test("requests the same streaming endpoint as the SDK, token only in the header", async () => {
  const f = streamingFetch();
  const sub = subscribeUpstashStream({ url: "https://example.test/", token: "T0K", channel: "zindagi:rt:x", fetchImpl: f.fetchImpl });
  await tick();
  expect(f.calls[0]!.url).toBe("https://example.test/subscribe/zindagi:rt:x");
  expect((f.calls[0]!.init.headers as Record<string, string>).Authorization).toBe("Bearer T0K");
  expect((f.calls[0]!.init.headers as Record<string, string>).Accept).toBe("text/event-stream");
  await sub.unsubscribe();
});

test("parses confirmations and messages, including split chunks, CRLF and commas in payloads", async () => {
  const f = streamingFetch();
  const sub = subscribeUpstashStream({ url: "https://e.test", token: "t", channel: "c", fetchImpl: f.fetchImpl });
  const got = collect(sub);
  await tick();
  f.push("data: subscribe,c,1\n\ndata: message,c,{\"type\":\"a\",");
  f.push("\"questionId\":\"q\"}\r\n\n: comment\n");
  await tick();
  expect(got.subscribe).toEqual([1]);
  expect(got.message).toEqual([{ channel: "c", message: '{"type":"a","questionId":"q"}' }]);
  expect(got.error).toEqual([]);
  await sub.unsubscribe();
});

test("a stream that ends on its own is reported once as an error", async () => {
  const f = streamingFetch();
  const sub = subscribeUpstashStream({ url: "https://e.test", token: "t", channel: "c", fetchImpl: f.fetchImpl });
  const got = collect(sub);
  await tick();
  f.end();
  await tick();
  await tick();
  expect(got.error).toEqual(["subscribe stream ended"]);
});

test("HTTP errors and network failures are reported, without the token", async () => {
  const unauthorized = (async () => new Response("{}", { status: 401 })) as unknown as typeof fetch;
  const a = collect(subscribeUpstashStream({ url: "https://e.test", token: "SECRET", channel: "c", fetchImpl: unauthorized }));
  const offline = (async () => {
    throw new TypeError("fetch failed");
  }) as unknown as typeof fetch;
  const b = collect(subscribeUpstashStream({ url: "https://e.test", token: "SECRET", channel: "c", fetchImpl: offline }));
  await tick();
  expect(a.error).toEqual(["subscribe failed: HTTP 401"]);
  expect(b.error).toEqual(["fetch failed"]);
  expect(JSON.stringify([a, b])).not.toContain("SECRET");
});

test("unsubscribe aborts the request and reports no error; nothing is delivered afterwards", async () => {
  const f = streamingFetch();
  const sub = subscribeUpstashStream({ url: "https://e.test", token: "t", channel: "c", fetchImpl: f.fetchImpl });
  const got = collect(sub);
  await tick();
  await sub.unsubscribe();
  await tick();
  expect((f.calls[0]!.init.signal as AbortSignal).aborted).toBe(true);
  expect(got.error).toEqual([]);
});
