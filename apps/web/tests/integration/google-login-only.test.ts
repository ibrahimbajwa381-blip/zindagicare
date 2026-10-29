/**
 * Google is sign-in only — real local MongoDB (mongodb-memory-server). Accounts are
 * created manually; a Google login must never create one.
 */
import { MongoMemoryServer } from "mongodb-memory-server";
import { randomBytes } from "crypto";

jest.setTimeout(60000);

describe("Google login is sign-in only (real local MongoDB)", () => {
  let mongod: InstanceType<typeof MongoMemoryServer>;
  let mongooseMod: typeof import("mongoose");
  let db: typeof import("@zindagi/database");
  let svc: typeof import("@/server/services/auth.service");

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongod.getUri("google_login_only_test");
    process.env.FIELD_ENCRYPTION_KEY = randomBytes(32).toString("base64");

    db = await import("@zindagi/database");
    mongooseMod = (await import("mongoose")).default;
    await db.connectDatabase();
    await db.UserModel.init();

    svc = await import("@/server/services/auth.service");
  });

  afterAll(async () => {
    await mongooseMod.disconnect();
    await mongod.stop();
  });

  beforeEach(async () => {
    await db.UserModel.collection.deleteMany({});
  });

  test("does not create an account for an unknown email", async () => {
    const user = await svc.findGoogleLoginUser({ email: "new.person@example.com", googleId: "g-1" });

    expect(user).toBeNull();
    expect(await db.UserModel.countDocuments()).toBe(0);
  });

  test("signs in and links Google to a manually created account", async () => {
    await svc.registerWithCredentials({
      name: "Manual Signup",
      email: "manual@example.com",
      password: "Str0ng!Passw0rd",
      phone: "03001234567",
      city: "Lahore",
      dateOfBirth: "1990-01-01",
    });

    const user = await svc.findGoogleLoginUser({ email: "Manual@Example.com", googleId: "g-2" });

    expect(user).not.toBeNull();
    expect(user?.authProviders).toContain("google");
    expect(await db.UserModel.countDocuments()).toBe(1);
  });
});
