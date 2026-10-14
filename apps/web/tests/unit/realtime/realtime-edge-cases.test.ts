/**
 * Edge cases and boundary values for the server-side realtime path:
 * fan-out timing limits, subscription rotation, viewer isolation and the
 * Upstash stream reader's parsing limits.
 */
import { subscribeUpstashStream } from "@/server/lib/realtime-redis";
import { questionRoomKey } from "@/lib/realtime/medical-qa-emitter";
import { createFakeBroker, createQaInstance, recordingViewer } from "../../helpers/fake-redis-broker";

const Q1 = "64b7f0c2a1b2c3d4e5f60718";
const Q2 = "64b7f0c2a1b2c3d4e5f60719";
const room1 = questionRoomKey(Q1);

let errorSpy: jest.SpyInstance;
beforeEach(() => {
  errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  errorSpy.mockRestore();
  jest.useRealTimers();
});

describe("boundary: subscription rotation age", () => {
  test.each([
    [999, 1], // just under the limit: reused
    [1000, 2], // exactly at the limit: rotated
    [1001, 2], // over: rotated
  ])("a viewer joining at age %ims -> %i Redis subscription(s)", async (age, expected) => {
    const broker = createFakeBroker();
    let clock = 0;
    const b = createQaInstance(() => broker.redis, { now: () => clock, maxSubscriptionAgeMs: 1000 });
    await b.fanout.subscribe(room1, recordingViewer().listener);
    clock = age;
    await b.fanout.subscribe(room1, recordingViewer().listener);
    expect(broker.subs).toHaveLength(expected);
  });
});

describe("boundary: publish timeout", () => {
  test("a publish that answers just inside the timeout counts as delivered via Redis", async () => {
    const broker = createFakeBroker();
    broker.state.publishDelayMs = 10;
    const a = createQaInstance(() => broker.redis, { publishTimeoutMs: 200 });
    await expect(a.fanout.publish({ type: "question_updated", questionId: Q1 })).resolves.toBe("redis");
  });

  test("a publish slower than the timeout falls back to local, exactly once (no late double delivery)", async () => {
    const broker = createFakeBroker();
    broker.state.publishDelayMs = 80;
    const a = createQaInstance(() => broker.redis, { publishTimeoutMs: 20 });
    const v = recordingViewer();
    await a.fanout.subscribe(room1, v.listener);
    await expect(a.fanout.publish({ type: "question_updated", questionId: Q1 })).resolves.toBe("local");
    expect(v.events).toHaveLength(1);
    // The slow publish eventually lands in Redis too: a known, documented
    // duplicate that the client's 400ms debounce absorbs.
    await new Promise((r) => setTimeout(r, 100));
    expect(v.events.length).toBeLessThanOrEqual(2);
  });
});

describe("boundary: ready timeout", () => {
  test("subscribe waits for confirmation but never longer than readyTimeoutMs", async () => {
    jest.useFakeTimers();
    const broker = createFakeBroker({ autoConfirm: false });
    const b = createQaInstance(() => broker.redis, { readyTimeoutMs: 3000 });
    let done = false;
    void b.fanout.subscribe(room1, recordingViewer().listener).then(() => (done = true));
    await jest.advanceTimersByTimeAsync(2999);
    expect(done).toBe(false);
    await jest.advanceTimersByTimeAsync(1);
    expect(done).toBe(true);
  });

  test("a late confirmation after the timeout still delivers afterwards", async () => {
    const broker = createFakeBroker({ autoConfirm: false });
    const b = createQaInstance(() => broker.redis, { readyTimeoutMs: 10 });
    const v = recordingViewer();
    await b.fanout.subscribe(room1, v.listener);
    broker.subs[0]!.emit("subscribe", 1);
    await createQaInstance(() => broker.redis).fanout.publish({ type: "question_updated", questionId: Q1 });
    expect(v.events).toHaveLength(1);
  });
});

