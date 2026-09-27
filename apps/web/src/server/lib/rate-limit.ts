import { AppError } from "@zindagi/shared";

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

export type RateLimiter = {
  consume(key: string): RateLimitResult;
};

/**
 * In-process fixed-window limiter.
 *
 * Scope: one Node process. Behind a multi-instance/serverless deployment each
 * instance gets its own independent budget, so this is a best-effort layer —
 * not a substitute for a shared store (Redis/Upstash) if the app scales
 * horizontally. It is still the right default here since the app currently
 * runs as a single Node server and no shared cache is wired up.
 */
export function createRateLimiter(limit: number, windowMs: number): RateLimiter {
  if (limit <= 0) throw new Error("rate limit must be positive");
  if (windowMs <= 0) throw new Error("rate limit window must be positive");

  const buckets = new Map<string, { count: number; resetAt: number }>();
  let lastSweep = Date.now();

  /** Lazily drop expired buckets so idle keys don't accumulate forever. */
  function sweep(now: number) {
    if (now - lastSweep < windowMs || buckets.size < 1000) return;
    lastSweep = now;
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(key);
    }
  }

  return {
    consume(key: string): RateLimitResult {
      const now = Date.now();
      sweep(now);

      const bucket = buckets.get(key);
      if (!bucket || bucket.resetAt <= now) {
        buckets.set(key, { count: 1, resetAt: now + windowMs });
        return { allowed: true, remaining: limit - 1, retryAfterSeconds: 0 };
      }

      if (bucket.count >= limit) {
        return {
          allowed: false,
          remaining: 0,
          retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
        };
      }

      bucket.count += 1;
      return { allowed: true, remaining: limit - bucket.count, retryAfterSeconds: 0 };
    },
  };
}

/** Throws a 429 AppError (with Retry-After) when `key` has exceeded `limiter`'s budget. */
export function enforceRateLimit(
  limiter: RateLimiter,
  key: string,
  message = "Too many requests. Please try again later.",
): RateLimitResult {
  const result = limiter.consume(key);
  if (!result.allowed) {
    throw new AppError(message, "RATE_LIMITED", 429, undefined, result.retryAfterSeconds);
  }
  return result;
}

/**
 * Best-effort client IP for pre-auth abuse throttling.
 *
 * `x-forwarded-for` is attacker-controlled unless a trusted proxy in front of
 * this app overwrites it (true on Vercel and any correctly configured
 * nginx/load balancer). Never use it as an identity/authorization signal —
 * only as a supplementary throttle key alongside a real identity (email,
 * phone, userId) that an attacker cannot simply rotate for free.
 */
export function getClientIp(req: Request): string {
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "unknown";
}
