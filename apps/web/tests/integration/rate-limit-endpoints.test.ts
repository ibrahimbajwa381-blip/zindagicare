/**
 * RT-001 → RT-007 — Rate Limiting / Abuse Protection Audit.
 *
 * Real local MongoDB (mongodb-memory-server, ephemeral — never Atlas, never
 * production) + REAL route handlers + REAL auth (mobile JWT signed with a
 * test AUTH_SECRET) + the REAL shared rate-limit core. Expensive domain
 * services (Sunday/urgent/consult booking, chat delivery, Gemini) are
 * mocked so each test isolates the rate-limiting behavior itself rather
 * than re-testing business logic already covered elsewhere (chat-api.test.ts,
 * sunday-consult-concurrency.test.ts, etc).
 *
 * Per RT-PERF-001 we do not fire literally 1000 requests at routes backed by
 * a real database/payment provider — each threshold below is small enough
 * (5-20) that we drive it a few requests past the limit instead. The 1000-
 * request burst shape is covered purely in-memory in
 * tests/unit/security/rate-limit.test.ts.
 */
import { MongoMemoryServer } from "mongodb-memory-server";
import { randomBytes } from "crypto";
import { NextRequest } from "next/server";

jest.setTimeout(60000);

jest.mock("@/server/services/sunday-consult.service", () => ({
  SundayConsultService: { submitRequest: jest.fn(async () => ({ id: "mock-request" })) },
}));
jest.mock("@/server/services/urgent-consult.service", () => ({
  UrgentConsultService: { initiateCheckout: jest.fn(async () => ({ id: "mock-urgent" })) },
}));
jest.mock("@/server/services/online-consult.service", () => ({
  OnlineConsultService: { initiateCheckout: jest.fn(async () => ({ id: "mock-checkout" })) },
}));
jest.mock("@/server/services/doctor-referral.service", () => ({
  attributeReferralIfEligible: jest.fn(async () => undefined),
}));
jest.mock("@/server/services/chat.service", () => ({
  ChatService: { sendMessage: jest.fn(async () => ({ id: "mock-message" })) },
}));

// Mock web cookie auth; mobile Bearer-token path (resolveSession) runs unmocked.
jest.mock("@/lib/auth", () => ({ auth: async () => null }));