describe("edge: viewer isolation", () => {
  test("a viewer whose callback throws doesn't stop delivery to the others or kill the subscription", async () => {
    const broker = createFakeBroker();
    const b = createQaInstance(() => broker.redis);
    const good = recordingViewer();
    await b.fanout.subscribe(room1, {
      onEvent: () => {
        throw new Error("viewer bug");
      },
      onReset: () => {},
    });
    await b.fanout.subscribe(room1, good.listener);
    await b.fanout.publish({ type: "question_updated", questionId: Q1 });
    await b.fanout.publish({ type: "question_updated", questionId: Q1 });
    expect(good.events).toHaveLength(2);
    expect(broker.live()).toHaveLength(1);
    expect(good.resets()).toBe(0);
  });

  test("a throwing viewer on local delivery doesn't make publish throw or skip other viewers", async () => {
    const a = createQaInstance(() => null);
    const good = recordingViewer();
    await a.fanout.subscribe(room1, {
      onEvent: () => {
        throw new Error("viewer bug");
      },
      onReset: () => {},
    });
    await a.fanout.subscribe(room1, good.listener);
    await expect(a.fanout.publish({ type: "question_updated", questionId: Q1 })).resolves.toBe("local");
    expect(good.events).toHaveLength(1);
  });

  test("a viewer that leaves before the subscription is confirmed gets nothing afterwards", async () => {
    const broker = createFakeBroker({ autoConfirm: false });
    const b = createQaInstance(() => broker.redis, { readyTimeoutMs: 10 });
    const v = recordingViewer();
    const release = await b.fanout.subscribe(room1, v.listener);
    release();
    broker.subs[0]!.emit("subscribe", 1);
    broker.subs[0]!.emit("message", {
      channel: broker.subs[0]!.channel,
      message: JSON.stringify({ type: "question_updated", questionId: Q1 }),
    });
    expect(v.events).toEqual([]);
    expect(broker.live()).toHaveLength(0);
  });

  test("an error after the last viewer left does not reset anyone or reopen anything", async () => {
    const broker = createFakeBroker();
    const b = createQaInstance(() => broker.redis);
    const v = recordingViewer();
    const release = await b.fanout.subscribe(room1, v.listener);
    release();
    broker.subs[0]!.emit("error", new Error("late"));
    expect(v.resets()).toBe(0);
    expect(broker.subs).toHaveLength(1);
  });

  test("repeated errors on one subscription reset viewers only once", async () => {
    const broker = createFakeBroker();
    const b = createQaInstance(() => broker.redis);
    const v = recordingViewer();
    await b.fanout.subscribe(room1, v.listener);
    broker.subs[0]!.emit("error", new Error("1"));
    broker.subs[0]!.emit("error", new Error("2"));
    expect(v.resets()).toBe(1);
  });

  test("rooms are independent: a failure on one question doesn't affect another", async () => {
    const broker = createFakeBroker();
    const b = createQaInstance(() => broker.redis);
    const v1 = recordingViewer();
    const v2 = recordingViewer();
    await b.fanout.subscribe(room1, v1.listener);
    await b.fanout.subscribe(questionRoomKey(Q2), v2.listener);
    broker.subs[0]!.emit("error", new Error("x"));
    await createQaInstance(() => broker.redis).fanout.publish({ type: "question_updated", questionId: Q2 });
    expect(v1.resets()).toBe(1);
    expect(v2.resets()).toBe(0);
    expect(v2.events).toHaveLength(1);
  });

  test("the production emitter allows unlimited SSE listeners (no MaxListeners warning at scale)", () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { medicalQaEmitter } = require("@/lib/realtime/medical-qa-emitter");
    expect(medicalQaEmitter.getMaxListeners()).toBe(0);
  });

  test("many viewers of one question share a single Redis subscription (bounded Redis load)", async () => {
    const broker = createFakeBroker();
    const b = createQaInstance(() => broker.redis);
    const releases = await Promise.all(Array.from({ length: 200 }, () => b.fanout.subscribe(room1, recordingViewer().listener)));
    expect(broker.subs).toHaveLength(1);
    releases.forEach((r) => r());
    expect(broker.live()).toHaveLength(0);
  });
});

