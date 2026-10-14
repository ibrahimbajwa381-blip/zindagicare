/**
 * Cross-instance fan-out. Two fan-outs with separate EventEmitters stand in for
 * two Vercel instances; a fake in-memory broker stands in for Upstash Pub/Sub
 * (the real client is never constructed under NODE_ENV=test).
 */
import { EventEmitter } from "events";
import {
  createRedisFanout,
  type FanoutRedis,
  type FanoutSubscription,
} from "@/lib/realtime/redis-fanout";
import { sanitizeMedicalQaEvent, questionRoomKey, type MedicalQaRealtimeEvent } from "@/lib/realtime/medical-qa-emitter";

const Q1 = "64b7f0c2a1b2c3d4e5f60718";
const Q2 = "64b7f0c2a1b2c3d4e5f60719";
const A1 = "74b7f0c2a1b2c3d4e5f60718";

type FakeSub = {
  channel: string;
  listeners: Record<string, ((data: never) => void)[]>;
  closed: boolean;
  emit(type: string, data: unknown): void;
};

function createBroker(options: { autoConfirm?: boolean } = {}) {
  const { autoConfirm = true } = options;
  const subs: FakeSub[] = [];
  const published: { channel: string; message: string }[] = [];
  let failPublish: Error | null = null;
  let hangPublish = false;

  function client(): FanoutRedis {
    return {
      async publish(channel, message) {
        if (failPublish) throw failPublish;
        if (hangPublish) return new Promise(() => {});
        published.push({ channel, message });
        // Upstash delivers the raw string (automaticDeserialization: false).
        for (const s of subs) if (!s.closed && s.channel === channel) s.emit("message", { channel, message });
        return 1;
      },
      subscribe(channel) {
        const sub: FakeSub = {
          channel,
          listeners: {},
          closed: false,
          emit(type, data) {
            for (const l of this.listeners[type] ?? []) l(data as never);
          },
        };
        subs.push(sub);
        if (autoConfirm) queueMicrotask(() => sub.emit("subscribe", 1));
        const api: FanoutSubscription = {
          on(type: string, listener: (data: never) => void) {
            (sub.listeners[type] ??= []).push(listener);
          },
          async unsubscribe() {
            sub.closed = true;
          },
        } as FanoutSubscription;
        return api;
      },
    };
  }

  return {
    client,
    subs,
    published,
    live: () => subs.filter((s) => !s.closed),
    setFailPublish: (e: Error | null) => (failPublish = e),
    setHangPublish: (v: boolean) => (hangPublish = v),
  };
}

function instance(getRedis: () => FanoutRedis | null, extra: Partial<Parameters<typeof createRedisFanout>[0]> = {}) {
  const emitter = new EventEmitter();
  const fanout = createRedisFanout<MedicalQaRealtimeEvent>({
    name: "test",
    emitter,
    getRedis,
    channelFor: (room) => `zindagi:rt:${room}`,
    parse: sanitizeMedicalQaEvent,
    roomOf: (e) => questionRoomKey(e.questionId),
    readyTimeoutMs: 50,
    publishTimeoutMs: 50,
    ...(extra as object),
  });
  return { emitter, fanout };
}

function viewer() {
  const events: MedicalQaRealtimeEvent[] = [];
  let resets = 0;
  return {
    events,
    resets: () => resets,
    listener: { onEvent: (e: MedicalQaRealtimeEvent) => events.push(e), onReset: () => (resets += 1) },
  };
}

