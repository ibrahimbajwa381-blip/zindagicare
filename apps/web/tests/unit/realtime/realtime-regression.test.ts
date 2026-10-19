/**
 * Regression tests: one per defect found in review, written so each fails
 * against the old behavior.
 *
 *  R1  SSE hook closed the connection for good on the first error.
 *  R2  Missed events were never recovered after reconnect / tab return.
 *  R3  Q&A publish ran un-awaited after the response (dropped on Vercel).
 *  R4  The SDK subscriber swallowed stream ends/errors (dead but "healthy").
 *  R5  Overlapping rotated subscriptions delivered each event twice.
 *  R6  One throwing viewer broke delivery for every other viewer.
 *  R7  Posting an answer refreshed twice (local callback + own SSE echo).
 *  R8  Redis unreachable at startup caused a reconnect loop.
 */
const afterCallbacks: (() => unknown)[] = [];
let afterAvailable = true;
jest.mock("next/server", () => ({
  after: (cb: () => unknown) => {
    if (!afterAvailable) throw new Error("outside request scope");
    afterCallbacks.push(cb);
  },
}));
const publishSpy = jest.fn();
jest.mock("@/lib/realtime/medical-qa-emitter", () => ({
  ...jest.requireActual("@/lib/realtime/medical-qa-emitter"),
  publishMedicalQaEvent: (...args: unknown[]) => publishSpy(...args),
}));

import { scheduleMedicalQaPublish } from "@/server/lib/schedule-medical-qa-publish";
import { connectReconnectingEventSource, type EventSourceLike } from "@/lib/realtime/reconnecting-event-source";
import { subscribeUpstashStream } from "@/server/lib/realtime-redis";
import { createOwnEchoFilter, createRefreshCoordinator } from "@/features/medical-qa/lib/live-refresh";
import { questionRoomKey } from "@/lib/realtime/medical-qa-emitter";
import { createFakeBroker, createQaInstance, recordingViewer } from "../../helpers/fake-redis-broker";

const Q1 = "64b7f0c2a1b2c3d4e5f60718";
const room1 = questionRoomKey(Q1);

class FakeSource implements EventSourceLike {
  onmessage: ((m: { data: string }) => void) | null = null;
  onerror: ((e: unknown) => void) | null = null;
  closed = false;
  close() {
    this.closed = true;
  }
}

let errorSpy: jest.SpyInstance;
beforeEach(() => {
  errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  afterCallbacks.length = 0;
  afterAvailable = true;
  publishSpy.mockReset();
});
afterEach(() => {
  errorSpy.mockRestore();
  jest.useRealTimers();
});

test("R1: an SSE error is followed by a reconnect, not a permanent close", () => {
  jest.useFakeTimers();
  const sources: FakeSource[] = [];
  const stop = connectReconnectingEventSource({
    url: "/x",
    onEvent: () => {},
    onResync: () => {},
    visibility: null,
    createEventSource: () => {
      const s = new FakeSource();
      sources.push(s);
      return s;
    },
  });
  sources[0]!.onerror?.({});
  jest.advanceTimersByTime(1000);
  expect(sources).toHaveLength(2);
  stop();
});

test("R2: a reconnect triggers a resync so missed events are recovered", () => {
  jest.useFakeTimers();
  const sources: FakeSource[] = [];
  const resyncs: string[] = [];
  const stop = connectReconnectingEventSource({
    url: "/x",
    onEvent: () => {},
    onResync: (r) => resyncs.push(r),
    visibility: null,
    createEventSource: () => {
      const s = new FakeSource();
      sources.push(s);
      return s;
    },
  });
  sources[0]!.onerror?.({});
  jest.advanceTimersByTime(1000);
  sources[1]!.onmessage?.({ data: '{"type":"connected"}' });
  expect(resyncs).toEqual(["connected"]);
  stop();
});

describe("R3: publish is handed to after() (Vercel waitUntil), never left dangling", () => {
  test("inside a request: registered with after(), not run inline", async () => {
    scheduleMedicalQaPublish({ type: "question_updated", questionId: Q1 });
    expect(publishSpy).not.toHaveBeenCalled();
    expect(afterCallbacks).toHaveLength(1);
    await afterCallbacks[0]!();
    expect(publishSpy).toHaveBeenCalledWith({ type: "question_updated", questionId: Q1 });
  });

  test("the after() task settles (resolves) even when publishing rejects or throws", async () => {
    publishSpy.mockRejectedValueOnce(new Error("redis down"));
    scheduleMedicalQaPublish({ type: "question_updated", questionId: Q1 });
    await expect(afterCallbacks[0]!()).resolves.toBeUndefined();

    publishSpy.mockImplementationOnce(() => {
      throw new Error("sync throw");
    });
    scheduleMedicalQaPublish({ type: "question_updated", questionId: Q1 });
    await expect(afterCallbacks[1]!()).resolves.toBeUndefined();
  });

  test("outside a request scope: runs immediately instead of being lost", () => {
    afterAvailable = false;
    expect(() => scheduleMedicalQaPublish({ type: "question_updated", questionId: Q1 })).not.toThrow();
    expect(publishSpy).toHaveBeenCalledTimes(1);
  });
});

