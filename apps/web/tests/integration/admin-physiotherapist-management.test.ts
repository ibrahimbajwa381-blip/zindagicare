/**
 * Admin physiotherapist management — real local MongoDB (mongodb-memory-server)
 * + the REAL @zindagi/database models and admin-physiotherapist.service code.
 */
import { MongoMemoryServer } from "mongodb-memory-server";
import { randomBytes } from "crypto";

jest.setTimeout(60000);

describe("Admin physiotherapist management (real local MongoDB)", () => {
  let mongod: InstanceType<typeof MongoMemoryServer>;
  let mongooseMod: typeof import("mongoose");
  let db: typeof import("@zindagi/database");
  let shared: typeof import("@zindagi/shared");
  let svc: typeof import("@/server/services/admin-physiotherapist.service");
  let HomeVisitService: typeof import("@/server/services/home-visit.service").HomeVisitService;
  let adminId: string;
  let counter = 0;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongod.getUri("admin_physio_test");
    process.env.FIELD_ENCRYPTION_KEY = randomBytes(32).toString("base64");

    db = await import("@zindagi/database");
    shared = await import("@zindagi/shared");
    mongooseMod = (await import("mongoose")).default;
    await db.connectDatabase();
    await db.UserModel.init();
    await db.StaffProfileModel.init();
    await db.HomeVisitModel.init();

    svc = await import("@/server/services/admin-physiotherapist.service");
    ({ HomeVisitService } = await import("@/server/services/home-visit.service"));
  });

  afterAll(async () => {
    await mongooseMod.disconnect();
    await mongod.stop();
  });

  beforeEach(async () => {
    await Promise.all([
      db.UserModel.deleteMany({}),
      db.StaffProfileModel.deleteMany({}),
      db.HomeVisitModel.deleteMany({}),
    ]);
    const admin = await db.UserModel.create({
      name: "Ops Admin",
      email: `admin-${Date.now()}@example.com`,
      roles: ["admin"],
      isActive: true,
    });
    adminId = admin._id.toString();
  });

  function specialty(i = 0) {
    return shared.PHYSIOTHERAPY_SPECIALTIES[i] as string;
  }

  async function createPhysio(overrides: Record<string, unknown> = {}) {
    counter += 1;
    return svc.adminCreatePhysiotherapist(adminId, {
      name: `Physio Person ${counter}`,
      email: `physio-${counter}-${Date.now()}@example.com`,
      phone: `0300${String(1000000 + counter).slice(-7)}`,
      licenseNumber: `PT-${counter}000`,
      specialties: [specialty()],
      city: "Lahore",
      area: "DHA",
      ...overrides,
    } as Parameters<typeof svc.adminCreatePhysiotherapist>[1]);
  }

  async function createVisit(
    staffUserId: string,
    status: import("@zindagi/shared").HomeVisitStatus,
    extra: Record<string, unknown> = {},
  ) {
    const patient = await db.UserModel.create({
      name: "Patient",
      email: `patient-${Date.now()}-${Math.random()}@example.com`,
      roles: ["patient"],
      isActive: true,
    });
    return db.HomeVisitModel.create({
      patientId: patient._id,
      serviceType: shared.HomeVisitServiceTypes.PHYSIOTHERAPY,
      status,
      scheduledAt: new Date(),
      address: {
        line: "House 1",
        city: "Lahore",
        geo: { type: "Point", coordinates: [74.3587, 31.5204] },
      },
      pricing: { base: 3000, surge: 0, distance: 0, total: 3000, currency: "PKR" },
      assignedStaffId: staffUserId,
      ...(status === shared.HomeVisitStatuses.COMPLETED ? { completedAt: new Date() } : {}),
      ...extra,
    });
  }

  it("creates an approved, listed physiotherapist with a slug", async () => {
    const row = await createPhysio();
    expect(row.verificationStatus).toBe("approved");
    expect(row.isActive).toBe(true);
    expect(row.homeVisitEnabled).toBe(true);
    expect(row.slug).toBeTruthy();
    expect(row.specialties).toEqual([specialty()]);

    const list = await svc.listPhysiotherapistsForManagement();
    expect(list.map((r) => r.id)).toEqual([row.id]);
  });

  it("rejects duplicate email and phone, and rolls back nothing half-created", async () => {
    const first = await createPhysio();
    await expect(
      createPhysio({ email: first.email }),
    ).rejects.toMatchObject({ statusCode: 409 });
    await expect(
      createPhysio({ phone: first.phone }),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(await db.StaffProfileModel.countDocuments({})).toBe(1);
  });

  it("searches decrypted name, email, license and phone", async () => {
    const a = await createPhysio({ name: "Ayesha Khan" });
    await createPhysio({ name: "Bilal Ahmed" });
    expect((await svc.listPhysiotherapistsForManagement("ayesha")).map((r) => r.id)).toEqual([a.id]);
    expect((await svc.listPhysiotherapistsForManagement(a.licenseNumber)).map((r) => r.id)).toEqual([a.id]);
    expect((await svc.listPhysiotherapistsForManagement(a.phone!.slice(-6))).map((r) => r.id)).toEqual([a.id]);
    expect(await svc.listPhysiotherapistsForManagement("nobody-matches")).toEqual([]);
  });

  it("hides pending applications from the directory", async () => {
    const row = await createPhysio();
    await db.StaffProfileModel.updateOne({ _id: row.id }, { verificationStatus: "pending" });
    expect(await svc.listPhysiotherapistsForManagement()).toEqual([]);
  });

  it("updates toggles, commission, and profile fields", async () => {
    const row = await createPhysio();
    const updated = await svc.adminUpdatePhysiotherapist(adminId, row.id, {
      isAvailable: false,
      commissionPercent: 80,
      name: "Renamed Physio",
      city: "Karachi",
      area: "Clifton",
      radiusKm: 20,
      specialties: [specialty(1), specialty(2)],
      qualification: "DPT",
      experienceYears: 7,
      languages: ["English"],
      bio: "Sports rehab",
    });
    expect(updated.isAvailable).toBe(false);
    expect(updated.commissionPercent).toBe(80);
    expect(updated.name).toBe("Renamed Physio");
    expect(updated.city).toBe("Karachi");
    expect(updated.area).toBe("Clifton");
    expect(updated.specialties).toEqual([specialty(1), specialty(2)]);
    expect(updated.experienceYears).toBe(7);

    const staff = await db.StaffProfileModel.findById(row.id).lean();
    expect(staff?.serviceAreas?.[0]?.radiusKm).toBe(20);
    expect(staff?.serviceAreas?.[0]?.geo?.coordinates).toHaveLength(2);
    expect(staff?.bio).toBe("Sports rehab");

    const reset = await svc.adminUpdatePhysiotherapist(adminId, row.id, { commissionPercent: null });
    expect(reset.commissionPercent).toBe(shared.STAFF_COMMISSION_CONFIG.defaultPhysiotherapistPercent);
  });

  it("rejects then re-approves, and blocks enabling home visits while rejected", async () => {
    const row = await createPhysio();
    const rejected = await svc.adminUpdatePhysiotherapist(adminId, row.id, {
      verificationStatus: "rejected",
      rejectionReason: "License expired",
      homeVisitEnabled: false,
    });
    expect(rejected.verificationStatus).toBe("rejected");
    expect(rejected.rejectionReason).toBe("License expired");
    expect(rejected.homeVisitEnabled).toBe(false);

    await expect(
      svc.adminUpdatePhysiotherapist(adminId, row.id, { homeVisitEnabled: true }),
    ).rejects.toMatchObject({ statusCode: 400 });

    const approved = await svc.adminUpdatePhysiotherapist(adminId, row.id, {
      verificationStatus: "approved",
      homeVisitEnabled: true,
    });
    expect(approved.verificationStatus).toBe("approved");
    expect(approved.homeVisitEnabled).toBe(true);
  });

  it("refuses a phone number owned by another account but accepts its own", async () => {
    const a = await createPhysio();
    const b = await createPhysio();
    await expect(
      svc.adminUpdatePhysiotherapist(adminId, a.id, { phone: b.phone }),
    ).rejects.toMatchObject({ statusCode: 409 });
    await expect(
      svc.adminUpdatePhysiotherapist(adminId, a.id, { phone: a.phone }),
    ).resolves.toMatchObject({ phone: a.phone });
  });

  it("returns 404 for unknown or malformed ids", async () => {
    await expect(
      svc.adminUpdatePhysiotherapist(adminId, "not-an-id", { isAvailable: true }),
    ).rejects.toMatchObject({ statusCode: 404 });
    await expect(
      svc.adminDeletePhysiotherapist(adminId, new mongooseMod.Types.ObjectId().toString()),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("computes visit stats and net earnings", async () => {
    const row = await createPhysio();
    await svc.adminUpdatePhysiotherapist(adminId, row.id, { commissionPercent: 70 });
    await createVisit(row.userId, shared.HomeVisitStatuses.COMPLETED);
    await createVisit(row.userId, shared.HomeVisitStatuses.ASSIGNED);
    await createVisit(row.userId, shared.HomeVisitStatuses.CANCELLED);

    const [listed] = await svc.listPhysiotherapistsForManagement();
    expect(listed.stats.completedTotal).toBe(1);
    expect(listed.stats.completedThisMonth).toBe(1);
    expect(listed.stats.activeVisits).toBe(1);
    expect(listed.stats.totalEarnings).toBe(shared.calculateStaffNetEarnings(3000, 70));
  });

  it("makes a deactivated physiotherapist unbookable", async () => {
    const row = await createPhysio();
    await svc.adminUpdatePhysiotherapist(adminId, row.id, { isActive: false });
    await expect(
      HomeVisitService.assertPhysiotherapistBookable(row.userId, 74.3587, 31.5204, new Date()),
    ).rejects.toMatchObject({ statusCode: 400 });
    const [listed] = await svc.listPhysiotherapistsForManagement();
    expect(listed.isActive).toBe(false);
  });

  it("blocks deletion with open visits, then deletes account and profile", async () => {
    const row = await createPhysio();
    const visit = await createVisit(row.userId, shared.HomeVisitStatuses.EN_ROUTE);
    await expect(svc.adminDeletePhysiotherapist(adminId, row.id)).rejects.toMatchObject({
      statusCode: 400,
    });

    // A requested visit where the patient picked this physio also blocks.
    await db.HomeVisitModel.updateOne(
      { _id: visit._id },
      { status: shared.HomeVisitStatuses.REQUESTED, $unset: { assignedStaffId: 1 }, preferredStaffId: row.userId },
    );
    await expect(svc.adminDeletePhysiotherapist(adminId, row.id)).rejects.toMatchObject({
      statusCode: 400,
    });

    await db.HomeVisitModel.updateOne({ _id: visit._id }, { status: shared.HomeVisitStatuses.CANCELLED });
    await svc.adminDeletePhysiotherapist(adminId, row.id);
    expect(await db.StaffProfileModel.findById(row.id)).toBeNull();
    expect(await db.UserModel.findById(row.userId)).toBeNull();
    expect(await db.HomeVisitModel.findById(visit._id)).not.toBeNull();
  });

  it("keeps a shared account and only strips the physiotherapist role", async () => {
    const row = await createPhysio();
    await db.UserModel.updateOne({ _id: row.userId }, { roles: ["physiotherapist", "patient"] });
    await svc.adminDeletePhysiotherapist(adminId, row.id);
    const user = await db.UserModel.findById(row.userId).lean();
    expect(user?.roles).toEqual(["patient"]);
    expect(await db.StaffProfileModel.findById(row.id)).toBeNull();
  });
});