let errorSpy: jest.SpyInstance;
beforeEach(() => {
  errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => errorSpy.mockRestore());

describe("redis fan-out across instances", () => {
  test("an event published on instance A reaches a viewer connected to instance B", async () => {
    const broker = createBroker();
    const a = instance(broker.client);
    const b = instance(broker.client);
    const onB = viewer();
    const release = await b.fanout.subscribe(questionRoomKey(Q1), onB.listener);

    await expect(a.fanout.publish({ type: "answer_created", questionId: Q1, answerId: A1 })).resolves.toBe("redis");
    expect(onB.events).toEqual([{ type: "answer_created", questionId: Q1, answerId: A1 }]);
    release();
  });

  test("the publishing instance's own viewers get the event exactly once (via Redis, not also locally)", async () => {
    const broker = createBroker();
    const a = instance(broker.client);
    const onA = viewer();
    await a.fanout.subscribe(questionRoomKey(Q1), onA.listener);
    await a.fanout.publish({ type: "question_updated", questionId: Q1 });
    expect(onA.events).toHaveLength(1);
  });

  test("events for other questions are not delivered", async () => {
    const broker = createBroker();
    const a = instance(broker.client);
    const b = instance(broker.client);
    const onB = viewer();
    await b.fanout.subscribe(questionRoomKey(Q1), onB.listener);
    await a.fanout.publish({ type: "question_updated", questionId: Q2 });
    expect(onB.events).toEqual([]);
  });

  test("one shared Redis subscription per room per instance, closed when the last viewer leaves", async () => {
    const broker = createBroker();
    const b = instance(broker.client);
    const r1 = await b.fanout.subscribe(questionRoomKey(Q1), viewer().listener);
    const r2 = await b.fanout.subscribe(questionRoomKey(Q1), viewer().listener);
    expect(broker.live()).toHaveLength(1);
    r1();
    r1(); // double release is harmless
    expect(broker.live()).toHaveLength(1);
    r2();
    expect(broker.live()).toHaveLength(0);
    expect(b.emitter.listenerCount(questionRoomKey(Q1))).toBe(0);
  });

  test("a shared subscription is rotated for new viewers after its max age", async () => {
    const broker = createBroker();
    let clock = 0;
    const b = instance(broker.client, { now: () => clock, maxSubscriptionAgeMs: 1000 });
    const r1 = await b.fanout.subscribe(questionRoomKey(Q1), viewer().listener);
    clock = 2000;
    const r2 = await b.fanout.subscribe(questionRoomKey(Q1), viewer().listener);
    expect(broker.subs).toHaveLength(2);
    r1();
    expect(broker.live()).toHaveLength(1); // old one closed with its last viewer
    r2();
    expect(broker.live()).toHaveLength(0);
  });

  test("while an old and a rotated subscription overlap, each viewer still gets each event once", async () => {
    const broker = createBroker();
    let clock = 0;
    const a = instance(broker.client);
    const b = instance(broker.client, { now: () => clock, maxSubscriptionAgeMs: 1000 });
    const oldViewer = viewer();
    const newViewer = viewer();
    await b.fanout.subscribe(questionRoomKey(Q1), oldViewer.listener);
    clock = 2000;
    await b.fanout.subscribe(questionRoomKey(Q1), newViewer.listener);
    expect(broker.live()).toHaveLength(2);
    await a.fanout.publish({ type: "question_updated", questionId: Q1 });
    expect(oldViewer.events).toHaveLength(1);
    expect(newViewer.events).toHaveLength(1);
  });

  test("malformed or foreign messages from Redis are dropped; extra fields are stripped", async () => {
    const broker = createBroker();
    const b = instance(broker.client);
    const onB = viewer();
    await b.fanout.subscribe(questionRoomKey(Q1), onB.listener);
    const sub = broker.live()[0]!;
    const channel = sub.channel;
    sub.emit("message", { channel, message: "not json" });
    sub.emit("message", { channel, message: JSON.stringify({ type: "evil", questionId: Q1 }) });
    sub.emit("message", { channel, message: JSON.stringify({ type: "question_updated", questionId: Q2 }) });
    sub.emit("message", { channel, message: JSON.stringify({ type: "answer_created", questionId: Q1, answerId: "x" }) });
    sub.emit("message", {
      channel,
      message: JSON.stringify({ type: "answer_created", questionId: Q1, answerId: A1, body: "patient text" }),
    });
    expect(onB.events).toEqual([{ type: "answer_created", questionId: Q1, answerId: A1 }]);
  });

  test("duplicate deliveries are forwarded as-is (clients debounce; events are only refresh hints)", async () => {
    const broker = createBroker();
    const b = instance(broker.client);
    const onB = viewer();
    await b.fanout.subscribe(questionRoomKey(Q1), onB.listener);
    const sub = broker.live()[0]!;
    const message = JSON.stringify({ type: "question_updated", questionId: Q1 });
    sub.emit("message", { channel: sub.channel, message });
    sub.emit("message", { channel: sub.channel, message });
    expect(onB.events).toHaveLength(2);
  });
});

describe("redis failures", () => {
  test("publish failure falls back to this instance's viewers and never throws", async () => {
    const broker = createBroker();
    const a = instance(broker.client);
    const onA = viewer();
    await a.fanout.subscribe(questionRoomKey(Q1), onA.listener);
    broker.setFailPublish(new Error("ECONNRESET"));
    await expect(a.fanout.publish({ type: "question_updated", questionId: Q1 })).resolves.toBe("local");
    expect(onA.events).toHaveLength(1);
    expect(errorSpy).toHaveBeenCalled();
    expect(JSON.stringify(errorSpy.mock.calls)).not.toContain(Q1);
  });

  test("a hanging publish times out and falls back locally", async () => {
    const broker = createBroker();
    const a = instance(broker.client);
    const onA = viewer();
    await a.fanout.subscribe(questionRoomKey(Q1), onA.listener);
    broker.setHangPublish(true);
    await expect(a.fanout.publish({ type: "question_updated", questionId: Q1 })).resolves.toBe("local");
    expect(onA.events).toHaveLength(1);
  });

  test("no Redis configured: single-instance delivery through the local emitter", async () => {
    const a = instance(() => null);
    const onA = viewer();
    await a.fanout.subscribe(questionRoomKey(Q1), onA.listener);
    await expect(a.fanout.publish({ type: "question_updated", questionId: Q1 })).resolves.toBe("local");
    expect(onA.events).toHaveLength(1);
  });

  test("Redis client creation throwing behaves like no Redis", async () => {
    const a = instance(() => {
      throw new Error("bad config");
    });
    const onA = viewer();
    await a.fanout.subscribe(questionRoomKey(Q1), onA.listener);
    await expect(a.fanout.publish({ type: "question_updated", questionId: Q1 })).resolves.toBe("local");
    expect(onA.events).toHaveLength(1);
  });

  test("a confirmed subscription that breaks resets its viewers and is replaced for the next viewer", async () => {
    const broker = createBroker();
    const b = instance(broker.client);
    const v1 = viewer();
    const v2 = viewer();
    await b.fanout.subscribe(questionRoomKey(Q1), v1.listener);
    await b.fanout.subscribe(questionRoomKey(Q1), v2.listener);
    broker.live()[0]!.emit("error", new Error("stream ended"));
    expect(v1.resets()).toBe(1);
    expect(v2.resets()).toBe(1);
    expect(b.fanout.activeSubscriptionCount()).toBe(0);
    await b.fanout.subscribe(questionRoomKey(Q1), viewer().listener);
    expect(broker.live()).toHaveLength(1);
  });

  test("a subscription that never comes up (Redis unreachable) keeps viewers on local delivery, no reset loop", async () => {
    const broker = createBroker({ autoConfirm: false });
    const b = instance(broker.client);
    const v = viewer();
    const pending = b.fanout.subscribe(questionRoomKey(Q1), v.listener);
    broker.subs[0]!.emit("error", new Error("HTTP 401"));
    await pending; // resolves promptly, not after the ready timeout
    expect(v.resets()).toBe(0);
    expect(b.fanout.activeSubscriptionCount()).toBe(0);
    // Same-instance fallback delivery still reaches the viewer.
    broker.setFailPublish(new Error("down"));
    await b.fanout.publish({ type: "question_updated", questionId: Q1 });
    expect(v.events).toHaveLength(1);
  });

  test("no Redis subscription is left behind after every viewer leaves, whatever happened", async () => {
    const broker = createBroker();
    const b = instance(broker.client);
    const releases = await Promise.all(
      [Q1, Q1, Q2, Q1].map((q) => b.fanout.subscribe(questionRoomKey(q), viewer().listener)),
    );
    broker.live().find((s) => s.channel.endsWith(Q2))!.emit("error", new Error("x"));
    for (const r of releases) r();
    expect(broker.live()).toHaveLength(0);
    expect(b.emitter.eventNames()).toEqual([]);
  });

  test("subscribe resolves after the ready timeout when Redis never confirms", async () => {
    const broker = createBroker({ autoConfirm: false });
    const b = instance(broker.client);
    const started = Date.now();
    const release = await b.fanout.subscribe(questionRoomKey(Q1), viewer().listener);
    expect(Date.now() - started).toBeGreaterThanOrEqual(40);
    release();
  });
});

describe("medical Q&A event sanitizing", () => {
  test("keeps only known types and valid ids", () => {
    expect(sanitizeMedicalQaEvent({ type: "question_updated", questionId: Q1, title: "x" })).toEqual({
      type: "question_updated",
      questionId: Q1,
    });
    expect(sanitizeMedicalQaEvent({ type: "question_updated", questionId: "abc" })).toBeNull();
    expect(sanitizeMedicalQaEvent(null)).toBeNull();
    expect(sanitizeMedicalQaEvent("x")).toBeNull();
  });
});