describe("edge: publish inputs", () => {
  test("Redis that becomes unconfigured between calls falls back cleanly", async () => {
    const broker = createFakeBroker();
    let redis: typeof broker.redis | null = broker.redis;
    const a = createQaInstance(() => redis);
    await expect(a.fanout.publish({ type: "question_updated", questionId: Q1 })).resolves.toBe("redis");
    redis = null;
    await expect(a.fanout.publish({ type: "question_updated", questionId: Q1 })).resolves.toBe("local");
  });

  test("a publish with nobody listening anywhere is a harmless no-op", async () => {
    const a = createQaInstance(() => null);
    await expect(a.fanout.publish({ type: "question_updated", questionId: Q1 })).resolves.toBe("local");
  });

  test("failure logging is throttled to one line per minute", async () => {
    const broker = createFakeBroker();
    broker.state.failPublish = new Error("down");
    let clock = 0;
    const a = createQaInstance(() => broker.redis, { now: () => clock });
    for (let i = 0; i < 50; i++) await a.fanout.publish({ type: "question_updated", questionId: Q1 });
    expect(errorSpy).toHaveBeenCalledTimes(1);
    clock = 60_000;
    await a.fanout.publish({ type: "question_updated", questionId: Q1 });
    expect(errorSpy).toHaveBeenCalledTimes(2);
  });
});

describe("edge: Upstash stream parsing", () => {
  function streamOf(chunks: string[], opts: { close?: boolean } = {}) {
    const encoder = new TextEncoder();
    const fetchImpl = (async () =>
      new Response(
        new ReadableStream<Uint8Array>({
          start(c) {
            chunks.forEach((ch) => c.enqueue(encoder.encode(ch)));
            if (opts.close) c.close();
          },
        }),
      )) as unknown as typeof fetch;
    const got = { subscribe: [] as number[], message: [] as { channel: string; message: unknown }[], error: [] as string[] };
    const sub = subscribeUpstashStream({ url: "https://e.test", token: "t", channel: "c", fetchImpl });
    sub.on("subscribe", (n) => got.subscribe.push(n));
    sub.on("message", (m) => got.message.push(m));
    sub.on("error", (e) => got.error.push(e.message));
    return { sub, got };
  }
  const settle = () => new Promise((r) => setTimeout(r, 5));

  test("several events in one chunk, one event across many chunks", async () => {
    const line = 'data: message,c,{"a":1}\n';
    const { sub, got } = streamOf(["data: subscribe,c,1\n" + line + line, ...line.split("")]);
    await settle();
    expect(got.subscribe).toEqual([1]);
    expect(got.message).toHaveLength(3);
    await sub.unsubscribe();
  });

  test("ignores comments, blank lines, unknown types and lines without two commas", async () => {
    const { sub, got } = streamOf([": ping\n\n", "data: pong\n", "data: message,c\n", "event: x\n", "data: unsubscribe,c,0\n"]);
    await settle();
    expect(got.message).toEqual([]);
    expect(got.error).toEqual([]);
    await sub.unsubscribe();
  });

  test("an empty payload is passed through as an empty string (the fan-out then drops it)", async () => {
    const { sub, got } = streamOf(["data: message,c,\n"]);
    await settle();
    expect(got.message).toEqual([{ channel: "c", message: "" }]);
    await sub.unsubscribe();
  });

  test("boundary: a line growing past 1MB without a newline is rejected as an error", async () => {
    const { got } = streamOf(["data: message,c,", "x".repeat(1_000_001)]);
    await settle();
    expect(got.error).toEqual(["subscribe stream buffer exceeded"]);
  });

  test("boundary: a complete line just under 1MB is still delivered", async () => {
    const payload = "x".repeat(999_000);
    const { sub, got } = streamOf([`data: message,c,${payload}\n`]);
    await settle();
    expect(got.message).toHaveLength(1);
    await sub.unsubscribe();
  });

  test("an error is reported exactly once even if the stream ends after data", async () => {
    const { got } = streamOf(["data: subscribe,c,1\n"], { close: true });
    await settle();
    expect(got.error).toEqual(["subscribe stream ended"]);
  });

  test("unsubscribe twice is harmless", async () => {
    const { sub, got } = streamOf([]);
    await sub.unsubscribe();
    await sub.unsubscribe();
    await settle();
    expect(got.error).toEqual([]);
  });
});
