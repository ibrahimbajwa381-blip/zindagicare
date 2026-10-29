/**
 * One role per account — real local MongoDB (mongodb-memory-server) with the
 * REAL @zindagi/database models. Legacy accounts are inserted through the raw
 * collection to bypass the model validator, as old production data would be.
 */
import { MongoMemoryServer } from "mongodb-memory-server";
import { randomBytes } from "crypto";
import type { Types } from "mongoose";
import { Roles } from "@zindagi/shared";

jest.setTimeout(60000);

describe("Account roles (real local MongoDB)", () => {
  let mongod: InstanceType<typeof MongoMemoryServer>;
  let mongooseMod: typeof import("mongoose");
  let db: typeof import("@zindagi/database");
  let svc: typeof import("@/server/services/account-roles.service");
  let adminUsers: typeof import("@/server/services/admin-users.service");
  let counter = 0;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongod.getUri("account_roles_test");
    process.env.FIELD_ENCRYPTION_KEY = randomBytes(32).toString("base64");

    db = await import("@zindagi/database");
    mongooseMod = (await import("mongoose")).default;
    await db.connectDatabase();
    await db.UserModel.init();

    svc = await import("@/server/services/account-roles.service");
    adminUsers = await import("@/server/services/admin-users.service");
  });

  afterAll(async () => {
    await mongooseMod.disconnect();
    await mongod.stop();
  });

  beforeEach(async () => {
    await Promise.all(
      [
        db.UserModel,
        db.DoctorProfileModel,
        db.StaffProfileModel,
        db.HerbalistProfileModel,
        db.NutritionistProfileModel,
        db.AppointmentModel,
      ].map((model) => model.collection.deleteMany({})),
    );
  });

  /** Insert straight into the collection, skipping validation, like legacy data. */
  async function insertLegacyUser(roles: string[] | undefined): Promise<Types.ObjectId> {
    const _id = new mongooseMod.Types.ObjectId();
    await db.UserModel.collection.insertOne({
      _id,
      name: `Legacy ${counter++}`,
      ...(roles ? { roles } : {}),
    });
    return _id;
  }

  async function insertProfile(
    model: { collection: { insertOne(doc: object): Promise<unknown> } },
    userId: Types.ObjectId,
    extra: Record<string, unknown> = {},
  ) {
    await model.collection.insertOne({ userId, ...extra });
  }

  async function rolesOf(userId: Types.ObjectId) {
    const user = await db.UserModel.collection.findOne({ _id: userId });
    return user?.roles;
  }

  describe("model validator", () => {
    test.each([
      [[Roles.DOCTOR, Roles.PATIENT]],
      [[Roles.DOCTOR, Roles.NURSE]],
      [[]],
    ])("rejects creating an account with %j", async (roles) => {
      await expect(
        db.UserModel.create({ name: "Invalid", roles }),
      ).rejects.toThrow(/role/);
    });

    test.each([
      [[Roles.PATIENT]],
      [[Roles.DOCTOR]],
      [[Roles.PATIENT, Roles.LAB]],
      [[Roles.DOCTOR, Roles.ADMIN]],
    ])("accepts creating an account with %j", async (roles) => {
      const user = await db.UserModel.create({ name: "Valid", roles });
      expect(user.roles).toEqual(roles);
    });

    test("defaults a new account to patient", async () => {
      const user = await db.UserModel.create({ name: "Default" });
      expect(user.roles).toEqual([Roles.PATIENT]);
    });

    test("rejects adding a patient role to a doctor on save", async () => {
      const user = await db.UserModel.create({ name: "Doc", roles: [Roles.DOCTOR] });
      user.roles = [...user.roles, Roles.PATIENT];
      await expect(user.save()).rejects.toThrow(/cannot also be a patient/);
    });

    test("a legacy dual-role account can still save unrelated changes", async () => {
      const id = await insertLegacyUser([Roles.DOCTOR, Roles.PATIENT]);
      const user = await db.UserModel.findById(id);
      user!.avatarUrl = "https://example.test/a.png";
      await expect(user!.save()).resolves.toBeDefined();
    });
  });

  describe("planAccountRoleFixes / applyAccountRoleFixes", () => {
    test("plans each legacy case, then applies and leaves nothing to fix", async () => {
      const doctorWithProfile = await insertLegacyUser([Roles.DOCTOR, Roles.PATIENT]);
      await insertProfile(db.DoctorProfileModel, doctorWithProfile);
      await db.AppointmentModel.collection.insertOne({ patientId: doctorWithProfile });

      const doctorNoProfile = await insertLegacyUser([Roles.PATIENT, Roles.DOCTOR]);

      const deletedProfileAdmin = await insertLegacyUser([Roles.DOCTOR, Roles.PATIENT, Roles.ADMIN]);
      await insertProfile(db.DoctorProfileModel, deletedProfileAdmin, { deletedAt: new Date() });

      const nurse = await insertLegacyUser([Roles.NURSE, Roles.PATIENT]);
      await insertProfile(db.StaffProfileModel, nurse, { staffType: Roles.NURSE });

      const herbalist = await insertLegacyUser([Roles.HERBALIST, Roles.PATIENT]);
      await insertProfile(db.HerbalistProfileModel, herbalist);

      const nutritionist = await insertLegacyUser([Roles.NUTRITIONIST, Roles.PATIENT]);
      await insertProfile(db.NutritionistProfileModel, nutritionist);

      const twoLiveProfiles = await insertLegacyUser([Roles.DOCTOR, Roles.PHYSIOTHERAPIST]);
      await insertProfile(db.DoctorProfileModel, twoLiveProfiles);
      await insertProfile(db.StaffProfileModel, twoLiveProfiles, {
        staffType: Roles.PHYSIOTHERAPIST,
      });

      const noRoles = await insertLegacyUser([]);
      const missingRoles = await insertLegacyUser(undefined);

      const validPatient = await insertLegacyUser([Roles.PATIENT]);
      const validDoctor = await insertLegacyUser([Roles.DOCTOR]);

      const plan = await svc.planAccountRoleFixes();
      const after = new Map(plan.fixes.map((fix) => [fix.userId, fix.after]));

      expect(after.get(doctorWithProfile.toString())).toEqual([Roles.DOCTOR]);
      expect(after.get(doctorNoProfile.toString())).toEqual([Roles.PATIENT]);
      expect(after.get(deletedProfileAdmin.toString())).toEqual([Roles.PATIENT, Roles.ADMIN]);
      expect(after.get(nurse.toString())).toEqual([Roles.NURSE]);
      expect(after.get(herbalist.toString())).toEqual([Roles.HERBALIST]);
      expect(after.get(nutritionist.toString())).toEqual([Roles.NUTRITIONIST]);
      expect(after.get(noRoles.toString())).toEqual([Roles.PATIENT]);
      expect(after.get(missingRoles.toString())).toEqual([Roles.PATIENT]);
      expect(after.has(validPatient.toString())).toBe(false);
      expect(after.has(validDoctor.toString())).toBe(false);

      expect(plan.conflicts.map((c) => c.userId)).toEqual([twoLiveProfiles.toString()]);
      expect(
        plan.fixes.find((fix) => fix.userId === doctorWithProfile.toString())
          ?.patientAppointments,
      ).toBe(1);

      // Dry run changed nothing.
      expect(await rolesOf(doctorWithProfile)).toEqual([Roles.DOCTOR, Roles.PATIENT]);

      const result = await svc.applyAccountRoleFixes(plan.fixes);
      expect(result.skipped).toEqual([]);
      expect(result.applied).toHaveLength(plan.fixes.length);

      expect(await rolesOf(doctorWithProfile)).toEqual([Roles.DOCTOR]);
      expect(await rolesOf(missingRoles)).toEqual([Roles.PATIENT]);
      expect(await rolesOf(twoLiveProfiles)).toEqual([Roles.DOCTOR, Roles.PHYSIOTHERAPIST]);

      const replan = await svc.planAccountRoleFixes();
      expect(replan.fixes).toEqual([]);
      expect(replan.conflicts).toHaveLength(1);
    });

    test("skips an account whose roles changed after planning", async () => {
      const id = await insertLegacyUser([Roles.DOCTOR, Roles.PATIENT]);

      const plan = await svc.planAccountRoleFixes();
      await db.UserModel.collection.updateOne(
        { _id: id },
        { $set: { roles: [Roles.NURSE, Roles.PATIENT] } },
      );

      const result = await svc.applyAccountRoleFixes(plan.fixes);
      expect(result).toEqual({ applied: [], skipped: [id.toString()] });
      expect(await rolesOf(id)).toEqual([Roles.NURSE, Roles.PATIENT]);
    });

    test("returns an empty plan when every account is valid", async () => {
      await insertLegacyUser([Roles.PATIENT]);
      await insertLegacyUser([Roles.DOCTOR, Roles.ADMIN]);
      expect(await svc.planAccountRoleFixes()).toEqual({ fixes: [], conflicts: [] });
    });
  });

  describe("revokeAdminAccess", () => {
    test("an admin-only account falls back to patient instead of no roles", async () => {
      const actor = await db.UserModel.create({ name: "Actor", roles: [Roles.SUPER_ADMIN] });
      const target = await db.UserModel.create({ name: "Target", roles: [Roles.ADMIN] });

      await adminUsers.revokeAdminAccess(actor._id.toString(), target._id.toString());

      expect(await rolesOf(target._id)).toEqual([Roles.PATIENT]);
    });
  });
});
