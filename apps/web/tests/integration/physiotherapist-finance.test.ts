/**
 * Physiotherapist earnings & Sunday payouts — real local MongoDB (mongodb-memory-server)
 * + the REAL @zindagi/database models and physiotherapist-finance.service code.
 * Only receipt file storage (Supabase) is stubbed.
 */
import { MongoMemoryServer } from "mongodb-memory-server";
import { randomBytes } from "crypto";

const savePayoutReceipt = jest.fn(
  async (profileId: string, payoutId: string, file: File) => ({
    storageKey: `${profileId}/${payoutId}/receipt.png`,
    url: "/unused",
    originalName: file.name,
    mimeType: file.type,
  }),
);
jest.mock("@/server/services/payout-receipt.storage", () => ({
  savePayoutReceipt: (...args: Parameters<typeof savePayoutReceipt>) =>
    savePayoutReceipt(...args),
}));

jest.setTimeout(60000);

describe("Physiotherapist earnings & payouts (real local MongoDB)", () => {
  let mongod: InstanceType<typeof MongoMemoryServer>;
  let mongooseMod: typeof import("mongoose");
  let db: typeof import("@zindagi/database");
  let shared: typeof import("@zindagi/shared");
  let validators: typeof import("@zindagi/validators");
  let adminSvc: typeof import("@/server/services/admin-physiotherapist.service");
  let finance: typeof import("@/server/services/physiotherapist-finance.service");
  let adminId: string;
  let counter = 0;

  const bank = {
    accountTitle: "Physio Person",
    bankName: "Meezan Bank",
    accountNumber: "0123456789",
    iban: undefined,
  };

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongod.getUri("physio_finance_test");
    process.env.FIELD_ENCRYPTION_KEY = randomBytes(32).toString("base64");

    db = await import("@zindagi/database");
    shared = await import("@zindagi/shared");
    validators = await import("@zindagi/validators");
    mongooseMod = (await import("mongoose")).default;
    await db.connectDatabase();
    await db.UserModel.init();
    await db.StaffProfileModel.init();
    await db.HomeVisitModel.init();
    await db.DoctorPayoutModel.init();

    adminSvc = await import("@/server/services/admin-physiotherapist.service");
    finance = await import("@/server/services/physiotherapist-finance.service");
  });

  afterAll(async () => {
    await mongooseMod.disconnect();
    await mongod.stop();
  });

  beforeEach(async () => {
    savePayoutReceipt.mockClear();
    await Promise.all([
      db.UserModel.deleteMany({}),
      db.StaffProfileModel.deleteMany({}),
      db.HomeVisitModel.deleteMany({}),
      db.DoctorPayoutModel.deleteMany({}),
    ]);
    const admin = await db.UserModel.create({
      name: "Ops Admin",
      email: `admin-${Date.now()}@example.com`,
      roles: ["admin"],
      isActive: true,
    });
    adminId = admin._id.toString();
  });

  async function createPhysio() {
    counter += 1;
    return adminSvc.adminCreatePhysiotherapist(adminId, {
      name: `Physio Person ${counter}`,
      email: `physio-${counter}-${Date.now()}@example.com`,
      phone: `0300${String(1000000 + counter).slice(-7)}`,
      licenseNumber: `PT-${counter}000`,
      specialties: [shared.PHYSIOTHERAPY_SPECIALTIES[0] as string],
      city: "Lahore",
      area: "DHA",
    } as Parameters<typeof adminSvc.adminCreatePhysiotherapist>[1]);
  }

  async function createVisit(
    staffUserId: string,
    status: import("@zindagi/shared").HomeVisitStatus,
    total: number,
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
      pricing: { base: total, surge: 0, distance: 0, total, currency: "PKR" },
      assignedStaffId: staffUserId,
      ...(status === shared.HomeVisitStatuses.COMPLETED ? { completedAt: new Date() } : {}),
    });
  }

  function receipt() {
    return new File([Buffer.from("png-bytes")], "receipt.png", { type: "image/png" });
  }

  it("uses a 70/30 split", () => {
    expect(shared.PHYSIOTHERAPY_HOME_VISIT_SPLIT.physiotherapistPercent).toBe(70);
    expect(shared.PHYSIOTHERAPY_HOME_VISIT_SPLIT.platformPercent).toBe(30);
    expect(shared.calculatePhysiotherapistVisitEarnings(2800)).toBe(1960);
    expect(shared.calculatePhysiotherapistVisitEarnings(3500)).toBe(2450);
    expect(shared.calculatePhysiotherapistVisitEarnings(3000, 80)).toBe(2400);
    expect(shared.calculatePhysiotherapistVisitEarnings(0)).toBe(0);
  });

  it("requires payout bank details on the verification form", () => {
    const base = {
      licenseNumber: "PT-1",
      cnic: "35202-1234567-1",
      qualification: "DPT",
      experienceYears: 3,
      homeVisitFee: 2000,
      specialties: [shared.PHYSIOTHERAPY_SPECIALTIES[0] as string],
      avatarUrl: "/api/v1/physiotherapist/avatar/x.webp",
      serviceArea: { city: "Lahore", area: "DHA", homeVisitEnabled: false, geo: { lng: 74.3436, lat: 31.4697 } },
      documentUrls: { degreeCertificate: "d", licenseCertificate: "a", cnicFront: "b", cnicBack: "c" },
      acceptedProviderAgreement: true,
    };
    const missing = validators.physiotherapistVerificationSchema.safeParse(base);
    expect(missing.success).toBe(false);
    expect(missing.error?.issues[0]?.path).toEqual(["bankAccount"]);
    expect(missing.error?.issues[0]?.message).toMatch(/Refresh this page/);
    expect(
      validators.physiotherapistVerificationSchema.safeParse({ ...base, bankAccount: bank })
        .success,
    ).toBe(true);
    expect(
      validators.physiotherapistVerificationSchema.safeParse({
        ...base,
        bankAccount: { ...bank, accountNumber: "" },
      }).success,
    ).toBe(false);
  });

  it("requires a degree certificate but not a license on the verification form", () => {
    const base = {
      cnic: "35202-1234567-1",
      qualification: "DPT",
      experienceYears: 3,
      homeVisitFee: 2000,
      specialties: [shared.PHYSIOTHERAPY_SPECIALTIES[0] as string],
      avatarUrl: "/api/v1/physiotherapist/avatar/x.webp",
      serviceArea: { city: "Lahore", area: "DHA", homeVisitEnabled: false, geo: { lng: 74.3436, lat: 31.4697 } },
      documentUrls: { degreeCertificate: "d", cnicFront: "b", cnicBack: "c" },
      bankAccount: bank,
      acceptedProviderAgreement: true,
    };
    expect(validators.physiotherapistVerificationSchema.safeParse(base).success).toBe(true);
    expect(
      validators.physiotherapistVerificationSchema.safeParse({ ...base, licenseNumber: "" })
        .success,
    ).toBe(true);
    const noDegree = validators.physiotherapistVerificationSchema.safeParse({
      ...base,
      documentUrls: { cnicFront: "b", cnicBack: "c" },
    });
    expect(noDegree.success).toBe(false);
    expect(noDegree.error?.issues[0]?.path).toEqual(["documentUrls", "degreeCertificate"]);
    const noFee: Record<string, unknown> = { ...base };
    delete noFee.homeVisitFee;
    expect(validators.physiotherapistVerificationSchema.safeParse(noFee).success).toBe(false);
  });

  it("credits 70% of completed visits only", async () => {
    const row = await createPhysio();
    await createVisit(row.userId, shared.HomeVisitStatuses.COMPLETED, 2800);
    await createVisit(row.userId, shared.HomeVisitStatuses.COMPLETED, 3500);
    await createVisit(row.userId, shared.HomeVisitStatuses.ASSIGNED, 2800);
    await createVisit(row.userId, shared.HomeVisitStatuses.CANCELLED, 2800);

    const earnings = await finance.getPhysiotherapistEarnings(row.userId);
    expect(earnings.physiotherapistPercent).toBe(70);
    expect(earnings.platformPercent).toBe(30);
    expect(earnings.completedVisits).toBe(2);
    expect(earnings.totalEarnings).toBe(1960 + 2450);
    expect(earnings.earningsThisMonth).toBe(1960 + 2450);
    expect(earnings.availableBalance).toBe(4410);
    expect(earnings.transactions.map((t) => t.platformFee).sort()).toEqual([1050, 840]);
  });

  it("stores the bank account encrypted and reads it back", async () => {
    const row = await createPhysio();
    expect(await finance.getOwnPhysiotherapistBankAccount(row.userId)).toBeNull();

    await finance.updateOwnPhysiotherapistBankAccount(row.userId, bank);
    expect(await finance.getOwnPhysiotherapistBankAccount(row.userId)).toEqual({
      ...bank,
      iban: undefined,
    });

    const raw = await db.StaffProfileModel.collection.findOne({ userId: new mongooseMod.Types.ObjectId(row.userId) });
    expect(JSON.stringify(raw?.bankAccount)).not.toContain(bank.accountNumber);
  });

  it("records a Sunday payout for the full balance and clears it", async () => {
    const row = await createPhysio();
    await createVisit(row.userId, shared.HomeVisitStatuses.COMPLETED, 2800);

    // No bank account yet → refused before any receipt is stored.
    await expect(
      finance.recordPhysiotherapistPayout(adminId, row.id, {
        amount: 1960,
        method: "bank_transfer",
        receiptFile: receipt(),
      }),
    ).rejects.toMatchObject({ statusCode: 400 });

    await finance.updateOwnPhysiotherapistBankAccount(row.userId, bank);

    // Partial payouts are refused.
    await expect(
      finance.recordPhysiotherapistPayout(adminId, row.id, {
        amount: 1000,
        method: "bank_transfer",
        receiptFile: receipt(),
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(savePayoutReceipt).not.toHaveBeenCalled();

    const payout = await finance.recordPhysiotherapistPayout(adminId, row.id, {
      amount: 1960,
      method: "bank_transfer",
      note: "Sunday transfer",
      receiptFile: receipt(),
    });
    expect(payout.amount).toBe(1960);
    expect(payout.receiptUrl).toBe(
      `/api/v1/admin/physiotherapists/${row.id}/finance/payouts/${payout.id}/receipt`,
    );
    expect(savePayoutReceipt).toHaveBeenCalledTimes(1);

    const after = await finance.getAdminPhysiotherapistFinance(row.id);
    expect(after.availableBalance).toBe(0);
    expect(after.totalPaidOut).toBe(1960);
    expect(after.payouts).toHaveLength(1);
    expect(after.bankAccount?.accountNumber).toBe(bank.accountNumber);

    const own = await finance.getPhysiotherapistEarnings(row.userId);
    expect(own.availableBalance).toBe(0);
    expect(own.payouts[0]?.receiptUrl).toBe(payout.receiptUrl);

    // Receipt lookup is scoped to the owning physiotherapist.
    await expect(finance.getPhysiotherapistPayoutReceipt(row.id, payout.id)).resolves.toMatchObject({
      storageKey: expect.stringContaining(payout.id),
    });
    const other = await createPhysio();
    await expect(
      finance.getPhysiotherapistPayoutReceipt(other.id, payout.id),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(await finance.isOwnPhysiotherapistProfile(row.id, row.userId)).toBe(true);
    expect(await finance.isOwnPhysiotherapistProfile(row.id, other.userId)).toBe(false);

    // Nothing left to pay.
    await expect(
      finance.recordPhysiotherapistPayout(adminId, row.id, {
        amount: 1960,
        method: "bank_transfer",
        receiptFile: receipt(),
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("keeps physiotherapist payouts out of doctor payout lookups", async () => {
    const row = await createPhysio();
    await createVisit(row.userId, shared.HomeVisitStatuses.COMPLETED, 2800);
    await finance.updateOwnPhysiotherapistBankAccount(row.userId, bank);
    await finance.recordPhysiotherapistPayout(adminId, row.id, {
      amount: 1960,
      method: "bank_transfer",
      receiptFile: receipt(),
    });

    const ledger = await db.DoctorPayoutModel.find({}).lean();
    expect(ledger).toHaveLength(1);
    expect(ledger[0]?.providerRole).toBe("physiotherapist");
    expect(ledger[0]?.providerProfileId?.toString()).toBe(row.id);
    expect(
      await db.DoctorPayoutModel.countDocuments({ providerRole: "doctor" }),
    ).toBe(0);
  });
});
