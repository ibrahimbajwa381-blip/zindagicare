/**
 * Manager role grants — real local MongoDB (mongodb-memory-server) with the
 * REAL @zindagi/database models. Admins and super admins have the same powers here.
 */
import { MongoMemoryServer } from "mongodb-memory-server";
import { randomBytes } from "crypto";
import { Roles, type Role } from "@zindagi/shared";

jest.setTimeout(60000);

describe("Manager access grants (real local MongoDB)", () => {
  let mongod: InstanceType<typeof MongoMemoryServer>;
  let mongooseMod: typeof import("mongoose");
  let db: typeof import("@zindagi/database");
  let adminUsers: typeof import("@/server/services/admin-users.service");

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongod.getUri("manager_access_test");
    process.env.FIELD_ENCRYPTION_KEY = randomBytes(32).toString("base64");

    db = await import("@zindagi/database");
    mongooseMod = (await import("mongoose")).default;
    await db.connectDatabase();
    await db.UserModel.init();
    adminUsers = await import("@/server/services/admin-users.service");
  });

  afterAll(async () => {
    await mongooseMod.disconnect();
    await mongod.stop();
  });

  beforeEach(async () => {
    await db.UserModel.collection.deleteMany({});
  });

  async function user(name: string, roles: Role[]) {
    return (await db.UserModel.create({ name, roles }))._id.toString();
  }

  async function rolesOf(id: string) {
    return (await db.UserModel.findById(id).lean())?.roles;
  }

  test.each([Roles.ADMIN, Roles.SUPER_ADMIN])("%s can grant and remove manager access", async (role) => {
    const actor = await user("Actor", [role]);
    const target = await user("Ops", [Roles.PATIENT]);

    const row = await adminUsers.grantAdminAccess(actor, { userId: target, role: "manager" });
    expect(row.isManager).toBe(true);
    expect(await rolesOf(target)).toEqual([Roles.PATIENT, Roles.MANAGER]);
    expect((await adminUsers.listAdmins()).map((a) => a.id)).toContain(target);

    await adminUsers.revokeAdminAccess(actor, target);
    expect(await rolesOf(target)).toEqual([Roles.PATIENT]);
  });

  test("a plain admin can remove a super admin (same powers)", async () => {
    const admin = await user("Admin", [Roles.ADMIN]);
    const owner = await user("Owner", [Roles.SUPER_ADMIN]);

    await adminUsers.revokeAdminAccess(admin, owner);
    expect(await rolesOf(owner)).toEqual([Roles.PATIENT]);
  });

  test("a manager cannot grant anyone access", async () => {
    const manager = await user("Ops", [Roles.MANAGER]);
    const target = await user("Other", [Roles.PATIENT]);
    await expect(
      adminUsers.grantAdminAccess(manager, { userId: target, role: "admin" }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  test("promoting a manager to admin replaces the manager role", async () => {
    const owner = await user("Owner", [Roles.SUPER_ADMIN]);
    const target = await user("Ops", [Roles.MANAGER]);

    await adminUsers.grantAdminAccess(owner, { userId: target, role: "admin" });
    expect(await rolesOf(target)).toEqual([Roles.ADMIN]);
  });

  test("granting manager twice is a conflict", async () => {
    const owner = await user("Owner", [Roles.SUPER_ADMIN]);
    const target = await user("Ops", [Roles.MANAGER]);
    await expect(
      adminUsers.grantAdminAccess(owner, { userId: target, role: "manager" }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });
});
