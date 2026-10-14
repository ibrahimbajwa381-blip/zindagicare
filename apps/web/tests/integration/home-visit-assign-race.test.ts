/**
 * Provider double-booking under concurrency (real local MongoDB via
 * mongodb-memory-server). Notification delivery is stubbed: these tests are
 * about assignment correctness, and the real senders call external services.
 *
 * Before the fix, assignment wrote first and then let the lowest visit id
 * win among current holders — a later-arriving lower id could win alongside
 * an earlier winner that never saw it, so one nurse got two visits.
 */
import { MongoMemoryServer } from "mongodb-memory-server";
import { randomBytes } from "crypto";

jest.mock("@/lib/notifications/home-visit-notifications", () => ({
  notifyAdminsHomeVisitRequested: jest.fn(async () => {}),
  notifyPatientHomeVisitPaymentConfirmed: jest.fn(async () => {}),
  notifyPatientHomeVisitStatus: jest.fn(async () => {}),
  notifyStaffHomeVisitAssigned: jest.fn(async () => {}),
}));

// push.service loads web-push at module scope, which under Jest triggers the
// repo's known Next.js "AsyncLocalStorage accessed in runtime" harness issue
// (see authz-idor.test.ts / bugs.txt). Stubbed the same way as there.
jest.mock("@/server/services/push.service", () => ({
  sendExpoPushToUser: jest.fn(),
  sendWebPushToUser: jest.fn(),
}));

jest.setTimeout(120000);