describe("Rate Limiting / Abuse Protection (RT-001 .. RT-007)", () => {
  let mongod: InstanceType<typeof MongoMemoryServer>;
  let mongooseMod: typeof import("mongoose");
  let UserModel: typeof import("@zindagi/database").UserModel;
  let OtpChallengeModel: typeof import("@zindagi/database").OtpChallengeModel;
  let Roles: typeof import("@zindagi/shared").Roles;
  let signMobileAccessToken: typeof import("@/server/api/mobile-jwt").signMobileAccessToken;
  let registerWithCredentials: typeof import("@/server/services/auth.service").registerWithCredentials;

  let mobileLoginRoute: typeof import("@/app/api/v1/mobile/auth/login/route");
  let otpRequestRoute: typeof import("@/app/api/v1/auth/otp/request/route");
  let chatMessagesRoute: typeof import("@/app/api/v1/chat/threads/[threadId]/messages/route");
  let sundayRequestRoute: typeof import("@/app/api/v1/sunday/request/route");
  let urgentCheckoutRoute: typeof import("@/app/api/v1/urgent/checkout/route");
  let consultCheckoutRoute: typeof import("@/app/api/v1/consult/checkout/route");

  let counter = 0;
  const nextEmail = () => `rate-limit-${Date.now()}-${counter++}@test.local`;
  const nextPhone = () => `+9230${(1000000 + counter++).toString().padStart(8, "0")}`;

  async function createPatientUser() {
    return UserModel.create({
      name: "Rate Limit Patient",
      email: nextEmail(),
      phone: nextPhone(),
      roles: [Roles.PATIENT],
    });
  }

  async function authHeaders(userId: string, extra: Record<string, string> = {}) {
    const token = await signMobileAccessToken(userId);
    return {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      ...extra,
    };
  }

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongod.getUri("rate_limit_audit");
    process.env.FIELD_ENCRYPTION_KEY = randomBytes(32).toString("base64");
    process.env.AUTH_SECRET = "test-secret-at-least-32-chars-long-12345";

    const db = await import("@zindagi/database");
    UserModel = db.UserModel;
    OtpChallengeModel = db.OtpChallengeModel;
    mongooseMod = (await import("mongoose")).default;

    const shared = await import("@zindagi/shared");
    Roles = shared.Roles;

    await db.connectDatabase();

    ({ signMobileAccessToken } = await import("@/server/api/mobile-jwt"));
    ({ registerWithCredentials } = await import("@/server/services/auth.service"));

    mobileLoginRoute = await import("@/app/api/v1/mobile/auth/login/route");
    otpRequestRoute = await import("@/app/api/v1/auth/otp/request/route");
    chatMessagesRoute = await import("@/app/api/v1/chat/threads/[threadId]/messages/route");
    sundayRequestRoute = await import("@/app/api/v1/sunday/request/route");
    urgentCheckoutRoute = await import("@/app/api/v1/urgent/checkout/route");
    consultCheckoutRoute = await import("@/app/api/v1/consult/checkout/route");
  });

  afterAll(async () => {
    await mongooseMod.disconnect();
    await mongod.stop();
  });

  // =========================================================================
  // RT-001 — Login Rate Limiting
  // =========================================================================
  describe("RT-001 — Login", () => {
    async function attemptLogin(email: string, password: string, ip: string) {
      const req = new Request("http://localhost/api/v1/mobile/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": ip },
        body: JSON.stringify({ email, password }),
      });
      return mobileLoginRoute.POST(req as never);
    }

    test("1 request with wrong password: normal 401, does not reveal whether the account exists, no 500", async () => {
      const email = nextEmail();
      await registerWithCredentials({
        name: "Login Test",
        email,
        password: "correct-horse-1",
        phone: nextPhone(),
        city: "Lahore",
        dateOfBirth: "1990-01-01",
      });

      const res = await attemptLogin(email, "wrong-password", "10.0.0.1");
      const json = await res.json();
      expect(res.status).toBe(401);
      expect(json.error.code).toBe("INVALID_CREDENTIALS");
      expect(json.error.message.toLowerCase()).not.toContain("account");

      const unknownRes = await attemptLogin("no-such-user@test.local", "whatever1", "10.0.0.2");
      const unknownJson = await unknownRes.json();
      expect(unknownRes.status).toBe(401);
      // Same generic message/shape for an unknown account as for a wrong password —
      // an attacker cannot use the response to enumerate valid emails.
      expect(unknownJson.error.message).toBe(json.error.message);
    });

    test("brute-forcing one account past the configured threshold returns 429 with Retry-After, and blocks even the correct password", async () => {
      const email = nextEmail();
      const correctPassword = "correct-horse-2";
      await registerWithCredentials({
        name: "Login Brute Force Target",
        email,
        password: correctPassword,
        phone: nextPhone(),
        city: "Lahore",
        dateOfBirth: "1990-01-01",
      });

      const results: number[] = [];
      // 15 wrong-password attempts against the configured 10/15min budget for
      // this account, rotating IP on every request to prove the limiter is
      // keyed by identity (email), not the spoofable client IP (RT-SEC-001).
      for (let i = 0; i < 15; i += 1) {
        const res = await attemptLogin(email, "wrong-password", `203.0.113.${i}`);
        results.push(res.status);
      }

      expect(results.filter((s) => s === 401).length).toBe(10);
      expect(results.filter((s) => s === 429).length).toBe(5);
      expect(results.some((s) => s >= 500)).toBe(false);

      // Even the correct password is now rejected — the account is fully
      // protected, not just the specific wrong guesses.
      const lockedOutRes = await attemptLogin(email, correctPassword, "203.0.113.99");
      expect(lockedOutRes.status).toBe(429);
      expect(lockedOutRes.headers.get("Retry-After")).toBeTruthy();
      const lockedOutJson = await lockedOutRes.json();
      expect(lockedOutJson.error.code).toBe("RATE_LIMITED");
    });

    test("brute-forcing account A does not rate-limit account B (RT-CROSS-001)", async () => {
      const emailA = nextEmail();
      const emailB = nextEmail();
      await registerWithCredentials({
        name: "Account A",
        email: emailA,
        password: "password-a-1",
        phone: nextPhone(),
        city: "Lahore",
        dateOfBirth: "1990-01-01",
      });
      await registerWithCredentials({
        name: "Account B",
        email: emailB,
        password: "password-b-1",
        phone: nextPhone(),
        city: "Lahore",
        dateOfBirth: "1990-01-01",
      });

      for (let i = 0; i < 11; i += 1) {
        await attemptLogin(emailA, "wrong-password", "10.10.10.10");
      }

      const resB = await attemptLogin(emailB, "password-b-1", "10.10.10.10");
      expect(resB.status).toBe(200);
    });
  });

  // =========================================================================
  // RT-002 — OTP Rate Limiting
  // =========================================================================
  describe("RT-002 — OTP", () => {
    async function requestOtp(phone: string, ip: string) {
      const req = new Request("http://localhost/api/v1/auth/otp/request", {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": ip },
        body: JSON.stringify({ phone }),
      });
      return otpRequestRoute.POST(req as never);
    }

    /**
     * Bypasses the 30s inter-request cooldown without waiting in real time.
     * `timestamps: false` is required here — the schema has `timestamps: true`,
     * so a plain updateOne silently overwrites our explicit `updatedAt` back
     * to "now" via Mongoose's own timestamp middleware.
     */
    async function clearCooldown(phone: string) {
      await OtpChallengeModel.updateOne(
        { phoneKey: `otp:${phone}` },
        { $set: { updatedAt: new Date(Date.now() - 60_000) } },
        { timestamps: false },
      );
    }

    test("1 request succeeds; an immediate repeat is cooldown-limited with Retry-After", async () => {
      const phone = nextPhone();
      await UserModel.create({ name: "OTP User", email: nextEmail(), phone, roles: [Roles.PATIENT] });

      const first = await requestOtp(phone, "20.0.0.1");
      expect(first.status).toBe(200);

      const second = await requestOtp(phone, "20.0.0.1");
      expect(second.status).toBe(429);
      expect(second.headers.get("Retry-After")).toBeTruthy();
      const json = await second.json();
      expect(json.error.code).toBe("RATE_LIMITED");
    });

    test("hourly per-phone cap kicks in even when the 30s cooldown is respected each time", async () => {
      const phone = nextPhone();
      await UserModel.create({ name: "OTP Hourly User", email: nextEmail(), phone, roles: [Roles.PATIENT] });

      const statuses: number[] = [];
      for (let i = 0; i < 6; i += 1) {
        const res = await requestOtp(phone, "20.0.0.2");
        statuses.push(res.status);
        await clearCooldown(phone);
      }

      // 5 requests/hour configured — the 6th is blocked by the hourly cap,
      // not the (already-cleared) cooldown.
      expect(statuses).toEqual([200, 200, 200, 200, 200, 429]);
    });

    test("exhausting phone A's OTP budget does not affect phone B (RT-CROSS-001)", async () => {
      const phoneA = nextPhone();
      const phoneB = nextPhone();
      await UserModel.create({ name: "Phone A", email: nextEmail(), phone: phoneA, roles: [Roles.PATIENT] });
      await UserModel.create({ name: "Phone B", email: nextEmail(), phone: phoneB, roles: [Roles.PATIENT] });

      for (let i = 0; i < 6; i += 1) {
        await requestOtp(phoneA, "20.0.0.3");
        await clearCooldown(phoneA);
      }

      const resB = await requestOtp(phoneB, "20.0.0.3");
      expect(resB.status).toBe(200);
    });

    test("unknown phone number does not leak account existence and is not a free 500", async () => {
      const res = await requestOtp(nextPhone(), "20.0.0.4");
      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.error.code).not.toBe("INTERNAL_ERROR");
    });

    // VAL-009 / ERR-001 — malformed JSON body regression (withApiHandler bug:
    // req.json()'s raw SyntaxError wasn't caught as AppError/ZodError, so
    // apiError() fell through to a generic 500 instead of a clean 400).
    test("malformed JSON body returns a clean 400 VALIDATION_ERROR, never a 500", async () => {
      const req = new Request("http://localhost/api/v1/auth/otp/request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{not valid json",
      });
      const res = await otpRequestRoute.POST(req as never);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error.code).toBe("VALIDATION_ERROR");
    });
  });

  // =========================================================================
  // RT-004 — Chat Rate Limiting
  // =========================================================================
  describe("RT-004 — Chat", () => {
    test("unauthenticated request is 401, never counted against the rate limit", async () => {
      const req = new Request("http://localhost/api/v1/chat/threads/t1/messages", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ body: "hi" }),
      });
      const res = await chatMessagesRoute.POST(req, { params: Promise.resolve({ threadId: "t1" }) });
      expect(res.status).toBe(401);
    });

    test("one user hitting the message-rate limit does not block a different user, and blocked sends never reach ChatService (RT-CROSS-001 / RT-SEC-002)", async () => {
      const { ChatService } = await import("@/server/services/chat.service");
      const sendMessageMock = ChatService.sendMessage as jest.Mock;
      sendMessageMock.mockClear();

      const userA = await createPatientUser();
      const userB = await createPatientUser();
      const headersA = await authHeaders(userA._id.toString());
      const headersB = await authHeaders(userB._id.toString());

      const send = (headers: Record<string, string>) =>
        chatMessagesRoute.POST(
          new Request("http://localhost/api/v1/chat/threads/t1/messages", {
            method: "POST",
            headers,
            body: JSON.stringify({ body: "hello" }),
          }),
          { params: Promise.resolve({ threadId: "t1" }) },
        );

      const statusesA: number[] = [];
      for (let i = 0; i < 65; i += 1) {
        statusesA.push((await send(headersA)).status);
      }

      expect(statusesA.filter((s) => s === 200).length).toBe(60);
      expect(statusesA.filter((s) => s === 429).length).toBe(5);
      expect(sendMessageMock).toHaveBeenCalledTimes(60); // blocked requests never call the service

      const resB = await send(headersB);
      expect(resB.status).toBe(200);
    });
  });

  // =========================================================================
  // RT-005 — Sunday Consultation Rate Limiting
  // =========================================================================
  describe("RT-005 — Sunday Consultation", () => {
    test("requests beyond the per-minute limit are 429 and never reach SundayConsultService", async () => {
      const { SundayConsultService } = await import("@/server/services/sunday-consult.service");
      const submitMock = SundayConsultService.submitRequest as jest.Mock;
      submitMock.mockClear();

      const user = await createPatientUser();
      const headers = await authHeaders(user._id.toString());

      const submit = () =>
        sundayRequestRoute.POST(
          new Request("http://localhost/api/v1/sunday/request", {
            method: "POST",
            headers,
            body: JSON.stringify({ patientPhone: "03001234567", affordabilityChoice: "cannot_afford" }),
          }) as never,
        );

      const statuses: number[] = [];
      for (let i = 0; i < 8; i += 1) statuses.push((await submit()).status);

      expect(statuses.filter((s) => s === 200).length).toBe(5);
      expect(statuses.filter((s) => s === 429).length).toBe(3);
      expect(submitMock).toHaveBeenCalledTimes(5);
    });
  });

  // =========================================================================
  // RT-006 — Urgent Care Rate Limiting
  // =========================================================================
  describe("RT-006 — Urgent Care", () => {
    test("requests beyond the per-minute limit are 429 and never reach UrgentConsultService (no partial/duplicate records)", async () => {
      const { UrgentConsultService } = await import("@/server/services/urgent-consult.service");
      const checkoutMock = UrgentConsultService.initiateCheckout as jest.Mock;
      checkoutMock.mockClear();

      const user = await createPatientUser();
      const headers = await authHeaders(user._id.toString());

      const checkout = () =>
        urgentCheckoutRoute.POST(
          new Request("http://localhost/api/v1/urgent/checkout", {
            method: "POST",
            headers,
            body: JSON.stringify({ patientPhone: "03001234567" }),
          }) as never,
        );

      const statuses: number[] = [];
      for (let i = 0; i < 8; i += 1) statuses.push((await checkout()).status);

      expect(statuses.filter((s) => s === 200).length).toBe(5);
      expect(statuses.filter((s) => s === 429).length).toBe(3);
      expect(checkoutMock).toHaveBeenCalledTimes(5);
    });
  });

  // =========================================================================
  // RT-007 — Payment / Checkout Rate Limiting
  // =========================================================================
  describe("RT-007 — Payment / Checkout", () => {
    test("checkout spam beyond the per-minute limit is 429 and never creates extra payment sessions", async () => {
      const { OnlineConsultService } = await import("@/server/services/online-consult.service");
      const checkoutMock = OnlineConsultService.initiateCheckout as jest.Mock;
      checkoutMock.mockClear();

      const user = await createPatientUser();
      const headers = await authHeaders(user._id.toString());

      // NextRequest (not plain Request) — the route reads req.cookies for
      // referral attribution, which only NextRequest provides.
      const checkout = () =>
        consultCheckoutRoute.POST(
          new NextRequest("http://localhost/api/v1/consult/checkout", {
            method: "POST",
            headers,
            body: JSON.stringify({ doctorId: "507f1f77bcf86cd799439011", slotId: "slot-1" }),
          }),
        );

      const statuses: number[] = [];
      for (let i = 0; i < 13; i += 1) statuses.push((await checkout()).status);

      expect(statuses.filter((s) => s === 200).length).toBe(10);
      expect(statuses.filter((s) => s === 429).length).toBe(3);
      expect(checkoutMock).toHaveBeenCalledTimes(10);
      expect(statuses.some((s) => s >= 500)).toBe(false);
    });
  });
});
