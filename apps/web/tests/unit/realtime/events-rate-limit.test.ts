/**
 * Per-IP connection limit on the public Q&A SSE route. Under NODE_ENV=test
 * the distributed limiter has no Redis and enforces the same budget
 * in-process (its Redis path is covered by distributed-rate-limit.test.ts).
 * Each test uses its own IPs because the limiter is a module singleton.
 */
import { createFakeBroker } from "../../helpers/fake-redis-broker";
import type { FanoutRedis } from "@/lib/realtime/redis-fanout";

let fakeRedis: FanoutRedis | null = null;
jest.mock("@/server/lib/realtime-redis", () => ({ getRealtimeRedis: () => fakeRedis }));

import { GET } from "@/app/api/v1/medical-questions/[id]/events/route";
import { medicalQaEmitter } from "@/lib/realtime/medical-qa-emitter";
import { MEDICAL_QA_RATE_LIMITS } from "@/server/services/medical-qa.service";

const Q1 = "64b7f0c2a1b2c3d4e5f60718";
const { limit: LIMIT, windowMs: WINDOW_MS } = MEDICAL_QA_RATE_LIMITS.eventStream;

const opened: AbortController[] = [];
function connect(headers: Record<string, string>, id = Q1) {
  const abort = new AbortController();
  opened.push(abort);
  return GET(new Request(`http://localhost/api/v1/medical-questions/${id}/events`, { headers, signal: abort.signal }));
}
const fromIp = (ip: string) => ({ "x-forwarded-for": ip });

async function connectMany(n: number, headers: Record<string, string>) {
  const statuses: number[] = [];
  for (let i = 0; i < n; i++) statuses.push((await connect(headers)).status);
  return statuses;
}

let warnSpy: jest.SpyInstance;
beforeEach(() => {
  warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  opened.splice(0).forEach((a) => a.abort());
  medicalQaEmitter.removeAllListeners();
  fakeRedis = null;
  warnSpy.mockRestore();
  jest.useRealTimers();
});

test("the configured budget is 60 connections per IP per 5 minutes", () => {
  expect(LIMIT).toBe(60);
  expect(WINDOW_MS).toBe(5 * 60 * 1000);
});

test("boundary: exactly the limit is allowed; limit + 1 gets 429 with Retry-After", async () => {
  const statuses = await connectMany(LIMIT, fromIp("203.0.113.1"));
  expect(statuses.every((s) => s === 200)).toBe(true);

  const blocked = await connect(fromIp("203.0.113.1"));
  expect(blocked.status).toBe(429);
  const retryAfter = Number(blocked.headers.get("Retry-After"));
  expect(retryAfter).toBeGreaterThanOrEqual(1);
  expect(retryAfter).toBeLessThanOrEqual(WINDOW_MS / 1000);
  await expect(blocked.json()).resolves.toMatchObject({
    success: false,
    error: { code: "RATE_LIMITED" },
  });
  expect(blocked.headers.get("Content-Type")).not.toContain("text/event-stream");
});

test("a rejected connection opens no stream, no listener and no Redis subscription", async () => {
  const broker = createFakeBroker();
  fakeRedis = broker.redis;
  await connectMany(LIMIT, fromIp("203.0.113.2"));
  opened.splice(0).forEach((a) => a.abort());
  const subsBefore = broker.subs.length;

  const blocked = await connect(fromIp("203.0.113.2"));
  expect(blocked.status).toBe(429);
  expect(broker.subs.length).toBe(subsBefore);
  expect(medicalQaEmitter.eventNames()).toEqual([]);
});

test("IPs are limited independently", async () => {
  await connectMany(LIMIT, fromIp("203.0.113.3"));
  expect((await connect(fromIp("203.0.113.3"))).status).toBe(429);
  expect((await connect(fromIp("203.0.113.4"))).status).toBe(200);
});

test("the limit is per IP, not per question", async () => {
  const other = "64b7f0c2a1b2c3d4e5f60719";
  for (let i = 0; i < LIMIT; i++) expect((await connect(fromIp("203.0.113.5"), i % 2 ? Q1 : other)).status).toBe(200);
  expect((await connect(fromIp("203.0.113.5"), other)).status).toBe(429);
});

