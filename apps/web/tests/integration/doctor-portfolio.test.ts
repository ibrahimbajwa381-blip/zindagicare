/**
 * Doctor portfolio — real local MongoDB + real models/services.
 */
import { MongoMemoryServer } from "mongodb-memory-server";
import { updateDoctorPortfolioSchema } from "@zindagi/validators";
import { randomBytes } from "crypto";

jest.setTimeout(60000);

const VIDEO_ID = "dQw4w9WgXcQ";

describe("Doctor portfolio (real local MongoDB)", () => {
  let mongod: InstanceType<typeof MongoMemoryServer>;
  let mongooseMod: typeof import("mongoose");
  let db: typeof import("@zindagi/database");
  let svc: typeof import("@/server/services/doctor-profile.service");
  let PublicDoctorService: typeof import("@/server/services/public-doctor.service").PublicDoctorService;
  let counter = 0;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongod.getUri("doctor_portfolio_test");
    process.env.FIELD_ENCRYPTION_KEY = randomBytes(32).toString("base64");

    db = await import("@zindagi/database");
    mongooseMod = (await import("mongoose")).default;
    await db.connectDatabase();
    await db.UserModel.init();
    await db.DoctorProfileModel.init();

    svc = await import("@/server/services/doctor-profile.service");
    ({ PublicDoctorService } = await import("@/server/services/public-doctor.service"));
  });

  afterAll(async () => {
    await mongooseMod.disconnect();
    await mongod.stop();
  });

  beforeEach(async () => {
    await Promise.all([db.UserModel.deleteMany({}), db.DoctorProfileModel.deleteMany({})]);
  });

  async function createDoctor(overrides: Record<string, unknown> = {}) {
    counter += 1;
    const user = await db.UserModel.create({
      name: `Portfolio Doctor ${counter}`,
      email: `doctor-portfolio-${counter}-${Date.now()}@example.com`,
      roles: ["doctor"],
      isActive: true,
    });
    const profile = await db.DoctorProfileModel.create({
      userId: user._id,
      specialties: ["Cardiologist"],
      primarySpecialty: "Cardiologist",
      bio: "Original bio",
      verificationStatus: "approved",
      verificationSubmittedAt: new Date(),
      isListed: true,
      slug: `portfolio-doctor-${counter}`,
      ...overrides,
    });
    return { userId: user._id.toString(), slug: profile.slug! };
  }

  /** Mirrors the PATCH route: body is parsed by the schema before reaching the service. */
  function save(userId: string, body: unknown) {
    return svc.updateDoctorPortfolio(userId, updateDoctorPortfolioSchema.parse(body));
  }

  it("saves sections independently without wiping the others", async () => {
    const { userId } = await createDoctor();

    await save(userId, {
      headline: "Interventional cardiologist",
      bio: "I have treated heart patients for 15 years.",
      languages: ["English", "Urdu", "Punjabi"],
      introVideoUrl: `https://youtu.be/${VIDEO_ID}`,
    });
    await save(userId, {
      services: [{ name: "Echocardiography", fee: 3500 }],
      conditionsTreated: ["Hypertension", "Heart failure"],
    });
    const after = await save(userId, {
      faqs: [{ question: "Do you offer online follow-ups?", answer: "Yes, by video." }],
      links: { linkedin: "https://www.linkedin.com/in/dr-test" },
    });

    expect(after.headline).toBe("Interventional cardiologist");
    expect(after.bio).toBe("I have treated heart patients for 15 years.");
    expect(after.languages).toEqual(["English", "Urdu", "Punjabi"]);
    expect(after.introVideoUrl).toBe(`https://www.youtube.com/watch?v=${VIDEO_ID}`);
    expect(after.services).toEqual([{ name: "Echocardiography", fee: 3500, description: undefined }]);
    expect(after.conditionsTreated).toEqual(["Hypertension", "Heart failure"]);
    expect(after.faqs).toHaveLength(1);
    expect(after.links).toEqual({ linkedin: "https://www.linkedin.com/in/dr-test" });
    expect(after.updatedAt).toBeDefined();

    const profile = await svc.getDoctorProfile(userId);
    expect(profile.portfolio).toEqual(after);
    // Bio is shared with the profile editor and stays encrypted at rest.
    expect(profile.bio).toBe("I have treated heart patients for 15 years.");
    const raw = await db.DoctorProfileModel.collection.findOne({ userId: new mongooseMod.Types.ObjectId(userId) });
    expect(raw?.bio).not.toBe("I have treated heart patients for 15 years.");
  });

  it("clears optional text fields and the video when sent empty", async () => {
    const { userId } = await createDoctor();
    await save(userId, { headline: "Headline", approach: "Approach", introVideoUrl: `https://youtu.be/${VIDEO_ID}` });
    const cleared = await save(userId, { headline: "", approach: "", introVideoUrl: "" });
    expect(cleared.headline).toBeUndefined();
    expect(cleared.approach).toBeUndefined();
    expect(cleared.introVideoUrl).toBeUndefined();
  });

  it("publishes the portfolio on the public profile with hidden sections removed", async () => {
    const { userId, slug } = await createDoctor({
      weeklyAvailability: [{ dayOfWeek: 1, startTimeLocal: "17:00", endTimeLocal: "21:00" }],
    });
    await save(userId, {
      headline: "Heart specialist",
      services: [{ name: "ECG" }],
      faqs: [{ question: "Do you see children?", answer: "Only teenagers." }],
      hiddenSections: ["faqs"],
    });

    const pub = await PublicDoctorService.getPublicDoctor(slug);
    expect(pub).not.toBeNull();
    expect(pub!.portfolio.headline).toBe("Heart specialist");
    expect(pub!.portfolio.services).toHaveLength(1);
    expect(pub!.portfolio.faqs).toEqual([]);
    expect(pub!.portfolio.hiddenSections).toEqual([]);
    expect(pub!.weeklyAvailability).toEqual([
      { dayOfWeek: 1, startTimeLocal: "17:00", endTimeLocal: "21:00" },
    ]);

    // The doctor still sees the hidden content in their own editor.
    const own = await svc.getDoctorProfile(userId);
    expect(own.portfolio.faqs).toHaveLength(1);
    expect(own.portfolio.hiddenSections).toEqual(["faqs"]);
  });

  it("lets a pending doctor build a portfolio that stays off the public site", async () => {
    const { userId, slug } = await createDoctor({ verificationStatus: "pending", isListed: false });
    const saved = await save(userId, { headline: "Coming soon" });
    expect(saved.headline).toBe("Coming soon");
    expect(await PublicDoctorService.getPublicDoctor(slug)).toBeNull();
  });

  it("refuses users without the doctor role", async () => {
    const patient = await db.UserModel.create({
      name: "Not A Doctor",
      email: `patient-${Date.now()}@example.com`,
      roles: ["patient"],
      isActive: true,
    });
    await expect(save(patient._id.toString(), { headline: "x" })).rejects.toMatchObject({
      statusCode: 403,
    });
  });
});
