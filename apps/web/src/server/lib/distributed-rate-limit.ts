import { createHash } from "crypto";
import { AppError } from "@zindagi/shared";
import { createRateLimiter, type RateLimitResult } from "./rate-limit";

/** The subset of the Upstash Redis client this limiter uses (also easy to fake in tests). */
export type RateLimitRedis = {
  incr(key: string): Promise<number>;
  pexpire(key: string, ms: number): Promise<unknown>;
  pttl(key: string): Promise<number>;
};

export type DistributedRateLimitResult = RateLimitResult & { source: "redis" | "local" };

export type DistributedRateLimiter = {
  consume(identity: string): Promise<DistributedRateLimitResult>;
};

let sharedRedis: RateLimitRedis | null | undefined;

/**
 * Upstash REST client for rate limiting, or null when not configured.
 *
 * Always null under NODE_ENV=test: next/jest loads apps/web/.env, which holds
 * production Upstash credentials, and tests must never touch them.
 */
export function getRateLimitRedis(): RateLimitRedis | null {
  if (process.env.NODE_ENV === "test") return null;
  if (sharedRedis !== undefined) return sharedRedis;

  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) {
    sharedRedis = null;
    return sharedRedis;
  }

  // Lazy require keeps the client out of bundles/tests that never configure it.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Redis } = require("@upstash/redis") as typeof import("@upstash/redis");
  const client = new Redis({ url, token, automaticDeserialization: false, retry: false });
  sharedRedis = {
    incr: (key) => client.incr(key),
    pexpire: (key, ms) => client.pexpire(key, ms),
    pttl: (key) => client.pttl(key),
  };
  return sharedRedis;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("rate limit store timeout")), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

let lastWarnAt = 0;
function warnDegraded(name: string) {
  const now = Date.now();
  if (now - lastWarnAt < 60_000) return;
  lastWarnAt = now;
  console.warn(`[rate-limit] redis unavailable for "${name}", using per-instance limiter`);
}

/**
 * Fixed-window limiter shared across instances through Redis.
 *
 * Failure mode is explicit and never "open": when Redis errors or exceeds
 * `timeoutMs`, the same budget is enforced by an in-process limiter (per
 * instance — weaker against distributed abuse, but still bounded).
 * Authentication and authorization never depend on this module.
 *
 * Identities (user ids, IPs) are hashed before becoming Redis keys so raw
 * IPs are not persisted in the store.
 */
export function createDistributedRateLimiter(config: {
  name: string;
  limit: number;
  windowMs: number;
  redis?: RateLimitRedis | null;
  timeoutMs?: number;
}): DistributedRateLimiter {
  const { name, limit, windowMs, timeoutMs = 300 } = config;
  const local = createRateLimiter(limit, windowMs);
  const resolveRedis = () => (config.redis !== undefined ? config.redis : getRateLimitRedis());

  return {
    async consume(identity) {
      const redis = resolveRedis();
      if (!redis) return { ...local.consume(identity), source: "local" };

      const window = Math.floor(Date.now() / windowMs);
      const digest = createHash("sha256").update(identity).digest("base64url").slice(0, 22);
      const key = `rl:${name}:${window}:${digest}`;

      try {
        const count = await withTimeout(redis.incr(key), timeoutMs);
        if (count === 1) {
          // A failed expire is tolerated: the window number is part of the key, so
          // a stale key can never extend a block — it only lingers until eviction.
          await withTimeout(redis.pexpire(key, windowMs), timeoutMs).catch(() => {});
        }
        if (count <= limit) {
          return { allowed: true, remaining: limit - count, retryAfterSeconds: 0, source: "redis" };
        }
        const ttl = await withTimeout(redis.pttl(key), timeoutMs).catch(() => windowMs);
        const ms = ttl > 0 ? ttl : windowMs;
        return { allowed: false, remaining: 0, retryAfterSeconds: Math.max(1, Math.ceil(ms / 1000)), source: "redis" };
      } catch {
        warnDegraded(name);
        return { ...local.consume(identity), source: "local" };
      }
    },
  };
}

/** Throws a 429 AppError (surfaced with Retry-After) when `identity` is over budget. */
export async function enforceDistributedRateLimit(
  limiter: DistributedRateLimiter,
  identity: string,
  message = "Too many requests. Please try again later.",
): Promise<DistributedRateLimitResult> {
  const result = await limiter.consume(identity);
  if (!result.allowed) {
    throw new AppError(message, "RATE_LIMITED", 429, undefined, result.retryAfterSeconds);
  }
  return result;
}
