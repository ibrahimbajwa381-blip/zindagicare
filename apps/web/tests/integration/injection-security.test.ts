/**
 * INJ-001..003 — NoSQL operator injection audit.
 *
 * The canonical attack: POST a body like {"email": {"$ne": null}, "password":
 * {"$ne": null}} hoping a naive `UserModel.findOne({ email: body.email })`
 * matches every document and logs in as an arbitrary (often the first/admin)
 * account. Real local MongoDB (mongodb-memory-server) + real route handlers
 * + a real matching account in the DB, so a bypass would be directly
 * observable as a successful login, not just inferred from code reading.
 */
import { MongoMemoryServer } from "mongodb-memory-server";
import { randomBytes } from "crypto";

jest.setTimeout(60000);
jest.mock("@/lib/auth", () => ({ auth: async () => null }));

describe("INJ-001..003 — NoSQL operator injection", () => {
  let mongod: InstanceType<typeof MongoMemoryServer>;
  let mongooseMod: typeof import("mongoose");
  let registerWithCredentials: typeof import("@/server/services/auth.service").registerWithCredentials;
  let mobileLoginRoute: typeof import("@/app/api/v1/mobile/auth/login/route");
  let otpRequestRoute: typeof import("@/app/api/v1/auth/otp/request/route");

  let counter = 0;
  const nextEmail = () => `inj-${Date.now()}-${counter++}@test.local`;
  const nextPhone = () => `+9230${(2000000 + counter++).toString().padStart(8, "0")}`;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongod.getUri("injection_audit");
    process.env.FIELD_ENCRYPTION_KEY = randomBytes(32).toString("base64");
    process.env.AUTH_SECRET = "test-secret-at-least-32-chars-long-12345";

    const db = await import("@zindagi/database");
    mongooseMod = (await import("mongoose")).default;
    await db.connectDatabase();

    ({ registerWithCredentials } = await import("@/server/services/auth.service"));
    mobileLoginRoute = await import("@/app/api/v1/mobile/auth/login/route");
    otpRequestRoute = await import("@/app/api/v1/auth/otp/request/route");
  });

  afterAll(async () => {
    await mongooseMod.disconnect();
    await mongod.stop();
  });

  describe("INJ-001/003 — login endpoint rejects operator injection in email/password", () => {
    test('{"email": {"$ne": null}, "password": {"$ne": null}} does not bypass authentication for a real existing account', async () => {
      await registerWithCredentials({
        name: "Injection Target",
        email: nextEmail(),
        password: "a-real-password-1",
        phone: nextPhone(),
        city: "Lahore",
        dateOfBirth: "1990-01-01",
      });

      const req = new Request("http://localhost/api/v1/mobile/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: { $ne: null }, password: { $ne: null } }),
      });
      const res = await mobileLoginRoute.POST(req as never);

      // Zod's z.string().email() rejects a non-string value outright — the
      // request never reaches UserModel.findOne with an operator object.
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.data).toBeNull();
      expect(json.error.code).toBe("VALIDATION_ERROR");
    });

    test('{"email": "victim@test.local", "password": {"$gt": ""}} (operator only on password) is also rejected, not silently coerced', async () => {
      const email = nextEmail();
      await registerWithCredentials({
        name: "Injection Target 2",
        email,
        password: "another-real-password-1",
        phone: nextPhone(),
        city: "Lahore",
        dateOfBirth: "1990-01-01",
      });

      const req = new Request("http://localhost/api/v1/mobile/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password: { $gt: "" } }),
      });
      const res = await mobileLoginRoute.POST(req as never);
      expect(res.status).toBe(400);
    });
  });

  describe("INJ-002 — OTP endpoint rejects operator injection in phone", () => {
    test('{"phone": {"$gt": ""}} does not enumerate/target an arbitrary account', async () => {
      const req = new Request("http://localhost/api/v1/auth/otp/request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone: { $gt: "" } }),
      });
      const res = await otpRequestRoute.POST(req as never);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error.code).toBe("VALIDATION_ERROR");
    });
  });

  describe("INJ-007 — prototype-pollution-shaped input", () => {
    test('a body with "__proto__" as a key is handled safely by the login route (no crash, no pollution of shared objects)', async () => {
      const req = new Request("http://localhost/api/v1/mobile/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: "someone@test.local",
          password: "password1",
          __proto__: { polluted: true },
        }),
      });
      const res = await mobileLoginRoute.POST(req as never);
      expect(res.status).toBeLessThan(500);
      // eslint-disable-next-line no-prototype-builtins
      expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    });
  });
});
