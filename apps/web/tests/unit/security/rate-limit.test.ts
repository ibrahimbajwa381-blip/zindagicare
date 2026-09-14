/**
 * RT-CROSS-003 / RT-PERF-001 / RT-SEC-001 — unit coverage for the shared
 * in-process rate limiter (`@/server/lib/rate-limit`) that every RT-00x
 * endpoint test in tests/integration/rate-limit-endpoints.test.ts builds on.
 *
 * Pure in-memory logic — no DB, no network — so the "1000 requests" case
 * from RT-PERF-001 is exercised directly here instead of firing 1000 real
 * HTTP requests at a route.
 */
import { AppError } from "@zindagi/shared";
import {
  createRateLimiter,
  enforceRateLimit,
  getClientIp,
} from "@/server/lib/rate-limit";

describe("createRateLimiter", () => {
  test("allows requests up to the configured limit, then blocks", () => {
    const limiter = createRateLimiter(5, 60_000);
    const outcomes = Array.from({ length: 7 }, () => limiter.consume("k").allowed);
    expect(outcomes).toEqual([true, true, true, true, true, false, false]);
  });

  test("1000-request burst against a limit of 100 lets exactly 100 through (RT-PERF-001 stress shape)", () => {
    const limiter = createRateLimiter(100, 60_000);
    let allowed = 0;
    let blocked = 0;
    for (let i = 0; i < 1000; i += 1) {
      if (limiter.consume("same-client").allowed) allowed += 1;
      else blocked += 1;
    }
    expect(allowed).toBe(100);
    expect(blocked).toBe(900);
  });

  test("different keys get fully independent budgets (RT-CROSS-001 shape)", () => {
    const limiter = createRateLimiter(2, 60_000);
    expect(limiter.consume("user-a").allowed).toBe(true);
    expect(limiter.consume("user-a").allowed).toBe(true);
    expect(limiter.consume("user-a").allowed).toBe(false); // user A exhausted

    // user B is untouched by user A's abuse
    expect(limiter.consume("user-b").allowed).toBe(true);
    expect(limiter.consume("user-b").allowed).toBe(true);
    expect(limiter.consume("user-b").allowed).toBe(false);
  });

  test("budget resets once the window elapses", () => {
    const now = Date.now();
    const spy = jest.spyOn(Date, "now").mockReturnValue(now);
    const limiter = createRateLimiter(1, 1000);

    expect(limiter.consume("k").allowed).toBe(true);
    expect(limiter.consume("k").allowed).toBe(false);

    spy.mockReturnValue(now + 1001);
    expect(limiter.consume("k").allowed).toBe(true);

    spy.mockRestore();
  });

  test("retryAfterSeconds counts down to the window reset and is always >= 1 while blocked", () => {
    const now = Date.now();
    const spy = jest.spyOn(Date, "now").mockReturnValue(now);
    const limiter = createRateLimiter(1, 10_000);

    limiter.consume("k");
    const blocked = limiter.consume("k");
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBe(10);

    spy.mockReturnValue(now + 9500);
    const stillBlocked = limiter.consume("k");
    expect(stillBlocked.retryAfterSeconds).toBeGreaterThanOrEqual(1);

    spy.mockRestore();
  });

  test("rejects a non-positive limit or window at construction", () => {
    expect(() => createRateLimiter(0, 1000)).toThrow();
    expect(() => createRateLimiter(5, 0)).toThrow();
  });
});

describe("enforceRateLimit", () => {
  test("throws a 429 AppError carrying retryAfterSeconds once the budget is exhausted", () => {
    const limiter = createRateLimiter(1, 60_000);
    enforceRateLimit(limiter, "k"); // consumes the only slot, does not throw

    try {
      enforceRateLimit(limiter, "k", "custom message");
      throw new Error("expected enforceRateLimit to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      const appErr = err as AppError;
      expect(appErr.statusCode).toBe(429);
      expect(appErr.code).toBe("RATE_LIMITED");
      expect(appErr.message).toBe("custom message");
      expect(appErr.retryAfterSeconds).toBeGreaterThan(0);
    }
  });

  test("never throws anything but AppError (no 500s leak out of the rate limiter itself)", () => {
    const limiter = createRateLimiter(1, 60_000);
    enforceRateLimit(limiter, "k");
    expect(() => enforceRateLimit(limiter, "k")).toThrow(AppError);
  });
});

describe("getClientIp — RT-SEC-001 (identity should not be trivially spoofable)", () => {
  test("uses the first hop of x-forwarded-for", () => {
    const req = new Request("http://localhost/x", {
      headers: { "x-forwarded-for": "203.0.113.5, 10.0.0.1" },
    });
    expect(getClientIp(req)).toBe("203.0.113.5");
  });

  test("falls back to x-real-ip when x-forwarded-for is absent", () => {
    const req = new Request("http://localhost/x", {
      headers: { "x-real-ip": "198.51.100.9" },
    });
    expect(getClientIp(req)).toBe("198.51.100.9");
  });

  test("falls back to 'unknown' rather than throwing when no IP header is present", () => {
    const req = new Request("http://localhost/x");
    expect(getClientIp(req)).toBe("unknown");
  });

  test("an attacker can freely claim any x-forwarded-for value — callers must never treat it as a trusted identity by itself", () => {
    const req1 = new Request("http://localhost/x", {
      headers: { "x-forwarded-for": "1.2.3.4" },
    });
    const req2 = new Request("http://localhost/x", {
      headers: { "x-forwarded-for": "9.9.9.9" },
    });
    // Demonstrates the header is attacker-controlled input, not a verified
    // fact — two "different" requests can claim to be different IPs at zero
    // cost. IP-keyed limits are a supplementary layer only (see doc comment
    // on getClientIp); real identity (userId, email, phone) is the primary
    // key everywhere an authenticated or pre-registered identity exists.
    expect(getClientIp(req1)).not.toBe(getClientIp(req2));
  });
});
