/**
 * Physiotherapist approval ↔ home visits — real local MongoDB + real services.
 * Business rule: every successful approval switches home visits on, and approval
 * requires a valid saved Google Maps location.
 */
import { MongoMemoryServer } from "mongodb-memory-server";
import { physiotherapistVerificationSchema } from "@zindagi/validators";
import { randomBytes } from "crypto";

jest.setTimeout(60000);

describe("Physiotherapist home-visit approval lifecycle (real local MongoDB)", () => {
  let mongod: InstanceType<typeof MongoMemoryServer>;
  let mongooseMod: typeof import("mongoose");
  let db: typeof import("@zindagi/database");
  let shared: typeof import("@zindagi/shared");
  let svc: typeof import("@/server/services/physiotherapist.service");
  let adminSvc: typeof import("@/server/services/admin-physiotherapist.service");
  let backfill: typeof import("@/server/services/physiotherapist-home-visit-backfill");
  let HomeVisitService: typeof import("@/server/services/home-visit.service").HomeVisitService;
  let avatarUrlFor: (userId: string) => string;
  let adminId: string;
  let counter = 0;

  const GEO = { lng: 74.3436, lat: 31.4697 };

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongod.getUri("physio_home_visit_approval_test");
    process.env.FIELD_ENCRYPTION_KEY = randomBytes(32).toString("base64");

    db = await import("@zindagi/database");
    shared = await import("@zindagi/shared");
    mongooseMod = (await import("mongoose")).default;
    await db.connectDatabase();
    await db.UserModel.init();
    await db.StaffProfileModel.init();
    await db.HomeVisitModel.init();

    svc = await import("@/server/services/physiotherapist.service");
    adminSvc = await import("@/server/services/admin-physiotherapist.service");
    backfill = await import("@/server/services/physiotherapist-home-visit-backfill");
    ({ HomeVisitService } = await import("@/server/services/home-visit.service"));
    const { physiotherapistAvatarPublicUrl } = await import(
      "@/server/services/physiotherapist-avatar.storage"
    );
    avatarUrlFor = (userId) => physiotherapistAvatarPublicUrl(`${userId}/avatar.png`);
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

  async function createPhysioUser() {
    counter += 1;
    const user = await db.UserModel.create({
      name: `Approval Physio ${counter}`,
      email: `approval-${counter}-${Date.now()}@example.com`,
      roles: ["physiotherapist"],
      isActive: true,
    });
    return user._id.toString();
  }

  function verificationBody(userId: string, geo: { lng: number; lat: number } | null = GEO) {
    return {
      cnic: "35202-1234567-1",
      qualification: "DPT",
      experienceYears: 4,
      serviceArea: {
        city: "Lahore",
        area: "DHA",
        // The signup form always sends false; approval is what switches it on.
        homeVisitEnabled: false,
        ...(geo ? { geo } : {}),
      },
      documentUrls: {
        degreeCertificate: "/uploads/degree.pdf",
        cnicFront: "/uploads/cnic-front.png",
        cnicBack: "/uploads/cnic-back.png",
      },
      acceptedProviderAgreement: true,
      specialties: [shared.PHYSIOTHERAPY_SPECIALTIES[0]],
      avatarUrl: avatarUrlFor(userId),
      homeVisitFee: 3000,
      bankAccount: { accountTitle: "Approval Physio", bankName: "HBL", accountNumber: "12345678" },
    };
  }

  /** Mirrors the POST route: body is parsed by the schema before reaching the service. */
  function submit(userId: string, geo?: { lng: number; lat: number }) {
    return svc.submitPhysiotherapistVerification(
      userId,
      physiotherapistVerificationSchema.parse(verificationBody(userId, geo)),
    );
  }

  async function staffFor(userId: string) {
    const staff = await db.StaffProfileModel.findOne({ userId, staffType: "physiotherapist" }).lean();
    if (!staff) throw new Error("staff profile missing");
    return staff;
  }

  it("runs signup → approve → reject → resubmit → re-approve with home visits on at each approval", async () => {
    const userId = await createPhysioUser();

    // 1. Signup with a valid location — pending, home visits off.
    await submit(userId, GEO);
    let staff = await staffFor(userId);
    const staffId = staff._id.toString();
    expect(staff.verificationStatus).toBe("pending");
    expect(staff.homeVisitEnabled).toBe(false);
    expect(staff.serviceAreas?.[0]?.geo?.coordinates).toEqual([GEO.lng, GEO.lat]);

    // 2. First approval — home visits on.
    await svc.decidePhysiotherapistVerification(adminId, staffId, "approve");
    staff = await staffFor(userId);
    expect(staff.verificationStatus).toBe("approved");
    expect(staff.homeVisitEnabled).toBe(true);

    // 3. Rejection — no longer approved.
    await svc.decidePhysiotherapistVerification(adminId, staffId, "reject", "License expired");
    staff = await staffFor(userId);
    expect(staff.verificationStatus).toBe("rejected");
    expect(staff.rejectionReason).toBe("License expired");

    // 4. Resubmission — pending, home visits off until approved again.
    await submit(userId, GEO);
    staff = await staffFor(userId);
    expect(staff.verificationStatus).toBe("pending");
    expect(staff.homeVisitEnabled).toBe(false);
    expect(staff.verifiedAt).toBeTruthy(); // earlier approval is remembered…

    // 5. Re-approval — …but home visits still switch back on.
    await svc.decidePhysiotherapistVerification(adminId, staffId, "approve");
    staff = await staffFor(userId);
    expect(staff.verificationStatus).toBe("approved");
    expect(staff.homeVisitEnabled).toBe(true);
  });

  it("rejects a verification submission without a Google Maps location", () => {
    const result = physiotherapistVerificationSchema.safeParse(verificationBody("u1", null));
    expect(result.success).toBe(false);
    expect(result.error?.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: ["serviceArea", "geo"],
          message: "Google Maps location is required for in-house visit matching",
        }),
      ]),
    );
  });

  it("ignores a client-sent homeVisitEnabled: true on submission", async () => {
    const userId = await createPhysioUser();
    const body = physiotherapistVerificationSchema.parse(verificationBody(userId, GEO));
    await svc.submitPhysiotherapistVerification(userId, {
      ...body,
      serviceArea: { ...body.serviceArea, homeVisitEnabled: true },
    });
    expect((await staffFor(userId)).homeVisitEnabled).toBe(false);
  });

  it("refuses approval when the saved location is missing (legacy pending application)", async () => {
    const userId = await createPhysioUser();
    await submit(userId, GEO);
    const staffId = (await staffFor(userId))._id.toString();
    // Simulate an application submitted before location became mandatory.
    await db.StaffProfileModel.updateOne({ _id: staffId }, { $unset: { "serviceAreas.0.geo": 1 } });

    const detail = await svc.getPhysiotherapistProfileForAdmin(staffId);
    expect(detail.serviceArea.hasLocation).toBe(false);

    await expect(
      svc.decidePhysiotherapistVerification(adminId, staffId, "approve"),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: expect.stringContaining("real Google Maps location is missing"),
    });

    const staff = await staffFor(userId);
    expect(staff.verificationStatus).toBe("pending");
    expect(staff.homeVisitEnabled).toBe(false);
  });

  it("rejects the Lahore placeholder pin on submission", () => {
    const result = physiotherapistVerificationSchema.safeParse(
      verificationBody("u1", { lng: shared.LAHORE_GEO.lng, lat: shared.LAHORE_GEO.lat }),
    );
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["serviceArea", "geo"]);
  });

  it("refuses approval when the saved location is the Lahore placeholder pin", async () => {
    const userId = await createPhysioUser();
    await submit(userId, GEO);
    const staffId = (await staffFor(userId))._id.toString();
    await db.StaffProfileModel.updateOne(
      { _id: staffId },
      { $set: { "serviceAreas.0.geo.coordinates": [shared.LAHORE_GEO.lng, shared.LAHORE_GEO.lat] } },
    );

    expect((await svc.getPhysiotherapistProfileForAdmin(staffId)).serviceArea.hasLocation).toBe(false);
    await expect(
      svc.decidePhysiotherapistVerification(adminId, staffId, "approve"),
    ).rejects.toMatchObject({ statusCode: 400 });
    const staff = await staffFor(userId);
    expect(staff.verificationStatus).toBe("pending");
    expect(staff.homeVisitEnabled).toBe(false);
  });

  it("does not let homeVisitEnabled: false in the same approval request override it", async () => {
    const userId = await createPhysioUser();
    await submit(userId, GEO);
    const staffId = (await staffFor(userId))._id.toString();

    const row = await adminSvc.adminUpdatePhysiotherapist(adminId, staffId, {
      verificationStatus: "approved",
      homeVisitEnabled: false,
    });
    expect(row.verificationStatus).toBe("approved");
    expect(row.homeVisitEnabled).toBe(true);

    // Outside an approval, the admin toggle still works.
    const off = await adminSvc.adminUpdatePhysiotherapist(adminId, staffId, {
      homeVisitEnabled: false,
    });
    expect(off.homeVisitEnabled).toBe(false);
  });

  it("lets an admin save a real location and approve in one request", async () => {
    const userId = await createPhysioUser();
    await submit(userId, GEO);
    const staffId = (await staffFor(userId))._id.toString();
    await db.StaffProfileModel.updateOne({ _id: staffId }, { $unset: { "serviceAreas.0.geo": 1 } });

    const row = await adminSvc.adminUpdatePhysiotherapist(adminId, staffId, {
      verificationStatus: "approved",
      geo: { lng: 74.31, lat: 31.48 },
    });
    expect(row.verificationStatus).toBe("approved");
    expect(row.homeVisitEnabled).toBe(true);
    expect((await staffFor(userId)).serviceAreas?.[0]?.geo?.coordinates).toEqual([74.31, 31.48]);
  });

  it("refuses approval when the saved coordinates are out of range", async () => {
    const userId = await createPhysioUser();
    await submit(userId, GEO);
    const staffId = (await staffFor(userId))._id.toString();
    await db.StaffProfileModel.collection.updateOne(
      { _id: new mongooseMod.Types.ObjectId(staffId) },
      { $set: { "serviceAreas.0.geo.coordinates": [500, 31.5] } },
    );

    await expect(
      svc.decidePhysiotherapistVerification(adminId, staffId, "approve"),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect((await staffFor(userId)).verificationStatus).toBe("pending");
  });

  it("turns home visits back on when an opted-out physio is rejected and re-approved", async () => {
    const userId = await createPhysioUser();
    await submit(userId, GEO);
    const staffId = (await staffFor(userId))._id.toString();
    await svc.decidePhysiotherapistVerification(adminId, staffId, "approve");

    // Physio opts out from their own profile.
    await svc.updatePhysiotherapistProfile(userId, { homeVisitEnabled: false });
    expect((await staffFor(userId)).homeVisitEnabled).toBe(false);

    await svc.decidePhysiotherapistVerification(adminId, staffId, "reject", "Re-check documents");
    await svc.decidePhysiotherapistVerification(adminId, staffId, "approve");

    const staff = await staffFor(userId);
    expect(staff.verificationStatus).toBe("approved");
    expect(staff.homeVisitEnabled).toBe(true);
  });

  it("turns home visits on when an admin-created physio is re-approved from the manage screen", async () => {
    counter += 1;
    const row = await adminSvc.adminCreatePhysiotherapist(adminId, {
      name: `Admin Physio ${counter}`,
      email: `admin-physio-${counter}-${Date.now()}@example.com`,
      phone: `0301${String(1000000 + counter).slice(-7)}`,
      licenseNumber: `PT-${counter}111`,
      specialties: [shared.PHYSIOTHERAPY_SPECIALTIES[0]],
      city: "Lahore",
      area: "DHA",
      geo: GEO,
    } as Parameters<typeof adminSvc.adminCreatePhysiotherapist>[1]);
    expect(row.homeVisitEnabled).toBe(true);

    await adminSvc.adminUpdatePhysiotherapist(adminId, row.id, {
      verificationStatus: "rejected",
      rejectionReason: "Missing degree",
    });
    const approved = await adminSvc.adminUpdatePhysiotherapist(adminId, row.id, {
      verificationStatus: "approved",
    });
    expect(approved.verificationStatus).toBe("approved");
    expect(approved.homeVisitEnabled).toBe(true);
  });
  it("never plants the placeholder pin when a profile is auto-created or edited without a location", async () => {
    const userId = await createPhysioUser();
    await svc.getPhysiotherapistProfile(userId);
    expect((await staffFor(userId)).serviceAreas?.[0]?.geo).toBeUndefined();

    await svc.updatePhysiotherapistProfile(userId, { city: "Karachi", area: "Clifton" });
    const staff = await staffFor(userId);
    expect(staff.serviceAreas?.[0]?.city).toBe("Karachi");
    expect(staff.serviceAreas?.[0]?.geo).toBeUndefined();
  });

  /** Seed an approved physio directly, as legacy data would look. */
  async function seedApproved(
    geo: number[] | undefined,
    overrides: Record<string, unknown> = {},
  ) {
    const userId = await createPhysioUser();
    const staff = await db.StaffProfileModel.create({
      userId,
      staffType: "physiotherapist",
      verificationStatus: "approved",
      verifiedAt: new Date(),
      homeVisitEnabled: false,
      isAvailable: true,
      serviceAreas: [
        {
          city: "Lahore",
          radiusKm: 15,
          ...(geo ? { geo: { type: "Point", coordinates: geo } } : {}),
        },
      ],
      ...overrides,
    });
    return { userId, staffId: staff._id.toString() };
  }

  it("backfill: only approved physios with home visits off and a genuine location are eligible", async () => {
    const real = await seedApproved([74.3436, 31.4697]);
    const placeholder = await seedApproved([shared.LAHORE_GEO.lng, shared.LAHORE_GEO.lat]);
    const missing = await seedApproved(undefined);
    await seedApproved([74.3, 31.5], { homeVisitEnabled: true }); // already on
    await seedApproved([74.3, 31.5], { verificationStatus: "pending" });
    await seedApproved([74.3, 31.5], { verificationStatus: "rejected" });
    await seedApproved([74.3, 31.5], { deletedAt: new Date() });
    await seedApproved([74.3, 31.5], { staffType: "nurse" });

    const report = await backfill.reportPhysiotherapistHomeVisitBackfill();
    expect(report.eligible).toEqual([real.staffId]);
    expect(report.excludedPlaceholder).toEqual([placeholder.staffId]);
    expect(report.excludedMissingOrInvalid).toEqual([missing.staffId]);
    expect(report.scanned).toBe(3);

    // The report is read-only.
    expect((await staffFor(real.userId)).homeVisitEnabled).toBe(false);

    const result = await backfill.applyPhysiotherapistHomeVisitBackfill(report.eligible);
    expect(result).toEqual({ updated: [real.staffId], skipped: [], failed: [] });
    expect((await staffFor(real.userId)).homeVisitEnabled).toBe(true);
    expect((await staffFor(placeholder.userId)).homeVisitEnabled).toBe(false);
    expect((await staffFor(missing.userId)).homeVisitEnabled).toBe(false);
    expect(await db.StaffProfileModel.countDocuments({ staffType: "nurse", homeVisitEnabled: true })).toBe(0);
  });

  it("backfill apply re-checks each ID and never touches excluded or drifted profiles", async () => {
    const real = await seedApproved([74.3436, 31.4697]);
    const placeholder = await seedApproved([shared.LAHORE_GEO.lng, shared.LAHORE_GEO.lat]);
    const report = await backfill.reportPhysiotherapistHomeVisitBackfill();
    // Location removed after the dry run.
    await db.StaffProfileModel.updateOne({ _id: real.staffId }, { $unset: { "serviceAreas.0.geo": 1 } });

    const result = await backfill.applyPhysiotherapistHomeVisitBackfill([
      ...report.eligible,
      placeholder.staffId,
    ]);
    expect(result.updated).toEqual([]);
    expect(result.skipped.sort()).toEqual([real.staffId, placeholder.staffId].sort());
    expect((await staffFor(real.userId)).homeVisitEnabled).toBe(false);
    expect((await staffFor(placeholder.userId)).homeVisitEnabled).toBe(false);
  });

  it("matching only returns approved physiotherapists with home visits on", async () => {
    const near = [74.3436, 31.4697];
    const approved = await seedApproved(near, { homeVisitEnabled: true });
    await seedApproved(near, { homeVisitEnabled: true, verificationStatus: "pending" });
    await seedApproved(near, { homeVisitEnabled: true, verificationStatus: "rejected" });
    await seedApproved(near, { homeVisitEnabled: false });

    const match = await HomeVisitService.findNearestAvailablePhysiotherapist(
      near[0],
      near[1],
      new Date(),
    );
    expect(match?.userId).toBe(approved.userId);

    await db.StaffProfileModel.updateOne({ _id: approved.staffId }, { verificationStatus: "rejected" });
    expect(
      await HomeVisitService.findNearestAvailablePhysiotherapist(near[0], near[1], new Date()),
    ).toBeNull();
  });
});
