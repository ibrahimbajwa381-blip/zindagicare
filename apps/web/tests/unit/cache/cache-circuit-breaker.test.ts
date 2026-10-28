/**
 * Redis circuit breaker in server/lib/cache.ts. Upstash is replaced by an
 * in-memory fake whose operations can be made to fail or hang; nothing leaves
 * the process.
 */
const store = new Map<string, string>();
const fake = {
  mode: "ok" as "ok" | "fail" | "hang",
  mget: jest.fn(),
  set: jest.fn(),
  incr: jest.fn(),
};

function op<T>(fn: () => T): Promise<T> {
  if (fake.mode === "fail") return Promise.reject(new Error("redis down"));
  if (fake.mode === "hang") return new Promise<T>(() => undefined);
  return Promise.resolve(fn());
}

jest.mock("@upstash/redis", () => ({
  Redis: jest.fn().mockImplementation(() => ({
    mget: (...keys: string[]) => {
      fake.mget(keys);
      return op(() => keys.map((k) => store.get(k) ?? null));
    },
    set: (key: string, value: string) => {
      fake.set(key);
      return op(() => {
        store.set(key, value);
        return "OK";
      });
    },
    incr: (key: string) => {
      fake.incr(key);
      return op(() => {
        const next = Number(store.get(key) ?? 0) + 1;
        store.set(key, String(next));
        return next;
      });
    },
  })),
}));

type CacheModule = typeof import("@/server/lib/cache");

const env = process.env as Record<string, string | undefined>;
const saved = { ...env };
let now = 10_000_000;

async function loadCache(): Promise<CacheModule> {
  let mod!: CacheModule;
  await jest.isolateModulesAsync(async () => {
    mod = await import("@/server/lib/cache");
  });
  return mod;
}

const flush = () => new Promise((r) => setImmediate(r));

describe("cache circuit breaker", () => {
  beforeEach(() => {
    store.clear();
    fake.mode = "ok";
    fake.mget.mockClear();
    fake.set.mockClear();
    fake.incr.mockClear();
    now = 10_000_000;
    jest.spyOn(Date, "now").mockImplementation(() => now);
    env.NODE_ENV = "production";
    env.UPSTASH_REDIS_REST_URL = "https://fake-upstash.invalid";
    env.UPSTASH_REDIS_REST_TOKEN = "fake";
    delete env.CACHE_DISABLED;
    jest.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    for (const key of Object.keys(env)) if (!(key in saved)) delete env[key];
    Object.assign(env, saved);
  });

  it("falls back to the loader on failure, then skips Redis entirely for 30s", async () => {
    const { cached, CacheTags } = await loadCache();
    const loader = jest.fn().mockResolvedValue({ doctors: 3 });
    const opts = { ttl: 60, tags: [CacheTags.DOCTORS] };

    fake.mode = "fail";
    await expect(cached("k", opts, loader)).resolves.toEqual({ doctors: 3 });
    expect(fake.mget).toHaveBeenCalledTimes(1);

    // Redis is healthy again, but the breaker is open: no Redis round trip.
    fake.mode = "ok";
    now += 29_000;
    await expect(cached("k", opts, loader)).resolves.toEqual({ doctors: 3 });
    expect(fake.mget).toHaveBeenCalledTimes(1);
    expect(fake.set).not.toHaveBeenCalled();
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it("recovers after the cooldown and serves from Redis again", async () => {
    const { cached, CacheTags } = await loadCache();
    const loader = jest.fn().mockResolvedValue({ doctors: 3 });
    const opts = { ttl: 60, tags: [CacheTags.DOCTORS] };

    fake.mode = "fail";
    await cached("k", opts, loader);
    fake.mode = "ok";
    now += 30_000;

    await cached("k", opts, loader); // half-open probe: miss, loads and writes
    await flush();
    expect(fake.mget).toHaveBeenCalledTimes(2);
    expect(fake.set).toHaveBeenCalledTimes(1);

    await expect(cached("k", opts, loader)).resolves.toEqual({ doctors: 3 });
    expect(loader).toHaveBeenCalledTimes(2); // third read was a Redis hit
  });

  it("trips on a hung Redis operation (timeout), not just on errors", async () => {
    const { cached, CacheTags } = await loadCache();
    const loader = jest.fn().mockResolvedValue("db");
    const opts = { ttl: 60, tags: [CacheTags.DOCTORS] };

    fake.mode = "hang";
    const started = performance.now();
    await expect(cached("k", opts, loader)).resolves.toBe("db");
    expect(performance.now() - started).toBeGreaterThanOrEqual(750);

    const second = performance.now();
    await expect(cached("k", opts, loader)).resolves.toBe("db");
    expect(performance.now() - second).toBeLessThan(100);
    expect(fake.mget).toHaveBeenCalledTimes(1);
  });

  it("keeps sending invalidations while open, so no stale entry is served after recovery", async () => {
    const { cached, invalidateCacheTags, CacheTags } = await loadCache();
    const opts = { ttl: 60, tags: [CacheTags.DOCTORS] };

    await cached("k", opts, async () => "old");
    await flush();

    // A Redis read fails and opens the breaker...
    fake.mode = "fail";
    await cached("other", opts, async () => "x");
    // ...Redis comes back and a write invalidates the doctors tag while still open.
    fake.mode = "ok";
    await invalidateCacheTags([CacheTags.DOCTORS]);
    expect(fake.incr).toHaveBeenCalledTimes(1);

    now += 30_000;
    await expect(cached("k", opts, async () => "new")).resolves.toBe("new");
  });

  it("does not trip on a corrupt entry (Redis itself is healthy)", async () => {
    const { cached, CacheTags } = await loadCache();
    const opts = { ttl: 60, tags: [CacheTags.DOCTORS] };
    store.set("zc:c:k", "{not json");

    await expect(cached("k", opts, async () => "db")).resolves.toBe("db");
    await cached("k2", opts, async () => "db2");
    expect(fake.mget).toHaveBeenCalledTimes(2);
  });

  it("an invalidation failure also opens the breaker", async () => {
    const { cached, invalidateCacheTags, CacheTags } = await loadCache();
    fake.mode = "fail";
    await invalidateCacheTags([CacheTags.DOCTORS]);
    fake.mode = "ok";
    await cached("k", { ttl: 60, tags: [CacheTags.DOCTORS] }, async () => "db");
    expect(fake.mget).not.toHaveBeenCalled();
  });
});
