/**
 * Security cases for the public Q&A realtime channel:
 *  - only ids ever leave the server (no question/answer text, names, URLs);
 *  - nothing from Redis or the URL can inject SSE frames or spoof control events;
 *  - malformed/hostile ids never reach Redis channel names;
 *  - prototype pollution and oversized/odd payloads are inert;
 *  - credentials never appear in requests' URLs, errors or logs.
 */
import { createFakeBroker } from "../../helpers/fake-redis-broker";
import type { FanoutRedis } from "@/lib/realtime/redis-fanout";

let fakeRedis: FanoutRedis | null = null;
jest.mock("@/server/lib/realtime-redis", () => {
  const actual = jest.requireActual("@/server/lib/realtime-redis");
  return { ...actual, getRealtimeRedis: () => fakeRedis };
});

import { GET } from "@/app/api/v1/medical-questions/[id]/events/route";
import {
  medicalQaEmitter,
  publishMedicalQaEvent,
  questionRoomKey,
  sanitizeMedicalQaEvent,
} from "@/lib/realtime/medical-qa-emitter";
import { subscribeUpstashStream } from "@/server/lib/realtime-redis";

const Q1 = "64b7f0c2a1b2c3d4e5f60718";
const A1 = "74b7f0c2a1b2c3d4e5f60718";
const VALID_FRAME = `data: ${JSON.stringify({ type: "question_updated", questionId: Q1 })}\n\n`;

function open(path: string) {
  const abort = new AbortController();
  return { abort, res: GET(new Request(`http://localhost${path}`, { signal: abort.signal })) };
}

// Reads whatever arrives within `waitMs`. A read still pending when the
// window closes is kept for the next call, so no chunk is ever dropped.
const pendingReads = new WeakMap<object, Promise<ReadableStreamReadResult<Uint8Array>>>();
async function readAll(reader: ReadableStreamDefaultReader<Uint8Array>, waitMs = 20) {
  const decoder = new TextDecoder();
  let text = "";
  const deadline = Date.now() + waitMs;
  while (Date.now() < deadline) {
    const pending = pendingReads.get(reader) ?? reader.read();
    pendingReads.set(reader, pending);
    const next = await Promise.race([
      pending,
      new Promise<null>((r) => setTimeout(() => r(null), Math.max(1, deadline - Date.now()))),
    ]);
    if (!next) break;
    pendingReads.delete(reader);
    if (next.done) break;
    text += decoder.decode(next.value, { stream: true });
  }
  return text;
}

let errorSpy: jest.SpyInstance;
beforeEach(() => {
  errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  errorSpy.mockRestore();
  fakeRedis = null;
  medicalQaEmitter.removeAllListeners();
});

describe("hostile question ids never open a stream or a Redis subscription", () => {
  test.each([
    ["too short (23)", "64b7f0c2a1b2c3d4e5f6071"],
    ["too long (25)", "64b7f0c2a1b2c3d4e5f607180"],
    ["non-hex", "zzzzzzzzzzzzzzzzzzzzzzzz"],
    ["glob pattern", "*"],
    ["redis pattern chars", "64b7f0c2a1b2c3d4e5f6071?"],
    ["encoded newline", "64b7f0c2a1b2c3d4e5f60718%0A"],
    ["encoded slash", "..%2F..%2Fadmin"],
    ["NoSQL operator", "%24where"],
    ["huge", "a".repeat(10_000)],
  ])("%s -> 404", async (_label, id) => {
    const broker = createFakeBroker();
    fakeRedis = broker.redis;
    const response = await open(`/api/v1/medical-questions/${id}/events`).res;
    expect(response.status).toBe(404);
    expect(broker.subs).toHaveLength(0);
    expect(medicalQaEmitter.eventNames()).toEqual([]);
  });

  test("uppercase hex is a valid ObjectId and maps to the same channel as lowercase", async () => {
    const broker = createFakeBroker();
    fakeRedis = broker.redis;
    const { res, abort } = open(`/api/v1/medical-questions/${Q1.toUpperCase()}/events`);
    expect((await res).status).toBe(200);
    await readAll((await res).body!.getReader(), 10);
    expect(broker.subs.map((s) => s.channel)).toEqual([`zindagi:rt:${questionRoomKey(Q1.toUpperCase())}`]);
    abort.abort();
  });
});