test("uses the first x-forwarded-for entry (the client), ignoring proxy hops", async () => {
  await connectMany(LIMIT, { "x-forwarded-for": "203.0.113.6, 10.0.0.1" });
  expect((await connect({ "x-forwarded-for": "203.0.113.6, 10.9.9.9" })).status).toBe(429);
  expect((await connect({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" })).status).toBe(200);
});

test("falls back to x-real-ip when x-forwarded-for is absent", async () => {
  await connectMany(LIMIT, { "x-real-ip": "203.0.113.8" });
  expect((await connect({ "x-real-ip": "203.0.113.8" })).status).toBe(429);
});

test("boundary: the budget comes back when the window rolls over", async () => {
  jest.useFakeTimers({ now: new Date("2026-10-15T00:00:00Z") });
  await connectMany(LIMIT, fromIp("203.0.113.9"));
  expect((await connect(fromIp("203.0.113.9"))).status).toBe(429);
  jest.setSystemTime(Date.now() + WINDOW_MS - 1);
  expect((await connect(fromIp("203.0.113.9"))).status).toBe(429);
  jest.setSystemTime(Date.now() + 1);
  expect((await connect(fromIp("203.0.113.9"))).status).toBe(200);
});

test("invalid ids are rejected before the limiter and don't use up the budget", async () => {
  for (let i = 0; i < LIMIT * 2; i++) {
    expect((await connect(fromIp("203.0.113.10"), "not-an-id")).status).toBe(404);
  }
  expect((await connect(fromIp("203.0.113.10"))).status).toBe(200);
});

test("closing connections doesn't refund budget (it limits connects, so reconnect storms are capped)", async () => {
  await connectMany(LIMIT, fromIp("203.0.113.11"));
  opened.splice(0).forEach((a) => a.abort());
  expect((await connect(fromIp("203.0.113.11"))).status).toBe(429);
});

test("a normal viewer is far below the limit: one tab reconnecting every 270s for 5 minutes", async () => {
  // 1 initial connect + 1 rotation reconnect per 5-minute window.
  const statuses = await connectMany(2, fromIp("203.0.113.12"));
  expect(statuses).toEqual([200, 200]);
});

describe("how many streams one IP can hold open at once", () => {
  const room = "medical-qa:question:" + Q1;
  const STREAM_LIFETIME_MS = 270_000;

  async function openAt(ip: string, count: number) {
    let ok = 0;
    for (let i = 0; i < count; i++) if ((await connect(fromIp(ip))).status === 200) ok++;
    await jest.advanceTimersByTimeAsync(0);
    return ok;
  }

  test("worst case (bursts on both sides of a window boundary) stays below 2 x limit", async () => {
    jest.useFakeTimers({ now: new Date("2026-10-15T00:00:00Z") });
    const ip = "198.51.100.1";
    expect(await openAt(ip, 1)).toBe(1); // window starts
    await jest.advanceTimersByTimeAsync(WINDOW_MS - 1000);
    expect(await openAt(ip, LIMIT)).toBe(LIMIT - 1); // rest of this window's budget, just before it ends
    await jest.advanceTimersByTimeAsync(1000);
    expect(await openAt(ip, LIMIT + 10)).toBe(LIMIT); // the next window's whole budget
    const peak = medicalQaEmitter.listenerCount(room);
    // The first stream already closed itself (270s < 300s window); every other one is open.
    expect(peak).toBe(2 * LIMIT - 1);
    expect(peak).toBeLessThan(2 * LIMIT);
  });

  test("steady attack (one attempt per second for 20 minutes) never exceeds the bound", async () => {
    jest.useFakeTimers({ now: new Date("2026-10-15T01:00:00Z") });
    const ip = "198.51.100.2";
    let peak = 0;
    for (let s = 0; s < 20 * 60; s++) {
      await connect(fromIp(ip));
      await jest.advanceTimersByTimeAsync(1000);
      peak = Math.max(peak, medicalQaEmitter.listenerCount(room));
    }
    expect(peak).toBeLessThanOrEqual(LIMIT);
    expect(STREAM_LIFETIME_MS).toBeLessThan(WINDOW_MS);
  });
});

describe("Redis outage behaviour of the connection limit (documented trade-off)", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createDistributedRateLimiter } = require("@/server/lib/distributed-rate-limit") as typeof import("@/server/lib/distributed-rate-limit");
  const down = {
    incr: async () => {
      throw new Error("ECONNREFUSED");
    },
    pexpire: async () => 0,
    pttl: async () => 0,
  };
  const instance = () => createDistributedRateLimiter({ name: "sse-outage", limit: LIMIT, windowMs: WINDOW_MS, redis: down });

  async function admitted(limiter: ReturnType<typeof instance>, n: number) {
    let ok = 0;
    for (let i = 0; i < n; i++) if ((await limiter.consume("ip:198.51.100.9")).allowed) ok++;
    return ok;
  }

  test("never fails open: each instance still enforces the limit on its own", async () => {
    expect(await admitted(instance(), LIMIT * 3)).toBe(LIMIT);
  });

  test("but the budget is no longer shared: N instances admit up to N x limit", async () => {
    const instances = [instance(), instance(), instance()];
    const total = (await Promise.all(instances.map((l) => admitted(l, LIMIT * 2)))).reduce((a, b) => a + b, 0);
    expect(total).toBe(3 * LIMIT);
  });
});
