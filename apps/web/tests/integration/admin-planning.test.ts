/**
 * Admin Planning board — real local MongoDB (mongodb-memory-server) + REAL
 * route handlers, mobile-JWT auth and admin-planning.service. Covers role
 * gating, validation, create/edit/delete and the live monthly numbers.
 */
import { MongoMemoryServer } from "mongodb-memory-server";
import { randomBytes } from "crypto";
import { currentMonthKey, type PlanningBoard } from "@/features/admin/lib/planning";

jest.setTimeout(60000);

// Web cookie auth stays signed out; every request here uses a Bearer token.
jest.mock("@/lib/auth", () => ({ auth: async () => null }));

describe("Admin planning API (real local MongoDB)", () => {
  let mongod: InstanceType<typeof MongoMemoryServer>;
  let mongooseMod: typeof import("mongoose");
  let db: typeof import("@zindagi/database");
  let Roles: typeof import("@zindagi/shared").Roles;
  let signMobileAccessToken: typeof import("@/server/api/mobile-jwt").signMobileAccessToken;
  let listRoute: typeof import("@/app/api/v1/admin/planning/route");
  let itemRoute: typeof import("@/app/api/v1/admin/planning/[id]/route");

  let counter = 0;
  let adminId: string;
  let patientId: string;

  async function createUser(roles: import("@zindagi/shared").Role[], city = "Lahore") {
    counter += 1;
    return db.UserModel.create({
      name: "Planning Test User",
      email: `planning-${Date.now()}-${counter}@test.local`,
      phone: `+9230${(1000000 + counter).toString().padStart(8, "0")}`,
      roles,
      metadata: { city },
    });
  }

  async function request(
    userId: string | null,
    path: string,
    init: { method?: string; body?: unknown } = {},
  ) {
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (userId) headers.authorization = `Bearer ${await signMobileAccessToken(userId)}`;
    return new Request(`http://localhost/api/v1/admin/planning${path}`, {
      method: init.method ?? "GET",
      headers,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    }) as never;
  }

  const target = (overrides: Record<string, unknown> = {}) => ({
    kind: "target",
    title: "500 new patients in Lahore",
    city: "Lahore",
    month: currentMonthKey(),
    metric: "New patients",
    targetValue: 500,
    currentValue: 120,
    ...overrides,
  });

  async function createItem(body: unknown) {
    const res = await listRoute.POST(await request(adminId, "", { method: "POST", body }));
    const json = await res.json();
    expect(res.status).toBe(200);
    return json.data.id as string;
  }

  async function board(month?: string) {
    const res = await listRoute.GET(await request(adminId, month ? `?month=${month}` : ""));
    expect(res.status).toBe(200);
    return (await res.json()).data as PlanningBoard;
  }

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongod.getUri("admin_planning_test");
    process.env.FIELD_ENCRYPTION_KEY = randomBytes(32).toString("base64");
    process.env.AUTH_SECRET = "test-secret-at-least-32-chars-long-12345";

    db = await import("@zindagi/database");
    Roles = (await import("@zindagi/shared")).Roles;
    mongooseMod = (await import("mongoose")).default;
    await db.connectDatabase();

    ({ signMobileAccessToken } = await import("@/server/api/mobile-jwt"));
    listRoute = await import("@/app/api/v1/admin/planning/route");
    itemRoute = await import("@/app/api/v1/admin/planning/[id]/route");
  });

  afterAll(async () => {
    await mongooseMod.disconnect();
    await mongod.stop();
  });

  beforeEach(async () => {
    await Promise.all([db.UserModel.deleteMany({}), db.PlanningItemModel.deleteMany({})]);
    adminId = (await createUser([Roles.ADMIN])).id;
    patientId = (await createUser([Roles.PATIENT], "Faisalabad")).id;
  });

  describe("access", () => {
    test("unauthenticated requests get 401", async () => {
      const res = await listRoute.GET(await request(null, ""));
      expect(res.status).toBe(401);
    });

    test("non-admins cannot read, create, edit or delete", async () => {
      const id = await createItem(target());

      expect((await listRoute.GET(await request(patientId, ""))).status).toBe(403);
      expect(
        (await listRoute.POST(await request(patientId, "", { method: "POST", body: target() })))
          .status,
      ).toBe(403);
      expect(
        (await itemRoute.PATCH(await request(patientId, `/${id}`, { method: "PATCH", body: target() })))
          .status,
      ).toBe(403);
      expect((await itemRoute.DELETE(await request(patientId, `/${id}`, { method: "DELETE" }))).status).toBe(403);

      const stored = await db.PlanningItemModel.findById(id).lean();
      expect(stored?.deletedAt).toBeUndefined();
      expect(stored?.title).toBe("500 new patients in Lahore");
    });
  });

  describe("validation", () => {
    test.each([
      ["a target with no target number", target({ targetValue: undefined })],
      ["a target with no month", target({ month: undefined })],
      ["an invalid month", target({ month: "2026-13" })],
      ["an unknown kind", { kind: "budget", title: "Something" }],
      ["a one-letter title", { kind: "plan", title: "x" }],
      ["a due date before the start", { kind: "plan", title: "Launch", startDate: "2026-05-10", dueDate: "2026-05-01" }],
    ])("rejects %s with 400", async (_label, body) => {
      const res = await listRoute.POST(await request(adminId, "", { method: "POST", body }));
      expect(res.status).toBe(400);
      expect(await db.PlanningItemModel.countDocuments()).toBe(0);
    });

    test("rejects a malformed ?month on the board", async () => {
      const res = await listRoute.GET(await request(adminId, "?month=june"));
      expect(res.status).toBe(400);
    });
  });

  describe("create, edit, delete", () => {
    test("creates a partnership and lists it with its details", async () => {
      await createItem({
        kind: "partnership",
        title: "Services Hospital",
        city: "Lahore",
        partnerType: "hospital",
        stage: "negotiating",
        contactName: "Dr. Contact",
      });

      const { items } = await board();
      expect(items).toHaveLength(1);
      expect(items[0]).toMatchObject({
        kind: "partnership",
        title: "Services Hospital",
        partnerType: "hospital",
        stage: "negotiating",
        status: "planned",
        priority: "medium",
        createdByName: "Planning Test User",
      });
    });

    test("an edit replaces the entry and clears optional fields left out", async () => {
      const id = await createItem(target());

      const res = await itemRoute.PATCH(
        await request(adminId, `/${id}`, {
          method: "PATCH",
          body: target({ city: undefined, currentValue: 510, status: "done" }),
        }),
      );
      expect(res.status).toBe(200);

      const [item] = (await board()).items;
      expect(item).toMatchObject({ currentValue: 510, status: "done", targetValue: 500 });
      expect(item!.city).toBeUndefined();
    });

    test("dates round-trip as the same Pakistan calendar day", async () => {
      await createItem({ kind: "achievement", title: "First hospital signed", achievedAt: "2026-03-01" });
      expect((await board()).items[0]!.achievedAt).toBe("2026-03-01");
    });

    test("delete hides the entry; editing or deleting it again is 404", async () => {
      const id = await createItem({ kind: "challenge", title: "Low doctor response rate" });

      expect((await itemRoute.DELETE(await request(adminId, `/${id}`, { method: "DELETE" }))).status).toBe(200);
      expect((await board()).items).toHaveLength(0);
      expect(await db.PlanningItemModel.countDocuments()).toBe(1); // soft delete

      expect((await itemRoute.DELETE(await request(adminId, `/${id}`, { method: "DELETE" }))).status).toBe(404);
      expect(
        (await itemRoute.PATCH(
          await request(adminId, `/${id}`, { method: "PATCH", body: { kind: "challenge", title: "Again" } }),
        )).status,
      ).toBe(404);
    });

    test("an invalid id is 404, not 500", async () => {
      const res = await itemRoute.DELETE(await request(adminId, "/not-an-id", { method: "DELETE" }));
      expect(res.status).toBe(404);
    });
  });

  describe("live numbers", () => {
    test("counts this month's sign-ups by city and ignores other months", async () => {
      await createUser([Roles.PATIENT], "Lahore");
      await createUser([Roles.DOCTOR], "Lahore");
      const old = await createUser([Roles.PATIENT], "Lahore");
      await db.UserModel.collection.updateOne(
        { _id: old._id },
        { $set: { createdAt: new Date("2020-01-15T00:00:00Z") } },
      );

      const { live } = await board();
      // beforeEach: one admin (not counted) + one Faisalabad patient.
      expect(live.newPatients).toBe(2);
      expect(live.newProviders).toBe(1);
      expect(live.byCity).toEqual(
        expect.arrayContaining([
          { city: "Lahore", newPatients: 1, newProviders: 1 },
          { city: "Faisalabad", newPatients: 1, newProviders: 0 },
        ]),
      );

      const past = await board("2020-01");
      expect(past.live.newPatients).toBe(1);
    });
  });
});