describe("home-visit provider assignment under concurrency", () => {
  let mongod: InstanceType<typeof MongoMemoryServer>;
  let db: typeof import("@zindagi/database");
  let shared: typeof import("@zindagi/shared");
  let mongooseMod: typeof import("mongoose");
  let HomeVisitService: typeof import("@/server/services/home-visit.service").HomeVisitService;
  let withLeaseLock: typeof import("@/server/lib/mongo-lease-lock").withLeaseLock;
  let counter = 0;

  const HOUR = 60 * 60 * 1000;
  const WINDOW_MS = 2 * HOUR; // HOME_VISIT_CONFLICT_WINDOW_MS

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongod.getUri("home_visit_assign_race");
    process.env.FIELD_ENCRYPTION_KEY = randomBytes(32).toString("base64");
    db = await import("@zindagi/database");
    shared = await import("@zindagi/shared");
    mongooseMod = (await import("mongoose")).default;
    await db.connectDatabase();
    await db.HomeVisitModel.init();
    await db.PaymentModel.init();
    ({ HomeVisitService } = await import("@/server/services/home-visit.service"));
    ({ withLeaseLock } = await import("@/server/lib/mongo-lease-lock"));
  });

  afterAll(async () => {
    await mongooseMod.disconnect();
    await mongod.stop();
  });

  // "Nearest available" searches all staff, so isolate each test's fixtures.
  beforeEach(async () => {
    await Promise.all([
      db.UserModel.deleteMany({}),
      db.StaffProfileModel.deleteMany({}),
      db.HomeVisitModel.deleteMany({}),
      db.PaymentModel.deleteMany({}),
      mongooseMod.connection.collection("lease_locks").deleteMany({}),
    ]);
  });

  async function createNurse(lng = 74.3587, lat = 31.5204) {
    counter += 1;
    const user = await db.UserModel.create({
      name: `Race Nurse ${counter}`,
      email: `race-nurse-${counter}-${Date.now()}@example.com`,
      phone: `+9231${counter.toString().padStart(8, "0")}`,
      roles: [shared.Roles.NURSE],
      isActive: true,
    });
    await db.StaffProfileModel.create({
      userId: user._id,
      staffType: shared.Roles.NURSE,
      homeVisitEnabled: true,
      isAvailable: true,
      verificationStatus: "approved",
      serviceAreas: [{ city: "Lahore", area: "DHA", geo: { type: "Point", coordinates: [lng, lat] }, radiusKm: 15 }],
    });
    return user._id.toString();
  }

  async function requestVisit(scheduledAt: Date) {
    counter += 1;
    const patient = await db.UserModel.create({
      name: `Race Patient ${counter}`,
      email: `race-patient-${counter}-${Date.now()}@example.com`,
      phone: `+9238${counter.toString().padStart(8, "0")}`,
      roles: ["patient"],
      isActive: true,
    });
    return HomeVisitService.createRequest(patient._id.toString(), {
      serviceType: shared.HomeVisitServiceTypes.NURSE,
      scheduledAt: scheduledAt.toISOString(),
      addressLine: "House 12, Street 5, DHA Phase 5",
      city: "Lahore",
      geo: { lng: 74.3587, lat: 31.5204 },
      autoAssign: false,
    } as never);
  }

  const inFuture = (hours: number) => new Date(Date.now() + 24 * HOUR + hours * HOUR);

  async function assignedTo(nurseId: string) {
    return db.HomeVisitModel.countDocuments({
      assignedStaffId: nurseId,
      status: shared.HomeVisitStatuses.ASSIGNED,
    });
  }

  function expectCleanConflicts(results: PromiseSettledResult<unknown>[]) {
    for (const r of results) {
      if (r.status === "rejected") expect(r.reason).toMatchObject({ statusCode: 409 });
    }
  }

  test.each([1, 2, 3, 4, 5])(
    "round %i: 10 simultaneous auto-assignments for one nurse and one slot -> exactly one booking",
    async () => {
      const nurseId = await createNurse();
      const slot = inFuture(1);
      const visits = [];
      for (let i = 0; i < 10; i++) visits.push(await requestVisit(slot));

      const results = await Promise.allSettled(visits.map((v) => HomeVisitService.autoAssignStaff(v.id)));

      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      expectCleanConflicts(results);
      expect(await assignedTo(nurseId)).toBe(1);
      const requested = await db.HomeVisitModel.countDocuments({ status: shared.HomeVisitStatuses.REQUESTED });
      expect(requested).toBe(9); // losers are left assignable, not stuck
    },
  );

  test("10 simultaneous manual (admin) assignments of one nurse to overlapping visits -> exactly one booking", async () => {
    const nurseId = await createNurse();
    const slot = inFuture(2);
    const visits = [];
    for (let i = 0; i < 10; i++) visits.push(await requestVisit(new Date(slot.getTime() + i * 60_000)));

    const results = await Promise.allSettled(
      visits.map((v) => HomeVisitService.assignStaff(v.id, { staffId: nurseId } as never)),
    );

    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expectCleanConflicts(results);
    expect(await assignedTo(nurseId)).toBe(1);
  });

  test("deterministic interleaving that double-booked before the fix: lower-id visit's write lands last", async () => {
    // The old rule wrote first, then let the lowest visit id among current
    // holders win. Hold back the lower-id visit's write so the higher-id visit
    // writes, sees only itself and wins; the lower-id visit then writes, sees
    // both, is the lowest id, and "wins" too -> one nurse, two visits.
    const nurseId = await createNurse();
    const slot = inFuture(6);
    const low = await requestVisit(slot);
    const high = await requestVisit(slot);
    expect(low.id < high.id).toBe(true);

    const original = db.HomeVisitModel.findOneAndUpdate.bind(db.HomeVisitModel);
    const spy = jest.spyOn(db.HomeVisitModel, "findOneAndUpdate").mockImplementation(((filter: { _id?: unknown }, ...rest: unknown[]) => {
      const query = (original as (...a: unknown[]) => { then: unknown })(filter, ...rest);
      if (String(filter?._id) !== low.id) return query;
      // Delay only the assignment write for the lower-id visit.
      return { then: (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => new Promise((r) => setTimeout(r, 300)).then(() => query).then(res, rej) };
    }) as never);
    try {
      const results = await Promise.allSettled([
        HomeVisitService.assignStaff(low.id, { staffId: nurseId } as never),
        HomeVisitService.assignStaff(high.id, { staffId: nurseId } as never),
      ]);
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      expectCleanConflicts(results);
    } finally {
      spy.mockRestore();
    }
    expect(await assignedTo(nurseId)).toBe(1);
  });

  test("mixed burst: auto and manual assignment racing for the same nurse -> exactly one booking", async () => {
    const nurseId = await createNurse();
    const slot = inFuture(3);
    const visits = [];
    for (let i = 0; i < 8; i++) visits.push(await requestVisit(slot));

    const results = await Promise.allSettled(
      visits.map((v, i) =>
        i % 2 ? HomeVisitService.autoAssignStaff(v.id) : HomeVisitService.assignStaff(v.id, { staffId: nurseId } as never),
      ),
    );

    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await assignedTo(nurseId)).toBe(1);
  });

  test("non-overlapping visits for the same nurse all succeed concurrently (the lock serializes, it doesn't over-block)", async () => {
    const nurseId = await createNurse();
    const visits = [];
    for (let i = 0; i < 5; i++) visits.push(await requestVisit(inFuture(10 + i * 5)));

    const results = await Promise.allSettled(
      visits.map((v) => HomeVisitService.assignStaff(v.id, { staffId: nurseId } as never)),
    );

    expect(results.every((r) => r.status === "fulfilled")).toBe(true);
    expect(await assignedTo(nurseId)).toBe(5);
  });

  test("different nurses are assigned in parallel without blocking each other", async () => {
    const nurseA = await createNurse();
    const nurseB = await createNurse();
    const slot = inFuture(4);
    const [v1, v2] = [await requestVisit(slot), await requestVisit(slot)];

    const results = await Promise.allSettled([
      HomeVisitService.assignStaff(v1.id, { staffId: nurseA } as never),
      HomeVisitService.assignStaff(v2.id, { staffId: nurseB } as never),
    ]);

    expect(results.every((r) => r.status === "fulfilled")).toBe(true);
    expect([await assignedTo(nurseA), await assignedTo(nurseB)]).toEqual([1, 1]);
  });

  describe("boundary: the ±2h conflict window", () => {
    test.each([
      ["exactly 2h later", WINDOW_MS, false],
      ["2h + 1 minute later", WINDOW_MS + 60_000, true],
      ["exactly 2h earlier", -WINDOW_MS, false],
      ["2h + 1 minute earlier", -WINDOW_MS - 60_000, true],
    ])("second visit %s -> allowed: %s", async (_label, offsetMs, allowed) => {
      const nurseId = await createNurse();
      const first = inFuture(30);
      const v1 = await requestVisit(first);
      const v2 = await requestVisit(new Date(first.getTime() + (offsetMs as number)));
      await HomeVisitService.assignStaff(v1.id, { staffId: nurseId } as never);

      const second = HomeVisitService.assignStaff(v2.id, { staffId: nurseId } as never);
      if (allowed) await expect(second).resolves.toBeTruthy();
      else await expect(second).rejects.toMatchObject({ statusCode: 409 });
    });
  });

  test("reassigning a visit to the nurse it already has is not a conflict with itself", async () => {
    const nurseId = await createNurse();
    const v = await requestVisit(inFuture(40));
    await HomeVisitService.assignStaff(v.id, { staffId: nurseId } as never);
    await expect(HomeVisitService.assignStaff(v.id, { staffId: nurseId } as never)).resolves.toBeTruthy();
    expect(await assignedTo(nurseId)).toBe(1);
  });

  test("the provider lock is released after every assignment, success or conflict", async () => {
    const nurseId = await createNurse();
    const slot = inFuture(50);
    const visits = [await requestVisit(slot), await requestVisit(slot)];
    await HomeVisitService.assignStaff(visits[0]!.id, { staffId: nurseId } as never);
    await expect(HomeVisitService.assignStaff(visits[1]!.id, { staffId: nurseId } as never)).rejects.toMatchObject({
      statusCode: 409,
    });
    expect(await mongooseMod.connection.collection("lease_locks").countDocuments()).toBe(0);
  });

  describe("lease lock", () => {
    const locks = () => mongooseMod.connection.collection<{ _id: string; owner: string; expiresAt: Date }>("lease_locks");

    test("mutual exclusion: concurrent holders never overlap", async () => {
      let inside = 0;
      let maxInside = 0;
      await Promise.all(
        Array.from({ length: 20 }, () =>
          withLeaseLock("test:mutex", async () => {
            inside += 1;
            maxInside = Math.max(maxInside, inside);
            await new Promise((r) => setTimeout(r, 5));
            inside -= 1;
          }, { waitMs: 20_000 }),
        ),
      );
      expect(maxInside).toBe(1);
    });

    test("a live lease held elsewhere makes callers give up with 409 after waitMs, without running the task", async () => {
      await locks().insertOne({ _id: "test:busy", owner: "someone-else", expiresAt: new Date(Date.now() + 60_000) });
      const task = jest.fn(async () => "ran");
      const started = Date.now();
      await expect(withLeaseLock("test:busy", task, { waitMs: 150, busyMessage: "busy" })).rejects.toMatchObject({
        statusCode: 409,
        message: "busy",
      });
      expect(Date.now() - started).toBeGreaterThanOrEqual(150);
      expect(task).not.toHaveBeenCalled();
      expect((await locks().findOne({ _id: "test:busy" }))?.owner).toBe("someone-else");
    });

    test("an expired lease (crashed holder) is taken over", async () => {
      await locks().insertOne({ _id: "test:stale", owner: "crashed", expiresAt: new Date(Date.now() - 1000) });
      await expect(withLeaseLock("test:stale", async () => "ran", { waitMs: 0 })).resolves.toBe("ran");
    });

    test("the lock is released when the task throws, and the error propagates", async () => {
      await expect(
        withLeaseLock("test:throws", async () => {
          throw new Error("task failed");
        }),
      ).rejects.toThrow("task failed");
      expect(await locks().findOne({ _id: "test:throws" })).toBeNull();
      await expect(withLeaseLock("test:throws", async () => "again", { waitMs: 0 })).resolves.toBe("again");
    });

    test("a holder whose lease expired doesn't delete the next holder's lock on release", async () => {
      let releaseFirst!: () => void;
      const first = withLeaseLock(
        "test:overrun",
        () => new Promise<void>((r) => (releaseFirst = r)),
        { leaseMs: 50 },
      );
      await new Promise((r) => setTimeout(r, 120)); // first overruns its lease
      let secondRunning!: () => void;
      const secondEntered = new Promise<void>((r) => (secondRunning = r));
      let finishSecond!: () => void;
      const second = withLeaseLock("test:overrun", async () => {
        secondRunning();
        await new Promise<void>((r) => (finishSecond = r));
      }, { waitMs: 0, leaseMs: 60_000 });
      await secondEntered;

      releaseFirst();
      await first;
      const doc = await locks().findOne({ _id: "test:overrun" });
      expect(doc).not.toBeNull(); // second's lease survived first's release
      finishSecond();
      await second;
      expect(await locks().findOne({ _id: "test:overrun" })).toBeNull();
    });

    test("expiry uses the database clock: a lease set 'in the past' by a skewed app clock is still honoured", async () => {
      // Simulate an app server whose clock runs 10 minutes fast acquiring a lock:
      // the stored expiry comes from $$NOW, so another server isn't fooled.
      const realNow = Date.now;
      Date.now = () => realNow() + 10 * 60_000;
      let release!: () => void;
      const holder = withLeaseLock("test:skew", () => new Promise<void>((r) => (release = r)), { leaseMs: 60_000 });
      await new Promise((r) => setTimeout(r, 30));
      Date.now = realNow;
      await expect(withLeaseLock("test:skew", async () => "stolen", { waitMs: 100 })).rejects.toMatchObject({
        statusCode: 409,
      });
      release();
      await holder;
    });
  });
});
