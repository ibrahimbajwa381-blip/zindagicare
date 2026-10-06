/**
 * Physiotherapist portfolio — real local MongoDB + real models/services.
 */
import { MongoMemoryServer } from "mongodb-memory-server";
import { updatePhysiotherapistPortfolioSchema } from "@zindagi/validators";
import { randomBytes } from "crypto";

jest.setTimeout(60000);

describe("Physiotherapist portfolio (real local MongoDB)", () => {
  let mongod: InstanceType<typeof MongoMemoryServer>;
  let mongooseMod: typeof import("mongoose");
  let db: typeof import("@zindagi/database");
  let svc: typeof import("@/server/services/physiotherapist.service");
  let PublicPhysiotherapistService: typeof import("@/server/services/public-physiotherapist.service").PublicPhysiotherapistService;
  let counter = 0;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongod.getUri("physio_portfolio_test");
    process.env.FIELD_ENCRYPTION_KEY = randomBytes(32).toString("base64");

    db = await import("@zindagi/database");
    mongooseMod = (await import("mongoose")).default;
    await db.connectDatabase();
    await db.UserModel.init();
    await db.StaffProfileModel.init();

    svc = await import("@/server/services/physiotherapist.service");
    ({ PublicPhysiotherapistService } = await import("@/server/services/public-physiotherapist.service"));
  });

  afterAll(async () => {
    await mongooseMod.disconnect();
    await mongod.stop();
  });

  beforeEach(async () => {
    await Promise.all([db.UserModel.deleteMany({}), db.StaffProfileModel.deleteMany({})]);
  });

  async function createPhysioUser() {
    counter += 1;
    const user = await db.UserModel.create({
      name: `Portfolio Physio ${counter}`,
      email: `portfolio-${counter}-${Date.now()}@example.com`,
      roles: ["physiotherapist"],
      isActive: true,
    });
    return user._id.toString();
  }

  /** Mirrors the PATCH route: body is parsed by the schema before reaching the service. */
  function save(userId: string, body: unknown) {
    return svc.updatePhysiotherapistPortfolio(userId, updatePhysiotherapistPortfolioSchema.parse(body));
  }

  it("saves sections independently without wiping the others", async () => {
    const userId = await createPhysioUser();

    await save(userId, {
      headline: "Stroke rehab specialist",
      bio: "I help patients walk again.",
      languages: ["English", "Urdu"],
    });
    const after = await save(userId, {
      conditionsTreated: ["Stroke rehabilitation"],
      education: [{ degree: "DPT", institute: "University of Lahore", year: 2018 }],
    });

    expect(after.headline).toBe("Stroke rehab specialist");
    expect(after.bio).toBe("I help patients walk again.");
    expect(after.conditionsTreated).toEqual(["Stroke rehabilitation"]);
    expect(after.education).toEqual([{ degree: "DPT", institute: "University of Lahore", year: 2018 }]);
    expect(after.updatedAt).toBeDefined();

    const profile = await svc.getPhysiotherapistProfile(userId);
    expect(profile.portfolio).toEqual(after);
    expect(profile.portfolio).not.toHaveProperty("gallery");
  });

  it("shows the portfolio publicly only once approved", async () => {
    const userId = await createPhysioUser();
    await save(userId, {
      headline: "Sports physio",
      techniques: ["Dry needling"],
    });

    expect(await PublicPhysiotherapistService.get(userId)).toBeNull();

    await db.StaffProfileModel.updateOne({ userId }, { verificationStatus: "approved" });
    const publicProfile = await PublicPhysiotherapistService.get(userId);
    expect(publicProfile?.headline).toBe("Sports physio");
    expect(publicProfile?.portfolio?.techniques).toEqual(["Dry needling"]);

    const [listed] = await PublicPhysiotherapistService.list({ city: "Lahore" });
    expect(listed?.headline).toBe("Sports physio");
    expect(listed?.portfolio).toBeUndefined();
  });
});
