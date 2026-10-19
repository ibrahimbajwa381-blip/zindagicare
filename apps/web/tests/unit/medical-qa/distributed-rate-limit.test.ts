/**
 * QA-RL — Redis-backed (Upstash) rate limiting with explicit failure behaviour.
 *
 * Redis is always an injected in-memory fake here; the module must never
 * open a real Redis connection under NODE_ENV=test (apps/web/.env holds
 * production Upstash credentials and next/jest loads it).
 */
import {
  createDistributedRateLimiter,
  enforceDistributedRateLimit,
  getRateLimitRedis,
  type RateLimitRedis,
} from "@/server/lib/distributed-rate-limit";

function fakeRedis() {
  const counts = new Map<string, number>();
  const expiries = new Map<string, number>();
  const client: RateLimitRedis & { counts: Map<string, number> } = {
    counts,
    async incr(key) {
      const exp = expiries.get(key);
      if (exp !== undefined && exp <= Date.now()) {
        counts.delete(key);
        expiries.delete(key);
      }
      const n = (counts.get(key) ?? 0) + 1;
      counts.set(key, n);
      return n;
    },
    async pexpire(key, ms) {
      expiries.set(key, Date.now() + ms);
      return 1;
    },
    async pttl(key) {
      const exp = expiries.get(key);
      return exp === undefined ? -1 : Math.max(0, exp - Date.now());
    },
  };
  return client;
}

describe("getRateLimitRedis", () => {
  it("never returns a live client in the test environment even if Upstash env vars are set", () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://prod.example.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "prod-token";
    expect(getRateLimitRedis()).toBeNull();
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
  });
});

describe("createDistributedRateLimiter", () => {
  it("allows exactly `limit` requests then blocks with a Retry-After (boundary)", async () => {
    const limiter = createDistributedRateLimiter({ name: "t1", limit: 3, windowMs: 60_000, redis: fakeRedis() });
    for (let i = 0; i < 3; i++) expect((await limiter.consume("user:a")).allowed).toBe(true);
    const blocked = await limiter.consume("user:a");
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
    expect(blocked.retryAfterSeconds).toBeLessThanOrEqual(60);
  });

  it("keeps budgets independent per identity", async () => {
    const limiter = createDistributedRateLimiter({ name: "t2", limit: 1, windowMs: 60_000, redis: fakeRedis() });
    expect((await limiter.consume("user:a")).allowed).toBe(true);
    expect((await limiter.consume("user:b")).allowed).toBe(true);
    expect((await limiter.consume("user:a")).allowed).toBe(false);
  });

  it("shares one budget across server instances via Redis (distributed abuse)", async () => {
    const redis = fakeRedis();
    const instanceA = createDistributedRateLimiter({ name: "shared", limit: 4, windowMs: 60_000, redis });
    const instanceB = createDistributedRateLimiter({ name: "shared", limit: 4, windowMs: 60_000, redis });
    const results = await Promise.all(
      Array.from({ length: 10 }, (_, i) => (i % 2 ? instanceA : instanceB).consume("user:attacker")),
    );
    expect(results.filter((r) => r.allowed)).toHaveLength(4);
  });

  it("handles a burst of concurrent requests without over-admitting", async () => {
    const limiter = createDistributedRateLimiter({ name: "burst", limit: 5, windowMs: 60_000, redis: fakeRedis() });
    const results = await Promise.all(Array.from({ length: 50 }, () => limiter.consume("user:burst")));
    expect(results.filter((r) => r.allowed)).toHaveLength(5);
  });

  it("does not put raw IPs or user ids into Redis keys", async () => {
    const redis = fakeRedis();
    const limiter = createDistributedRateLimiter({ name: "priv", limit: 5, windowMs: 60_000, redis });
    await limiter.consume("ip:203.0.113.77");
    const keys = [...redis.counts.keys()];
    expect(keys).toHaveLength(1);
    expect(keys[0]).not.toContain("203.0.113.77");
    expect(keys[0]).toMatch(/^rl:priv:/);
  });

  it("falls back to a bounded local limiter when Redis throws — never fails open", async () => {
    const broken: RateLimitRedis = {
      incr: async () => { throw new Error("ECONNRESET"); },
      pexpire: async () => 1,
      pttl: async () => 1000,
    };
    const limiter = createDistributedRateLimiter({ name: "down", limit: 2, windowMs: 60_000, redis: broken });
    const results = [];
    for (let i = 0; i < 4; i++) results.push(await limiter.consume("user:x"));
    expect(results.map((r) => r.allowed)).toEqual([true, true, false, false]);
    expect(results[0].source).toBe("local");
  });

  it("falls back quickly when Redis hangs (timeout)", async () => {
    const hanging: RateLimitRedis = {
      incr: () => new Promise<number>(() => {}),
      pexpire: async () => 1,
      pttl: async () => 1000,
    };
    const limiter = createDistributedRateLimiter({ name: "hang", limit: 1, windowMs: 60_000, redis: hanging, timeoutMs: 50 });
    const started = Date.now();
    const result = await limiter.consume("user:y");
    expect(Date.now() - started).toBeLessThan(1000);
    expect(result).toMatchObject({ allowed: true, source: "local" });
  });

  it("enforceDistributedRateLimit throws a 429 AppError with retryAfterSeconds", async () => {
    const limiter = createDistributedRateLimiter({ name: "enf", limit: 1, windowMs: 30_000, redis: null });
    await enforceDistributedRateLimit(limiter, "user:z");
    await expect(enforceDistributedRateLimit(limiter, "user:z", "Slow down")).rejects.toMatchObject({
      code: "RATE_LIMITED",
      statusCode: 429,
      message: "Slow down",
    });
  });
});