test("R4: a subscribe stream that ends by itself is reported as an error", async () => {
  const fetchImpl = (async () =>
    new Response(
      new ReadableStream({
        start(c) {
          c.close();
        },
      }),
    )) as unknown as typeof fetch;
  const errors: string[] = [];
  subscribeUpstashStream({ url: "https://e.test", token: "t", channel: "c", fetchImpl }).on("error", (e) =>
    errors.push(e.message),
  );
  await new Promise((r) => setTimeout(r, 5));
  expect(errors).toEqual(["subscribe stream ended"]);
});

test("R5: overlapping rotated subscriptions deliver each event to each viewer once", async () => {
  const broker = createFakeBroker();
  let clock = 0;
  const b = createQaInstance(() => broker.redis, { now: () => clock, maxSubscriptionAgeMs: 10 });
  const v1 = recordingViewer();
  const v2 = recordingViewer();
  await b.fanout.subscribe(room1, v1.listener);
  clock = 100;
  await b.fanout.subscribe(room1, v2.listener);
  await createQaInstance(() => broker.redis).fanout.publish({ type: "question_updated", questionId: Q1 });
  expect([v1.events.length, v2.events.length]).toEqual([1, 1]);
});

test("R6: a throwing viewer doesn't break delivery to others", async () => {
  const broker = createFakeBroker();
  const b = createQaInstance(() => broker.redis);
  const good = recordingViewer();
  await b.fanout.subscribe(room1, {
    onEvent: () => {
      throw new Error("x");
    },
    onReset: () => {
      throw new Error("y");
    },
  });
  await b.fanout.subscribe(room1, good.listener);
  await b.fanout.publish({ type: "question_updated", questionId: Q1 });
  broker.subs[0]!.emit("error", new Error("z"));
  expect(good.events).toHaveLength(1);
  expect(good.resets()).toBe(1);
});

test("R7: posting an answer refreshes once even though its SSE echo arrives", async () => {
  jest.useFakeTimers();
  let loads = 0;
  const refresher = createRefreshCoordinator({ load: async () => ++loads, apply: () => {} });
  const echoes = createOwnEchoFilter();
  echoes.remember("a1");
  const done = refresher.now();
  if (!echoes.isOwnEcho({ type: "answer_created", answerId: "a1" })) refresher.schedule();
  await done;
  await jest.advanceTimersByTimeAsync(1000);
  expect(loads).toBe(1);
});

test("R8: Redis unreachable at startup does not make viewers reconnect-loop", async () => {
  const broker = createFakeBroker({ autoConfirm: false });
  const b = createQaInstance(() => broker.redis);
  const v = recordingViewer();
  const ready = b.fanout.subscribe(room1, v.listener);
  broker.subs[0]!.emit("error", new Error("ECONNREFUSED"));
  await ready;
  expect(v.resets()).toBe(0);
});

test("R9: returning to a tab while the stream is down (e.g. rate-limited) still refreshes data", () => {
  jest.useFakeTimers();
  const sources: FakeSource[] = [];
  const resyncs: string[] = [];
  let state = "visible";
  const listeners = new Set<() => void>();
  const stop = connectReconnectingEventSource({
    url: "/x",
    onEvent: () => {},
    onResync: (r) => resyncs.push(r),
    visibility: {
      get visibilityState() {
        return state;
      },
      addEventListener: (_: "visibilitychange", l: () => void) => listeners.add(l),
      removeEventListener: (_: "visibilitychange", l: () => void) => listeners.delete(l),
    },
    createEventSource: () => {
      const s = new FakeSource();
      sources.push(s);
      return s;
    },
  });
  sources[0]!.onerror?.({}); // e.g. 429: waiting out the backoff
  state = "hidden";
  listeners.forEach((l) => l());
  state = "visible";
  listeners.forEach((l) => l());
  expect(resyncs).toEqual(["visible"]); // data refreshed through the normal API right away
  expect(sources).toHaveLength(2); // and a reconnect was attempted
  sources[1]!.onerror?.({}); // the reconnect is rejected again
  expect(resyncs).toEqual(["visible"]);
  stop();
});
