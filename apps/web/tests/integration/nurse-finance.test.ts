/**
 * Nurse earnings & Sunday payouts — real local MongoDB (mongodb-memory-server)
 * + the REAL @zindagi/database models and nurse-finance.service code.
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

describe("Nurse earnings & payouts (real local MongoDB)", () => {
  let mongod: InstanceType<typeof MongoMemoryServer>;
  let mongooseMod: typeof import("mongoose");
  let db: typeof import("@zindagi/database");
  let shared: typeof import("@zindagi/shared");
  let validators: typeof import("@zindagi/validators");
  let adminSvc: typeof import("@/server/services/admin-nurse.service");
  let finance: typeof import("@/server/services/nurse-finance.service");
  let adminId: string;
  let counter = 0;

  const bank = {
    accountTitle: "Nurse Person",
    bankName: "Meezan Bank",
    accountNumber: "0123456789",
    iban: undefined as string | undefined,
  };

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongod.getUri("nurse_finance_test");
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

    adminSvc = await import("@/server/services/admin-nurse.service");
    finance = await import("@/server/services/nurse-finance.service");
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

  async function createNurse() {
    counter += 1;
    return adminSvc.adminCreateNurse(adminId, {
      name: `Nurse Person ${counter}`,
      email: `nurse-${counter}-${Date.now()}@example.com`,
      phone: `0300${String(1000000 + counter).slice(-7)}`,
      licenseNumber: `PT-${counter}000`,
      specialties: [shared.NURSING_SPECIALTIES[0] as string],
      city: "Lahore",
      area: "DHA",
    } as Parameters<typeof adminSvc.adminCreateNurse>[1]);
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
      serviceType: shared.HomeVisitServiceTypes.NURSE,
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
    expect(shared.NURSING_HOME_VISIT_SPLIT.nursePercent).toBe(70);
    expect(shared.NURSING_HOME_VISIT_SPLIT.platformPercent).toBe(30);
    expect(shared.NURSING_HOME_VISIT_SPLIT.patientPays).toBe(1800);
    expect(shared.NURSING_HOME_VISIT_SPLIT.nurseEarns).toBe(1260);
    expect(shared.calculateNurseVisitEarnings(2800)).toBe(1960);
    expect(shared.calculateNurseVisitEarnings(3500)).toBe(2450);
    expect(shared.calculateNurseVisitEarnings(3000, 80)).toBe(2400);
    expect(shared.calculateNurseVisitEarnings(0)).toBe(0);
  });

  it("requires payout bank details on the verification form", () => {
    const base = {
      licenseNumber: "PT-1",
      cnic: "35202-1234567-1",
      qualification: "BSN",
      experienceYears: 3,
      specialties: [shared.NURSING_SPECIALTIES[0] as string],
      avatarUrl: "/api/v1/nurse/avatar/x.webp",
      serviceArea: { city: "Lahore", area: "DHA", homeVisitEnabled: false },
      documentUrls: { degreeCertificate: "d", licenseCertificate: "a", cnicFront: "b", cnicBack: "c" },
      acceptedProviderAgreement: true,
    };
    const missing = validators.nurseVerificationSchema.safeParse(base);
    expect(missing.success).toBe(false);
    expect(missing.error?.issues[0]?.path).toEqual(["bankAccount"]);
    expect(missing.error?.issues[0]?.message).toMatch(/Refresh this page/);
    expect(
      validators.nurseVerificationSchema.safeParse({ ...base, bankAccount: bank })
        .success,
    ).toBe(true);
    expect(
      validators.nurseVerificationSchema.safeParse({
        ...base,
        bankAccount: { ...bank, accountNumber: "" },
      }).success,
    ).toBe(false);
  });

  it("requires a license, photo, specialty and bank account on the verification form", () => {
    const base = {
      licenseNumber: "PNC-12345",
      cnic: "35202-1234567-1",
      qualification: "BSN",
      experienceYears: 3,
      specialties: [shared.NURSING_SPECIALTIES[0] as string],
      avatarUrl: "/api/v1/nurse/avatar/x.webp",
      serviceArea: { city: "Lahore", area: "DHA", homeVisitEnabled: false },
      documentUrls: { licenseCertificate: "a", cnicFront: "b", cnicBack: "c" },
      bankAccount: bank,
      acceptedProviderAgreement: true,
    };
    expect(validators.nurseVerificationSchema.safeParse(base).success).toBe(true);
    for (const missing of ["licenseNumber", "avatarUrl", "bankAccount"] as const) {
      const input: Record<string, unknown> = { ...base };
      delete input[missing];
      expect(validators.nurseVerificationSchema.safeParse(input).success).toBe(false);
    }
    expect(
      validators.nurseVerificationSchema.safeParse({ ...base, specialties: [] }).success,
    ).toBe(false);
    expect(
      validators.nurseVerificationSchema.safeParse({
        ...base,
        documentUrls: { cnicFront: "b", cnicBack: "c" },
      }).success,
    ).toBe(false);
  });

  it("credits 70% of completed visits only", async () => {
    const row = await createNurse();
    await createVisit(row.userId, shared.HomeVisitStatuses.COMPLETED, 2800);
    await createVisit(row.userId, shared.HomeVisitStatuses.COMPLETED, 3500);
    await createVisit(row.userId, shared.HomeVisitStatuses.ASSIGNED, 2800);
    await createVisit(row.userId, shared.HomeVisitStatuses.CANCELLED, 2800);

    const earnings = await finance.getNurseEarnings(row.userId);
    expect(earnings.nursePercent).toBe(70);
    expect(earnings.platformPercent).toBe(30);
    expect(earnings.completedVisits).toBe(2);
    expect(earnings.totalEarnings).toBe(1960 + 2450);
    expect(earnings.earningsThisMonth).toBe(1960 + 2450);
    expect(earnings.availableBalance).toBe(4410);
    expect(earnings.transactions.map((t) => t.platformFee).sort()).toEqual([1050, 840]);
  });

  it("stores the bank account encrypted and reads it back", async () => {
    const row = await createNurse();
    expect(await finance.getOwnNurseBankAccount(row.userId)).toBeNull();

    await finance.updateOwnNurseBankAccount(row.userId, bank);
    expect(await finance.getOwnNurseBankAccount(row.userId)).toEqual({
      ...bank,
      iban: undefined,
    });

    const raw = await db.StaffProfileModel.collection.findOne({ userId: new mongooseMod.Types.ObjectId(row.userId) });
    expect(JSON.stringify(raw?.bankAccount)).not.toContain(bank.accountNumber);
  });

  it("records a Sunday payout for the full balance and clears it", async () => {
    const row = await createNurse();
    await createVisit(row.userId, shared.HomeVisitStatuses.COMPLETED, 2800);

    // No bank account yet → refused before any receipt is stored.
    await expect(
      finance.recordNursePayout(adminId, row.id, {
        amount: 1960,
        method: "bank_transfer",
        receiptFile: receipt(),
      }),
    ).rejects.toMatchObject({ statusCode: 400 });

    await finance.updateOwnNurseBankAccount(row.userId, bank);

    // Partial payouts are refused.
    await expect(
      finance.recordNursePayout(adminId, row.id, {
        amount: 1000,
        method: "bank_transfer",
        receiptFile: receipt(),
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(savePayoutReceipt).not.toHaveBeenCalled();

    const payout = await finance.recordNursePayout(adminId, row.id, {
      amount: 1960,
      method: "bank_transfer",
      note: "Sunday transfer",
      receiptFile: receipt(),
    });
    expect(payout.amount).toBe(1960);
    expect(payout.receiptUrl).toBe(
      `/api/v1/admin/nurses/${row.id}/finance/payouts/${payout.id}/receipt`,
    );
    expect(savePayoutReceipt).toHaveBeenCalledTimes(1);

    const after = await finance.getAdminNurseFinance(row.id);
    expect(after.availableBalance).toBe(0);
    expect(after.totalPaidOut).toBe(1960);
    expect(after.payouts).toHaveLength(1);
    expect(after.bankAccount?.accountNumber).toBe(bank.accountNumber);

    const own = await finance.getNurseEarnings(row.userId);
    expect(own.availableBalance).toBe(0);
    expect(own.payouts[0]?.receiptUrl).toBe(payout.receiptUrl);

    // Receipt lookup is scoped to the owning nurse.
    await expect(finance.getNursePayoutReceipt(row.id, payout.id)).resolves.toMatchObject({
      storageKey: expect.stringContaining(payout.id),
    });
    const other = await createNurse();
    await expect(
      finance.getNursePayoutReceipt(other.id, payout.id),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(await finance.isOwnNurseProfile(row.id, row.userId)).toBe(true);
    expect(await finance.isOwnNurseProfile(row.id, other.userId)).toBe(false);

    // Nothing left to pay.
    await expect(
      finance.recordNursePayout(adminId, row.id, {
        amount: 1960,
        method: "bank_transfer",
        receiptFile: receipt(),
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("keeps nurse payouts out of doctor payout lookups", async () => {
    const row = await createNurse();
    await createVisit(row.userId, shared.HomeVisitStatuses.COMPLETED, 2800);
    await finance.updateOwnNurseBankAccount(row.userId, bank);
    await finance.recordNursePayout(adminId, row.id, {
      amount: 1960,
      method: "bank_transfer",
      receiptFile: receipt(),
    });

    const ledger = await db.DoctorPayoutModel.find({}).lean();
    expect(ledger).toHaveLength(1);
    expect(ledger[0]?.providerRole).toBe("nurse");
    expect(ledger[0]?.providerProfileId?.toString()).toBe(row.id);
    expect(
      await db.DoctorPayoutModel.countDocuments({ providerRole: "doctor" }),
    ).toBe(0);
  });
});
