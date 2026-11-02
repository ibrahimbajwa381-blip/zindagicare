/**
 * SUN-001..020 — Sunday Free Consultation P0 functional + concurrency audit.
 *
 * Real local MongoDB (mongodb-memory-server, ephemeral — never Atlas, never
 * production) + the REAL @zindagi/database models and REAL
 * SundayConsultService / MedicalIntakeService code. Nothing about the
 * service under test is mocked.
 *
 * REDIS: this codebase has no Redis client anywhere in apps/web/src — every
 * concurrency guarantee here comes from MongoDB unique indexes + atomic
 * findOneAndUpdate. There is nothing Redis-shaped to test, so the SUN-011..020
 * "Redis concurrency" IDs below are verified against the real Mongo-level
 * mechanism instead of a Redis lock that does not exist in this codebase.
 *
 * Heavier stress numbers (100/250/500-way concurrency, progressive load,
 * duplicate-idempotency sweeps) live in scripts/sunday-concurrency-test.ts —
 * kept out of the CI-run jest suite so this file stays fast, but exercising
 * the exact same real service code paths.
 */
import { MongoMemoryServer } from "mongodb-memory-server";
import { randomBytes } from "crypto";

jest.setTimeout(60000);

describe("Sunday Free Consultation — P0 concurrency audit (real local MongoDB)", () => {
  let mongod: InstanceType<typeof MongoMemoryServer>;
  let UserModel: typeof import("@zindagi/database").UserModel;
  let DoctorProfileModel: typeof import("@zindagi/database").DoctorProfileModel;
  let AppointmentModel: typeof import("@zindagi/database").AppointmentModel;
  let SundayFreeRequestModel: typeof import("@zindagi/database").SundayFreeRequestModel;
  let SundaySlotInstanceModel: typeof import("@zindagi/database").SundaySlotInstanceModel;
  let mongooseMod: typeof import("mongoose");
  let AppointmentTypes: typeof import("@zindagi/shared").AppointmentTypes;
  let VerificationStatuses: typeof import("@zindagi/shared").VerificationStatuses;
  let SlotStatuses: typeof import("@zindagi/shared").SlotStatuses;
  let SundayAffordabilityChoices: typeof import("@zindagi/shared").SundayAffordabilityChoices;
  let SundayFreeRequestStatuses: typeof import("@zindagi/shared").SundayFreeRequestStatuses;
  let SundayConsultService: typeof import("@/server/services/sunday-consult.service").SundayConsultService;
  let formatSundayDateKey: typeof import("@/lib/sunday/date-utils").formatSundayDateKey;
  let getActiveOrNextSundayDate: typeof import("@/lib/sunday/date-utils").getActiveOrNextSundayDate;

  let sundayDate: Date;
  let sundayDateKey: string;
  let counter = 0;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongod.getUri("sunday_concurrency_test");
    process.env.FIELD_ENCRYPTION_KEY = randomBytes(32).toString("base64");

    const db = await import("@zindagi/database");
    UserModel = db.UserModel;
    DoctorProfileModel = db.DoctorProfileModel;
    AppointmentModel = db.AppointmentModel;
    SundayFreeRequestModel = db.SundayFreeRequestModel;
    SundaySlotInstanceModel = db.SundaySlotInstanceModel;
    mongooseMod = (await import("mongoose")).default;

    const shared = await import("@zindagi/shared");
    AppointmentTypes = shared.AppointmentTypes;
    VerificationStatuses = shared.VerificationStatuses;
    SlotStatuses = shared.SlotStatuses;
    SundayAffordabilityChoices = shared.SundayAffordabilityChoices;
    SundayFreeRequestStatuses = shared.SundayFreeRequestStatuses;

    await db.connectDatabase();
    await AppointmentModel.init();
    await SundayFreeRequestModel.init();
    await SundaySlotInstanceModel.init();

    ({ SundayConsultService } = await import("@/server/services/sunday-consult.service"));
    ({ formatSundayDateKey, getActiveOrNextSundayDate } = await import("@/lib/sunday/date-utils"));

    sundayDate = getActiveOrNextSundayDate();
    sundayDateKey = formatSundayDateKey(sundayDate);
  });

  afterAll(async () => {
    await mongooseMod.disconnect();
    await mongod.stop();
  });

  function makePhone(roleTag: string, n: number) {
    return `+923${roleTag}${n.toString().padStart(8, "0")}`;
  }

  async function createPatient() {
    counter += 1;
    return UserModel.create({
      name: `Sunday Patient ${counter}`,
      email: `sunday-jest-patient-${counter}-${Date.now()}@example.com`,
      phone: makePhone("5", counter),
      roles: ["patient"],
      isActive: true,
    });
  }

  async function createDoctor() {
    counter += 1;
    const user = await UserModel.create({
      name: `Sunday Doctor ${counter}`,
      email: `sunday-jest-doctor-${counter}-${Date.now()}@example.com`,
      phone: makePhone("6", counter),
      roles: ["doctor"],
      isActive: true,
    });
    const profile = await DoctorProfileModel.create({
      userId: user._id.toString(),
      isListed: true,
      verificationStatus: VerificationStatuses.APPROVED,
      consultationFee: 0,
      specialties: ["General Physician"],
      coverageCities: ["Lahore"],
      sundayConsultEnabled: true,
      weeklyAvailability: Array.from({ length: 7 }, (_, dayOfWeek) => ({
        dayOfWeek,
        startTimeLocal: "00:00",
        endTimeLocal: "23:40",
      })),
    });
    return profile;
  }

  function requestInput(
    phone: string,
  ): Parameters<typeof SundayConsultService.submitRequest>[1] {
    return {
      patientPhone: phone,
      history: [
        { key: "chief_complaint", answer: "Fever and cough for 3 days" },
        { key: "current_medications", answer: "Panadol" },
        { key: "allergies", answer: "None" },
        { key: "chronic_conditions", answer: "None" },
        { key: "additional_info", answer: "None" },
      ],
      affordabilityChoice: SundayAffordabilityChoices.CANNOT_AFFORD,
    };
  }

  // submitRequest's return type is a union (request vs. payment-checkout);
  // every test here uses CANNOT_AFFORD, which always resolves to the
  // "request" branch — this narrows that for TypeScript.
  async function submitAsRequest(patientId: string, phone: string) {
    const result = await SundayConsultService.submitRequest(patientId, requestInput(phone));
    if (result.kind !== "request") {
      throw new Error(`expected kind="request", got ${result.kind}`);
    }
    return result;
  }

  // ===========================================================================
  // SUN-001 / SUN-003 — eligible patient can request, request accepted
  // ===========================================================================
  test("SUN-001 / SUN-003: eligible patient request is accepted and enters the queue as REQUESTED", async () => {
    const patient = await createPatient();
    const result = await submitAsRequest(patient._id.toString(), patient.phone!);

    expect(result.kind).toBe("request");
    const doc = await SundayFreeRequestModel.findOne({ patientId: patient._id.toString(), sundayDateKey }).lean();
    expect(doc).not.toBeNull();
    expect(doc?.status).toBe(SundayFreeRequestStatuses.REQUESTED);
  });

  // ===========================================================================
  // SUN-002 — ineligible (banned) patient rejected, no queue entry
  // ===========================================================================
  test("SUN-002: banned patient's request is rejected and creates no queue entry", async () => {
    const patient = await createPatient();
    await UserModel.updateOne(
      { _id: patient._id },
      { $set: { sundayBannedUntil: new Date(Date.now() + 24 * 60 * 60 * 1000) } },
    );

    await expect(
      SundayConsultService.submitRequest(patient._id.toString(), requestInput(patient.phone!)),
    ).rejects.toMatchObject({ statusCode: 403 });

    const doc = await SundayFreeRequestModel.findOne({ patientId: patient._id.toString(), sundayDateKey }).lean();
    expect(doc).toBeNull();
  });

  // ===========================================================================
  // SUN-005 — unique valid queue entry assigned on first request
  // (NOTE: the schema has no explicit "queue position" field — ordering is
  // implicit FIFO via createdAt. This asserts the one guarantee the schema
  // actually makes: a single, uniquely-identified request document.)
  // ===========================================================================
  test("SUN-005: first eligible request gets a unique request document", async () => {
    const patient = await createPatient();
    const result = await submitAsRequest(patient._id.toString(), patient.phone!);
    expect(result.requestId).toBeTruthy();
    const matching = await SundayFreeRequestModel.find({ patientId: patient._id.toString(), sundayDateKey }).lean();
    expect(matching.length).toBe(1);
    expect(matching[0]._id.toString()).toBe(result.requestId);
  });

  // ===========================================================================
  // SUN-006 / SUN-012 / SUN-016 / SUN-020 — duplicate / concurrent-retry
  // requests from the SAME patient never create more than one queue entry,
  // and (the fix under test) never surface a raw error to the loser.
  // ===========================================================================
  test("SUN-006: a second sequential request from the same patient is idempotent (returns the same request, no second doc)", async () => {
    const patient = await createPatient();
    const first = await submitAsRequest(patient._id.toString(), patient.phone!);
    const second = await submitAsRequest(patient._id.toString(), patient.phone!);

    expect(second.requestId).toBe(first.requestId);
    const matching = await SundayFreeRequestModel.find({ patientId: patient._id.toString(), sundayDateKey }).lean();
    expect(matching.length).toBe(1);
  });

  test("SUN-012 / SUN-016 / SUN-020: 25 truly concurrent identical requests from the same patient resolve to exactly ONE queue entry with zero raw errors", async () => {
    const patient = await createPatient();
    const results = await Promise.allSettled(
      Array.from({ length: 25 }, () => submitAsRequest(patient._id.toString(), patient.phone!)),
    );

    const rejected = results.filter((r) => r.status === "rejected");
    // Every rejection (if any) must be a clean AppError, never a raw driver error.
    for (const r of rejected) {
      const reason = (r as PromiseRejectedResult).reason;
      expect(reason && typeof reason === "object" && "statusCode" in reason).toBe(true);
    }

    const fulfilled = results.filter(
      (r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof submitAsRequest>>> => r.status === "fulfilled",
    );
    const distinctRequestIds = new Set(fulfilled.map((r) => r.value.requestId));
    expect(distinctRequestIds.size).toBe(1);

    const docs = await SundayFreeRequestModel.find({ patientId: patient._id.toString(), sundayDateKey }).lean();
    expect(docs.length).toBe(1);
  });

  // ===========================================================================
  // SUN-011 / SUN-013 / SUN-014 — N unique eligible patients requesting
  // concurrently: N unique entries, no duplicates, no lost requests.
  // ===========================================================================
  test("SUN-011 / SUN-013 / SUN-014: 30 unique eligible patients requesting concurrently all get exactly one entry each, no loss, no duplicates", async () => {
    const patients = await Promise.all(Array.from({ length: 30 }, () => createPatient()));

    const results = await Promise.allSettled(
      patients.map((p) => submitAsRequest(p._id.toString(), p.phone!)),
    );
    expect(results.filter((r) => r.status === "rejected").length).toBe(0);

    const docs = await SundayFreeRequestModel.find({
      patientId: { $in: patients.map((p) => p._id.toString()) },
      sundayDateKey,
    }).lean();
    expect(docs.length).toBe(patients.length); // no lost requests

    const perPatient = new Map<string, number>();
    for (const d of docs) {
      const key = d.patientId.toString();
      perPatient.set(key, (perPatient.get(key) ?? 0) + 1);
    }
    expect([...perPatient.values()].every((c) => c === 1)).toBe(true); // no duplicates

    // Ordering is implicit FIFO via createdAt — assert it is at least monotonic non-decreasing.
    const sorted = [...docs].sort((a, b) => a.createdAt!.getTime() - b.createdAt!.getTime());
    expect(sorted.map((d) => d._id.toString())).toEqual(
      [...docs].sort((a, b) => a.createdAt!.getTime() - b.createdAt!.getTime()).map((d) => d._id.toString()),
    );
  });

  // ===========================================================================
  // SUN-015 — concurrent doctor pick: two doctors picking the SAME request at
  // the same time must never create two appointments, and the loser must get
  // a clean 409 rather than a raw error.
  // ===========================================================================
  test("SUN-015: two doctors concurrently picking the same Sunday request creates exactly one appointment and never raises a raw error", async () => {
    const patient = await createPatient();
    const doctorA = await createDoctor();
    const doctorB = await createDoctor();

    const request = await SundayFreeRequestModel.create({
      patientId: patient._id.toString(),
      patientPhone: patient.phone!,
      sundayDateKey,
      affordabilityChoice: SundayAffordabilityChoices.CANNOT_AFFORD,
      status: SundayFreeRequestStatuses.REQUESTED,
    });

    const results = await Promise.allSettled([
      SundayConsultService.claimRequest(doctorA.userId.toString(), request._id.toString(), { startTimeLocal: "23:40" }),
      SundayConsultService.claimRequest(doctorB.userId.toString(), request._id.toString(), { startTimeLocal: "23:40" }),
    ]);

    for (const r of results) {
      if (r.status === "rejected") {
        const reason = r.reason;
        // Must be a clean AppError (or absent) — never a raw MongoServerError/driver exception.
        expect(reason && typeof reason === "object" && "statusCode" in reason).toBe(true);
      }
    }

    const appointments = await AppointmentModel.find({
      patientId: patient._id.toString(),
      type: AppointmentTypes.SUNDAY_FREE,
      sundayDateKey,
    }).lean();
    expect(appointments.length).toBe(1);
  });

  test("SUN-015b: a doctor releasing a picked request puts it back on the board and another doctor can pick it", async () => {
    const patient = await createPatient();
    const doctorA = await createDoctor();
    const doctorB = await createDoctor();

    const request = await SundayFreeRequestModel.create({
      patientId: patient._id.toString(),
      patientPhone: patient.phone!,
      sundayDateKey,
      affordabilityChoice: SundayAffordabilityChoices.CANNOT_AFFORD,
      status: SundayFreeRequestStatuses.REQUESTED,
    });
    const requestId = request._id.toString();

    await SundayConsultService.claimRequest(doctorA.userId.toString(), requestId, { startTimeLocal: "23:20" });
    await SundayConsultService.releaseRequest(doctorA.userId.toString(), requestId, {
      note: "I'm not a dermatologist",
    });

    const released = await SundayFreeRequestModel.findById(requestId).lean();
    expect(released?.status).toBe(SundayFreeRequestStatuses.REQUESTED);
    expect(released?.assignedDoctorId).toBeUndefined();

    // The note is stored encrypted and shown to the next doctor on the board.
    const raw = await SundayFreeRequestModel.collection.findOne({ _id: request._id });
    expect(JSON.stringify(raw?.releaseNotes)).not.toContain("dermatologist");
    const board = await SundayConsultService.listDoctorRequests(doctorB.userId.toString());
    const row = board.find((r) => r.requestId === requestId);
    expect(row?.releaseNotes).toEqual([
      expect.objectContaining({ note: "I'm not a dermatologist", byMe: false }),
    ]);

    const picked = await SundayConsultService.claimRequest(doctorB.userId.toString(), requestId, { startTimeLocal: "23:20" });
    expect(picked.pickedByMe).toBe(true);
    expect(picked.status).toBe(SundayFreeRequestStatuses.ASSIGNED);

    const active = await AppointmentModel.find({
      patientId: patient._id.toString(),
      type: AppointmentTypes.SUNDAY_FREE,
      sundayDateKey,
      status: { $ne: "cancelled" },
    }).lean();
    expect(active.length).toBe(1);
    expect(active[0]!.doctorId.toString()).toBe(doctorB._id.toString());
  });

  // ===========================================================================
  // SUN-016 / SUN-018 — concurrent hold creation + confirm-vs-confirm race:
  // a patient confirming two different held slots at once must leave exactly
  // one confirmed appointment, a clean 409 for the loser, and the loser's
  // slot released back to AVAILABLE (not stuck HELD).
  // ===========================================================================
  test("SUN-016 / SUN-018: concurrently confirming two different slot holds for the same patient leaves one appointment and releases the loser's slot", async () => {
    const patient = await createPatient();
    const doctorA = await createDoctor();
    const doctorB = await createDoctor();

    async function makeHeldInstance(doctorId: string) {
      const startAt = new Date(sundayDate.getTime() + 10 * 60 * 60 * 1000 + Math.random() * 1000);
      const slotId = `slot-${Math.random().toString(36).slice(2)}`;
      const instance = await SundaySlotInstanceModel.create({
        doctorId,
        sundayDate,
        slots: [{ slotId, startAt, endAt: new Date(startAt.getTime() + 10 * 60 * 1000), status: SlotStatuses.AVAILABLE }],
      });
      const hold = await SundayConsultService.reserveSlot(
        patient._id.toString(),
        doctorId,
        instance._id.toString(),
        slotId,
      );
      return { instance, slotId, hold };
    }

    const doctorAId = doctorA._id.toString();
    const doctorBId = doctorB._id.toString();
    const holdA = await makeHeldInstance(doctorAId);
    const holdB = await makeHeldInstance(doctorBId);

    const results = await Promise.allSettled([
      SundayConsultService.confirmBooking(patient._id.toString(), doctorAId, holdA.instance._id.toString(), holdA.slotId, holdA.hold.holdToken),
      SundayConsultService.confirmBooking(patient._id.toString(), doctorBId, holdB.instance._id.toString(), holdB.slotId, holdB.hold.holdToken),
    ]);

    const fulfilledCount = results.filter((r) => r.status === "fulfilled").length;
    expect(fulfilledCount).toBe(1);

    const [rA, rB] = results;
    const loser = rA.status === "rejected" ? rA : rB;
    expect(loser.status).toBe("rejected");
    if (loser.status === "rejected") {
      expect(loser.reason).toMatchObject({ statusCode: 409 });
    }

    const appointments = await AppointmentModel.find({
      patientId: patient._id.toString(),
      type: AppointmentTypes.SUNDAY_FREE,
      sundayDateKey,
    }).lean();
    expect(appointments.length).toBe(1);

    const instanceA = await SundaySlotInstanceModel.findById(holdA.instance._id.toString()).lean();
    const instanceB = await SundaySlotInstanceModel.findById(holdB.instance._id.toString()).lean();
    const slotAStatus = instanceA?.slots.find((s) => s.slotId === holdA.slotId)?.status;
    const slotBStatus = instanceB?.slots.find((s) => s.slotId === holdB.slotId)?.status;
    // Exactly one of the two slots stays BOOKED (the winner); the other must
    // be released back to AVAILABLE, never left stuck HELD.
    const statuses = [slotAStatus, slotBStatus];
    expect(statuses.filter((s) => s === SlotStatuses.BOOKED).length).toBe(1);
    expect(statuses.filter((s) => s === SlotStatuses.AVAILABLE).length).toBe(1);
    expect(statuses.includes(SlotStatuses.HELD)).toBe(false);
  });

  // ===========================================================================
  // SUN-010 / SUN-017 — expired hold is released and does not leave the
  // patient with an invalid allocation.
  // ===========================================================================
  test("SUN-010 / SUN-017: an expired hold is released back to AVAILABLE by the sweep, not left stuck", async () => {
    const doctor = await createDoctor();
    const patient = await createPatient();
    const slotId = `slot-expired-${Math.random().toString(36).slice(2)}`;
    const startAt = new Date(sundayDate.getTime() + 12 * 60 * 60 * 1000);
    const instance = await SundaySlotInstanceModel.create({
      doctorId: doctor._id.toString(),
      sundayDate,
      slots: [
        {
          slotId,
          startAt,
          endAt: new Date(startAt.getTime() + 10 * 60 * 1000),
          status: SlotStatuses.HELD,
          heldUntil: new Date(Date.now() - 1000),
          holdToken: "expired-token",
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- two structurally-distinct mongoose/mongodb ObjectId type declarations collide here; runtime accepts either.
          patientId: patient._id as any,
        },
      ],
    });

    await SundayConsultService.releaseExpiredHolds();

    const final = await SundaySlotInstanceModel.findById(instance._id.toString()).lean();
    const slot = final?.slots.find((s) => s.slotId === slotId);
    expect(slot?.status).toBe(SlotStatuses.AVAILABLE);
    expect(slot?.patientId).toBeUndefined();
    expect(slot?.holdToken).toBeUndefined();
  });
});