describe("only ids leave the server", () => {
  test("extra fields passed to publish (text, names, URLs) are stripped before Redis and before SSE", async () => {
    const broker = createFakeBroker();
    fakeRedis = broker.redis;
    const { res, abort } = open(`/api/v1/medical-questions/${Q1}/events`);
    const reader = (await res).body!.getReader();
    await readAll(reader, 10);

    await publishMedicalQaEvent({
      type: "answer_created",
      questionId: Q1,
      answerId: A1,
      body: "I have chest pain",
      authorName: "Patient Name",
      photoUrl: "https://storage/private.jpg",
    } as never);

    expect(broker.published.map((p) => JSON.parse(p.message))).toEqual([
      { type: "answer_created", questionId: Q1, answerId: A1 },
    ]);
    const text = await readAll(reader);
    expect(text).toContain(A1);
    expect(text).not.toMatch(/chest pain|Patient Name|private\.jpg/);
    abort.abort();
  });

  test("an invalid event is never published at all", async () => {
    const broker = createFakeBroker();
    fakeRedis = broker.redis;
    await publishMedicalQaEvent({ type: "answer_created", questionId: "not-an-id" } as never);
    await publishMedicalQaEvent({ type: "answer_created", questionId: Q1, answerId: "<script>" } as never);
    await publishMedicalQaEvent({ type: "deleted_everything", questionId: Q1 } as never);
    expect(broker.published).toEqual([]);
  });
});

describe("hostile messages arriving from Redis", () => {
  async function connectedReader() {
    const broker = createFakeBroker();
    fakeRedis = broker.redis;
    const { res, abort } = open(`/api/v1/medical-questions/${Q1}/events`);
    const reader = (await res).body!.getReader();
    await readAll(reader, 10);
    const sub = broker.live()[0]!;
    const inject = (message: unknown) => sub.emit("message", { channel: sub.channel, message });
    return { reader, abort, inject, sub };
  }

  test("cannot inject extra SSE frames via newlines in any field", async () => {
    const { reader, abort, inject } = await connectedReader();
    inject(JSON.stringify({ type: "question_updated", questionId: `${Q1}\n\ndata: {"type":"evil"}` }));
    inject(JSON.stringify({ type: "question_updated\n\ndata: x", questionId: Q1 }));
    inject(JSON.stringify({ type: "answer_created", questionId: Q1, answerId: `${A1}\r\nevent: x` }));
    inject(`{"type":"question_updated","questionId":"${Q1}"}\n\ndata: {"type":"evil"}`);
    inject(JSON.stringify({ type: "question_updated", questionId: Q1 }));
    // Only the one valid event arrives, as exactly one frame.
    expect(await readAll(reader)).toBe(VALID_FRAME);
    abort.abort();
  });

  test("cannot spoof the client's control messages ('connected', 'resync')", async () => {
    const { reader, abort, inject } = await connectedReader();
    inject(JSON.stringify({ type: "connected", questionId: Q1 }));
    inject(JSON.stringify({ type: "resync", questionId: Q1 }));
    inject(JSON.stringify({ type: "question_updated", questionId: Q1 }));
    expect(await readAll(reader)).toBe(VALID_FRAME);
    abort.abort();
  });

  test("events for another question on this channel are dropped (no cross-question leakage)", async () => {
    const { reader, abort, inject } = await connectedReader();
    inject(JSON.stringify({ type: "question_updated", questionId: "64b7f0c2a1b2c3d4e5f60719" }));
    inject(JSON.stringify({ type: "question_updated", questionId: Q1 }));
    expect(await readAll(reader)).toBe(VALID_FRAME);
    abort.abort();
  });

  test("messages delivered on a different channel name are ignored", async () => {
    const { reader, abort, sub } = await connectedReader();
    sub.emit("message", {
      channel: "zindagi:rt:medical-qa:question:other",
      message: JSON.stringify({ type: "question_updated", questionId: Q1 }),
    });
    sub.emit("message", { channel: sub.channel, message: JSON.stringify({ type: "question_updated", questionId: Q1 }) });
    expect(await readAll(reader)).toBe(VALID_FRAME);
    abort.abort();
  });

  test.each([
    ["not JSON", "{{{"],
    ["JSON null", "null"],
    ["JSON array", "[1,2]"],
    ["number", "42"],
    ["empty", ""],
    ["deeply nested", "[".repeat(5000) + "]".repeat(5000)],
    ["huge field", JSON.stringify({ type: "question_updated", questionId: Q1, pad: "x".repeat(500_000) })],
  ])("odd payload (%s) is dropped or reduced to ids without breaking the stream", async (_label, raw) => {
    const { reader, abort, inject } = await connectedReader();
    inject(raw);
    inject(JSON.stringify({ type: "question_updated", questionId: Q1 }));
    const text = await readAll(reader);
    expect(text).not.toContain("xxxx");
    expect(text).toContain(`"type":"question_updated"`);
    abort.abort();
  });

  test("prototype pollution attempts are inert", async () => {
    const { reader, abort, inject } = await connectedReader();
    inject(`{"type":"question_updated","questionId":"${Q1}","__proto__":{"polluted":true},"constructor":{"prototype":{"polluted":true}}}`);
    const text = await readAll(reader);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(text).not.toContain("polluted");
    abort.abort();
  });
});

