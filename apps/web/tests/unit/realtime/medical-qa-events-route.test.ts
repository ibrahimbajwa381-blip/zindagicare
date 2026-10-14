/**
 * The public Q&A SSE route: "connected" only after the subscription is live,
 * ids-only events, cleanup on disconnect, stream end on a broken Redis
 * subscription, and self-close before Vercel's limit. The real Redis client is
 * replaced by a fake broker (or by "not configured"); production is never hit.
 */
import type { FanoutRedis, FanoutSubscription } from "@/lib/realtime/redis-fanout";

let fakeRedis: FanoutRedis | null = null;
jest.mock("@/server/lib/realtime-redis", () => ({ getRealtimeRedis: () => fakeRedis }));

import { GET } from "@/app/api/v1/medical-questions/[id]/events/route";
import { medicalQaEmitter, publishMedicalQaEvent, questionRoomKey } from "@/lib/realtime/medical-qa-emitter";

const Q1 = "64b7f0c2a1b2c3d4e5f60718";
const A1 = "74b7f0c2a1b2c3d4e5f60718";
const room = questionRoomKey(Q1);

type Sub = { channel: string; listeners: Record<string, ((d: never) => void)[]>; closed: boolean };
function fakeBroker() {
  const subs: Sub[] = [];
  const emit = (s: Sub, type: string, data: unknown) => (s.listeners[type] ?? []).forEach((l) => l(data as never));
  const redis: FanoutRedis = {
    async publish(channel, message) {
      subs.filter((s) => !s.closed && s.channel === channel).forEach((s) => emit(s, "message", { channel, message }));
      return 1;
    },
    subscribe(channel) {
      const s: Sub = { channel, listeners: {}, closed: false };
      subs.push(s);
      queueMicrotask(() => emit(s, "subscribe", 1));
      return {
        on: (type: string, l: (d: never) => void) => (s.listeners[type] ??= []).push(l),
        unsubscribe: async () => {
          s.closed = true;
        },
      } as FanoutSubscription;
    },
  };
  return { redis, subs, live: () => subs.filter((s) => !s.closed), emit };
}

function open(questionId = Q1) {
  const abort = new AbortController();
  const req = new Request(`http://localhost/api/v1/medical-questions/${questionId}/events`, { signal: abort.signal });
  return { abort, res: GET(req) };
}

async function readFrames(reader: ReadableStreamDefaultReader<Uint8Array>, count: number) {
  const decoder = new TextDecoder();
  const frames: string[] = [];
  let buffer = "";
  while (frames.length < count) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";
    frames.push(...parts);
  }
  return frames;
}

afterEach(() => {
  fakeRedis = null;
  medicalQaEmitter.removeAllListeners();
});

test("rejects malformed ids", async () => {
  expect((await open("not-an-id").res).status).toBe(404);
});

describe("without Redis (single instance)", () => {
  test("sends connected, then ids-only events published for that question", async () => {
    const { res, abort } = open();
    const response = await res;
    expect(response.headers.get("Content-Type")).toBe("text/event-stream");
    const reader = response.body!.getReader();
    expect(await readFrames(reader, 1)).toEqual([`data: {"type":"connected"}`]);

    await publishMedicalQaEvent({ type: "answer_created", questionId: Q1, answerId: A1, body: "private" } as never);
    expect(await readFrames(reader, 1)).toEqual([
      `data: ${JSON.stringify({ type: "answer_created", questionId: Q1, answerId: A1 })}`,
    ]);
    abort.abort();
  });

  test("client disconnect removes the listener", async () => {
    const { res, abort } = open();
    await readFrames((await res).body!.getReader(), 1);
    expect(medicalQaEmitter.listenerCount(room)).toBe(1);
    abort.abort();
    expect(medicalQaEmitter.listenerCount(room)).toBe(0);
  });

  test("the stream ends itself before Vercel's function time limit", async () => {
    jest.useFakeTimers();
    try {
      const { res } = open();
      const reader = (await res).body!.getReader();
      const first = readFrames(reader, 1);
      await jest.advanceTimersByTimeAsync(0);
      await first;
      await jest.advanceTimersByTimeAsync(270_000);
      const rest = await readFrames(reader, 100);
      expect(rest.every((f) => f === ": ping")).toBe(true);
      await expect(reader.read()).resolves.toEqual({ value: undefined, done: true });
      expect(medicalQaEmitter.listenerCount(room)).toBe(0);
    } finally {
      jest.useRealTimers();
    }
  });
});

describe("with Redis (cross-instance)", () => {
  test("connected is sent only after Redis confirms; Redis messages reach the stream once", async () => {
    const broker = fakeBroker();
    fakeRedis = broker.redis;
    const { res, abort } = open();
    const reader = (await res).body!.getReader();
    expect(await readFrames(reader, 1)).toEqual([`data: {"type":"connected"}`]);
    expect(broker.live()).toHaveLength(1);

    // Published "elsewhere": straight onto the broker channel.
    await broker.redis.publish(
      broker.live()[0]!.channel,
      JSON.stringify({ type: "question_updated", questionId: Q1 }),
    );
    expect(await readFrames(reader, 1)).toEqual([`data: ${JSON.stringify({ type: "question_updated", questionId: Q1 })}`]);
    abort.abort();
    expect(broker.live()).toHaveLength(0);
  });

  test("a broken Redis subscription ends the stream so the client reconnects and resyncs", async () => {
    const broker = fakeBroker();
    fakeRedis = broker.redis;
    const { res } = open();
    const reader = (await res).body!.getReader();
    await readFrames(reader, 1);
    broker.emit(broker.live()[0]!, "error", new Error("stream ended"));
    await expect(reader.read()).resolves.toEqual({ value: undefined, done: true });
    expect(medicalQaEmitter.listenerCount(room)).toBe(0);
  });

  test("a client that disconnects while waiting for Redis leaves no subscription behind", async () => {
    const broker = fakeBroker();
    fakeRedis = broker.redis;
    const { res, abort } = open();
    const response = await res;
    abort.abort();
    const reader = response.body!.getReader();
    await readFrames(reader, 5);
    await new Promise((r) => setTimeout(r, 0));
    expect(broker.live()).toHaveLength(0);
    expect(medicalQaEmitter.listenerCount(room)).toBe(0);
  });
});
