/**
 * Nurse portfolio — real local MongoDB + real models/services.
 */
import { MongoMemoryServer } from "mongodb-memory-server";
import { updateNursePortfolioSchema } from "@zindagi/validators";
import { randomBytes } from "crypto";

jest.setTimeout(60000);

describe("Nurse portfolio (real local MongoDB)", () => {
  let mongod: InstanceType<typeof MongoMemoryServer>;
  let mongooseMod: typeof import("mongoose");
  let db: typeof import("@zindagi/database");
  let svc: typeof import("@/server/services/nurse.service");
  let PublicNurseService: typeof import("@/server/services/public-nurse.service").PublicNurseService;
  let counter = 0;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongod.getUri("nurse_portfolio_test");
    process.env.FIELD_ENCRYPTION_KEY = randomBytes(32).toString("base64");

    db = await import("@zindagi/database");
    mongooseMod = (await import("mongoose")).default;
    await db.connectDatabase();
    await db.UserModel.init();
    await db.StaffProfileModel.init();

    svc = await import("@/server/services/nurse.service");
    ({ PublicNurseService } = await import("@/server/services/public-nurse.service"));
  });

  afterAll(async () => {
    await mongooseMod.disconnect();
    await mongod.stop();
  });

  beforeEach(async () => {
    await Promise.all([db.UserModel.deleteMany({}), db.StaffProfileModel.deleteMany({})]);
  });

  async function createNurseUser() {
    counter += 1;
    const user = await db.UserModel.create({
      name: `Portfolio Nurse ${counter}`,
      email: `portfolio-${counter}-${Date.now()}@example.com`,
      roles: ["nurse"],
      isActive: true,
    });
    return user._id.toString();
  }

  /** Mirrors the PATCH route: body is parsed by the schema before reaching the service. */
  function save(userId: string, body: unknown) {
    return svc.updateNursePortfolio(userId, updateNursePortfolioSchema.parse(body));
  }

  it("saves sections independently without wiping the others", async () => {
    const userId = await createNurseUser();

    await save(userId, {
      headline: "Stroke rehab specialist",
      bio: "I help patients walk again.",
      languages: ["English", "Urdu"],
    });
    const after = await save(userId, {
      conditionsTreated: ["Stroke rehabilitation"],
      education: [{ degree: "BSN", institute: "University of Lahore", year: 2018 }],
    });

    expect(after.headline).toBe("Stroke rehab specialist");
    expect(after.bio).toBe("I help patients walk again.");
    expect(after.conditionsTreated).toEqual(["Stroke rehabilitation"]);
    expect(after.education).toEqual([{ degree: "BSN", institute: "University of Lahore", year: 2018 }]);
    expect(after.updatedAt).toBeDefined();

    const profile = await svc.getNurseProfile(userId);
    expect(profile.portfolio).toEqual(after);
    expect(profile.portfolio).not.toHaveProperty("gallery");
  });

  it("shows the portfolio publicly only once approved", async () => {
    const userId = await createNurseUser();
    await save(userId, {
      headline: "Sports nurse",
      techniques: ["Dry needling"],
    });

    expect(await PublicNurseService.get(userId)).toBeNull();

    await db.StaffProfileModel.updateOne({ userId }, { verificationStatus: "approved" });
    const publicProfile = await PublicNurseService.get(userId);
    expect(publicProfile?.headline).toBe("Sports nurse");
    expect(publicProfile?.portfolio?.techniques).toEqual(["Dry needling"]);

    const [listed] = await PublicNurseService.list({ city: "Lahore" });
    expect(listed?.headline).toBe("Sports nurse");
    expect(listed?.portfolio).toBeUndefined();
  });
});