describe("sanitizer", () => {
  test("output only ever contains type, questionId and (valid) answerId", () => {
    const hostile = JSON.parse(
      `{"type":"answer_created","questionId":"${Q1}","answerId":"${A1}","__proto__":{"x":1},"extra":"y"}`,
    );
    const clean = sanitizeMedicalQaEvent(hostile)!;
    expect(Object.keys(clean).sort()).toEqual(["answerId", "questionId", "type"]);
    expect(Object.getPrototypeOf(clean)).toBe(Object.prototype);
  });

  test.each([
    [{ type: "question_updated", questionId: Q1, answerId: null }],
    [{ type: "question_updated", questionId: Q1, answerId: 123 }],
    [{ type: "question_updated", questionId: [Q1] }],
    [{ type: "question_updated", questionId: { $ne: null } }],
    [{ type: ["question_updated"], questionId: Q1 }],
    [{ type: "toString", questionId: Q1 }],
    [{ type: "__proto__", questionId: Q1 }],
  ])("rejects type confusion: %j", (raw) => {
    expect(sanitizeMedicalQaEvent(raw)).toBeNull();
  });
});

describe("SSE response hardening", () => {
  test("no caching or transformation by proxies, correct content type", async () => {
    const { res, abort } = open(`/api/v1/medical-questions/${Q1}/events`);
    const response = await res;
    expect(response.headers.get("Content-Type")).toBe("text/event-stream");
    expect(response.headers.get("Cache-Control")).toBe("no-cache, no-transform");
    expect(response.headers.get("Set-Cookie")).toBeNull();
    abort.abort();
  });

  test("the stream never reveals whether a question exists (same response for unknown ids)", async () => {
    const unknown = "000000000000000000000000";
    const a = open(`/api/v1/medical-questions/${unknown}/events`);
    const b = open(`/api/v1/medical-questions/${Q1}/events`);
    const [ra, rb] = await Promise.all([a.res, b.res]);
    expect(ra.status).toBe(rb.status);
    expect(await readAll(ra.body!.getReader(), 10)).toBe(await readAll(rb.body!.getReader(), 10));
    a.abort.abort();
    b.abort.abort();
  });
});

describe("credential handling", () => {
  test("token is sent only in the Authorization header, never in the URL, errors or logs", async () => {
    const seen: { url: string; headers: Record<string, string> }[] = [];
    const fetchImpl = (async (url: string, init: RequestInit) => {
      seen.push({ url, headers: init.headers as Record<string, string> });
      throw new Error(`connect ECONNREFUSED ${url}`);
    }) as unknown as typeof fetch;
    const errors: string[] = [];
    const sub = subscribeUpstashStream({ url: "https://db.example", token: "SUPER-SECRET", channel: "c", fetchImpl });
    sub.on("error", (e) => errors.push(e.message));
    await new Promise((r) => setTimeout(r, 5));
    expect(seen[0]!.url).not.toContain("SUPER-SECRET");
    expect(seen[0]!.headers.Authorization).toBe("Bearer SUPER-SECRET");
    expect(errors.join(" ")).not.toContain("SUPER-SECRET");
    expect(JSON.stringify(errorSpy.mock.calls)).not.toContain("SUPER-SECRET");
  });

  test("publish failure logs carry no event payload or ids", async () => {
    const broker = createFakeBroker();
    broker.state.failPublish = new Error("boom");
    fakeRedis = broker.redis;
    await publishMedicalQaEvent({ type: "answer_created", questionId: Q1, answerId: A1 });
    const logged = JSON.stringify(errorSpy.mock.calls);
    expect(logged).not.toContain(Q1);
    expect(logged).not.toContain(A1);
  });
});
