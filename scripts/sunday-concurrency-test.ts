/**
 * Sunday Free Consultation — REAL MongoDB concurrency / stress test.
 *
 * Same technique as scripts/real-mongo-concurrency-test.ts: an ephemeral
 * local mongod (mongodb-memory-server — never Atlas, never production), the
 * REAL @zindagi/database models (so every real unique index gets built
 * fresh), and the REAL SundayConsultService code. No mocks of the service
 * under test.
 *
 * NOTE ON REDIS: this codebase has no Redis client anywhere (grep -rn
 * "redis\|ioredis" apps/web/src turns up nothing but a comment). All
 * concurrency safety for Sunday Free Consultation comes from MongoDB unique
 * indexes + atomic findOneAndUpdate. This script tests that MongoDB-level
 * safety directly — it does not simulate Redis, because there is nothing to
 * simulate.
 *
 * Run: cd apps/web && npx tsx ../../scripts/sunday-concurrency-test.ts
 */
import { MongoMemoryServer } from "mongodb-memory-server";
import { randomBytes, randomUUID } from "crypto";

type Counts = Record<string, number>;
function tally(counts: Counts, key: string) {
  counts[key] = (counts[key] ?? 0) + 1;
}

async function main() {
  console.log("Starting ephemeral local MongoDB (mongodb-memory-server)...");
  const mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri("zindagi_sunday_concurrency_test");
  process.env.FIELD_ENCRYPTION_KEY = randomBytes(32).toString("base64");
  console.log("Local MongoDB URI:", process.env.MONGODB_URI);

  const {
    connectDatabase,
    UserModel,
    DoctorProfileModel,
    AppointmentModel,
    SundayFreeRequestModel,
    SundaySlotInstanceModel,
  } = await import("@zindagi/database");
  const mongooseMod = (await import("mongoose")).default;
  const {
    AppointmentStatuses,
    AppointmentTypes,
    VerificationStatuses,
    SlotStatuses,
    SundayAffordabilityChoices,
    SundayFreeRequestStatuses,
  } = await import("@zindagi/shared");

  await connectDatabase();
  console.log("Connected. Waiting for indexes to build...");
  await AppointmentModel.init();
  await SundayFreeRequestModel.init();
  await SundaySlotInstanceModel.init();
  console.log("Indexes ready.\n");

  const { SundayConsultService } = await import("@/server/services/sunday-consult.service");
  const { formatSundayDateKey, getActiveOrNextSundayDate } = await import("@/lib/sunday/date-utils");

  const sundayDate = getActiveOrNextSundayDate();
  const sundayDateKey = formatSundayDateKey(sundayDate);
  console.log(`Active/next Sunday date key for this run: ${sundayDateKey}\n`);

  let patientCounter = 0;
  // Valid Pakistani mobile per pakistan-phone.ts: "92" + "3" + 9 more digits
  // (12 digits total, digit[2] === "3"). Counter-based (not random) so 500+
  // concurrently-created users never collide on the unique phone index.
  function makePhone(roleTag: string, counter: number) {
    return `+923${roleTag}${counter.toString().padStart(8, "0")}`;
  }

  async function createPatient(tag = "patient") {
    patientCounter += 1;
    return UserModel.create({
      name: `Sunday ${tag} ${patientCounter}`,
      email: `sunday-${tag}-${patientCounter}-${Date.now()}@example.com`,
      phone: makePhone("0", patientCounter),
      roles: ["patient"],
      isActive: true,
    });
  }

  let doctorCounter = 0;
  async function createDoctor() {
    doctorCounter += 1;
    const doctorUser = await UserModel.create({
      name: `Sunday Doctor ${doctorCounter}`,
      email: `sunday-doctor-${doctorCounter}-${Date.now()}@example.com`,
      phone: makePhone("1", doctorCounter),
      roles: ["doctor"],
      isActive: true,
    });
    const profile = await DoctorProfileModel.create({
      userId: doctorUser._id,
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
    return { doctorUser, profile };
  }

  function submitInput(phone: string) {
    return {
      patientPhone: phone,
      affordabilityChoice: SundayAffordabilityChoices.CANNOT_AFFORD,
    } as const;
  }

  // ===========================================================================
  // SCENARIO 1 — N UNIQUE eligible patients submitting concurrently
  // (progressive stress: 10 / 25 / 50 / 100 / 250 / 500)
  // ===========================================================================
  async function scenarioUniquePatients(n: number) {
    console.log(`\n=== SCENARIO 1: ${n} unique eligible patients, concurrent submitRequest ===`);
    const patients = [];
    for (let i = 0; i < n; i++) patients.push(await createPatient("uniq"));

    const start = Date.now();
    const results = await Promise.allSettled(
      patients.map((p) => SundayConsultService.submitRequest(p._id.toString(), submitInput(p.phone!))),
    );
    const elapsed = Date.now() - start;

    const fulfilled = results.filter((r) => r.status === "fulfilled").length;
    const rejected = results.filter((r) => r.status === "rejected").length;
    const rejectionReasons: Counts = {};
    let serverErrors = 0; // rejections that are NOT a clean AppError (i.e. would have been a raw 500)
    for (const r of results) {
      if (r.status === "rejected") {
        const reason = r.reason;
        const isAppError = reason && typeof reason === "object" && "statusCode" in reason;
        tally(rejectionReasons, isAppError ? `AppError:${reason.statusCode}` : `RAW:${reason?.constructor?.name ?? typeof reason}`);
        if (!isAppError) serverErrors++;
      }
    }

    const docs = await SundayFreeRequestModel.find({
      patientId: { $in: patients.map((p) => p._id) },
      sundayDateKey,
    }).lean();

    const perPatientCounts = new Map<string, number>();
    for (const d of docs) {
      const key = d.patientId.toString();
      perPatientCounts.set(key, (perPatientCounts.get(key) ?? 0) + 1);
    }
    const patientsWithMultipleDocs = [...perPatientCounts.values()].filter((c) => c > 1).length;
    const lostRequests = fulfilled - docs.length; // fulfilled but no DB doc = data loss
    const uniqueRequestIds = new Set(docs.map((d) => d._id.toString()));
    const duplicatePositions = docs.length - uniqueRequestIds.size; // should always be 0 (Mongo _id is inherently unique) — sanity check only

    console.log(`  elapsed=${elapsed}ms fulfilled=${fulfilled} rejected=${rejected} serverErrors(raw,non-AppError)=${serverErrors}`);
    console.log(`  rejection reasons:`, rejectionReasons);
    console.log(`  DB queue docs for this batch: ${docs.length} (expected == fulfilled == ${n})`);
    console.log(`  patients with >1 active request doc (should be 0): ${patientsWithMultipleDocs}`);
    console.log(`  lost requests (fulfilled but no DB doc): ${lostRequests}`);
    console.log(`  duplicate _id collisions (should be 0): ${duplicatePositions}`);

    return {
      n,
      elapsed,
      fulfilled,
      rejected,
      serverErrors,
      dbDocs: docs.length,
      patientsWithMultipleDocs,
      lostRequests,
      duplicatePositions,
    };
  }

  // ===========================================================================
  // SCENARIO 2 — SAME patient, N concurrent IDENTICAL requests
  // (idempotency stress: 1 / 5 / 10 / 25 / 50 / 100)
  // ===========================================================================
  async function scenarioDuplicatePatient(n: number) {
    console.log(`\n=== SCENARIO 2: SAME patient, ${n}-way concurrent identical submitRequest ===`);
    const patient = await createPatient("dup");

    const start = Date.now();
    const results = await Promise.allSettled(
      Array.from({ length: n }, () =>
        SundayConsultService.submitRequest(patient._id.toString(), submitInput(patient.phone!)),
      ),
    );
    const elapsed = Date.now() - start;

    const fulfilled = results.filter((r) => r.status === "fulfilled").length;
    const rejected = results.filter((r) => r.status === "rejected").length;
    let serverErrors = 0;
    const rawErrors: unknown[] = [];
    for (const r of results) {
      if (r.status === "rejected") {
        const reason = r.reason;
        const isAppError = reason && typeof reason === "object" && "statusCode" in reason;
        if (!isAppError) {
          serverErrors++;
          rawErrors.push(reason);
        }
      }
    }

    const requestIds = new Set(
      results
        .filter((r): r is PromiseFulfilledResult<{ requestId: string }> => r.status === "fulfilled")
        .map((r) => (r.value as { requestId: string }).requestId),
    );

    const docs = await SundayFreeRequestModel.find({ patientId: patient._id, sundayDateKey }).lean();

    console.log(`  elapsed=${elapsed}ms fulfilled=${fulfilled} rejected=${rejected} serverErrors(raw)=${serverErrors} distinctRequestIdsReturned=${requestIds.size}`);
    console.log(`  DB queue docs for this patient (should be exactly 1): ${docs.length}`);
    if (rawErrors.length) {
      console.log(`  first raw error:`, rawErrors[0] instanceof Error ? rawErrors[0].stack ?? rawErrors[0].message : rawErrors[0]);
    }

    return { n, elapsed, fulfilled, rejected, serverErrors, distinctRequestIds: requestIds.size, dbDocs: docs.length };
  }

  // ===========================================================================
  // SCENARIO 3 — Patient holds two different doctors' slots, confirms both
  // concurrently. Proves: (a) no raw 500 on the loser, (b) loser's slot is
  // released back to AVAILABLE instead of stuck HELD.
  // ===========================================================================
  async function scenarioConcurrentConfirm() {
    console.log(`\n=== SCENARIO 3: same patient confirms two different doctors' slots concurrently ===`);
    const patient = await createPatient("confirm");
    const { profile: doctorA } = await createDoctor();
    const { profile: doctorB } = await createDoctor();

    async function makeHeldInstance(doctorId: unknown) {
      const startAt = new Date(sundayDate.getTime() + 9 * 60 * 60 * 1000);
      const endAt = new Date(startAt.getTime() + 10 * 60 * 1000);
      const slotId = randomUUID();
      const instance = await SundaySlotInstanceModel.create({
        doctorId,
        sundayDate,
        slots: [{ slotId, startAt, endAt, status: SlotStatuses.AVAILABLE }],
      });
      const hold = await SundayConsultService.reserveSlot(
        patient._id.toString(),
        (doctorId as { toString(): string }).toString(),
        instance._id.toString(),
        slotId,
      );
      return { instance, slotId, hold };
    }

    const holdA = await makeHeldInstance(doctorA._id);
    const holdB = await makeHeldInstance(doctorB._id);

    const results = await Promise.allSettled([
      SundayConsultService.confirmBooking(
        patient._id.toString(),
        doctorA._id.toString(),
        holdA.instance._id.toString(),
        holdA.slotId,
        holdA.hold.holdToken,
      ),
      SundayConsultService.confirmBooking(
        patient._id.toString(),
        doctorB._id.toString(),
        holdB.instance._id.toString(),
        holdB.slotId,
        holdB.hold.holdToken,
      ),
    ]);

    const [rA, rB] = results;
    const winnerCount = results.filter((r) => r.status === "fulfilled").length;
    let loserWasCleanConflict = false;
    let loserRawError: unknown = null;
    const loser = rA.status === "rejected" ? rA : rB.status === "rejected" ? rB : null;
    if (loser) {
      const reason = (loser as PromiseRejectedResult).reason;
      loserWasCleanConflict = reason && typeof reason === "object" && "statusCode" in reason && reason.statusCode === 409;
      if (!loserWasCleanConflict) loserRawError = reason;
    }

    const appointments = await AppointmentModel.find({
      patientId: patient._id,
      type: AppointmentTypes.SUNDAY_FREE,
      sundayDateKey,
    }).lean();

    const instanceA = await SundaySlotInstanceModel.findById(holdA.instance._id).lean();
    const instanceB = await SundaySlotInstanceModel.findById(holdB.instance._id).lean();
    const slotAStatus = instanceA?.slots.find((s) => s.slotId === holdA.slotId)?.status;
    const slotBStatus = instanceB?.slots.find((s) => s.slotId === holdB.slotId)?.status;
    const loserSlotStatus = rA.status === "rejected" ? slotAStatus : slotBStatus;

    console.log(`  winners=${winnerCount} (expected 1)  loser clean 409=${loserWasCleanConflict}`);
    console.log(`  confirmed appointments for this patient this week (expected 1): ${appointments.length}`);
    console.log(`  loser's slot status after race (expected AVAILABLE, not stuck HELD): ${loserSlotStatus}`);
    if (loserRawError) {
      console.log(`  >>> RAW ERROR on loser (not a clean AppError):`, loserRawError instanceof Error ? loserRawError.stack ?? loserRawError.message : loserRawError);
    }

    return {
      winnerCount,
      loserWasCleanConflict,
      loserSlotStatus,
      appointmentCount: appointments.length,
      hadRawError: !!loserRawError,
    };
  }

  // ===========================================================================
  // SCENARIO 4 — Admin double-assigns the SAME request concurrently
  // (double-click / two-admins race).
  // ===========================================================================
  async function scenarioConcurrentAssign() {
    console.log(`\n=== SCENARIO 4: same Sunday free-request assigned to a doctor twice, concurrently ===`);
    const patient = await createPatient("assign");
    const { profile: doctor } = await createDoctor();
    const admin = await UserModel.create({
      name: "Sunday Admin",
      email: `sunday-admin-${Date.now()}@example.com`,
      phone: makePhone("2", 1),
      roles: ["admin"],
      isActive: true,
    });

    const request = await SundayFreeRequestModel.create({
      patientId: patient._id,
      patientPhone: patient.phone,
      sundayDateKey,
      affordabilityChoice: SundayAffordabilityChoices.CANNOT_AFFORD,
      status: SundayFreeRequestStatuses.REQUESTED,
    });

    const results = await Promise.allSettled([
      SundayConsultService.assignDoctor(request._id.toString(), admin._id.toString(), { doctorId: doctor._id.toString() }),
      SundayConsultService.assignDoctor(request._id.toString(), admin._id.toString(), { doctorId: doctor._id.toString() }),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled").length;
    let rawError: unknown = null;
    for (const r of results) {
      if (r.status === "rejected") {
        const reason = r.reason;
        const isAppError = reason && typeof reason === "object" && "statusCode" in reason;
        if (!isAppError) rawError = reason;
      }
    }

    const appointments = await AppointmentModel.find({
      patientId: patient._id,
      type: AppointmentTypes.SUNDAY_FREE,
      sundayDateKey,
    }).lean();
    const finalRequest = await SundayFreeRequestModel.findById(request._id).lean();

    console.log(`  fulfilled=${fulfilled}/2  appointments created for this patient (expected 1): ${appointments.length}`);
    console.log(`  final request status: ${finalRequest?.status}, appointmentId set: ${!!finalRequest?.appointmentId}`);
    if (rawError) {
      console.log(`  >>> RAW ERROR (not a clean AppError):`, rawError instanceof Error ? rawError.stack ?? rawError.message : rawError);
    }

    return { fulfilled, appointmentCount: appointments.length, hadRawError: !!rawError };
  }

  // ===========================================================================
  // SCENARIO 5 — Concurrent hold-expiry sweeps colliding on the same
  // SundaySlotInstance document (ensureConnected()'s debounce is itself a
  // check-then-set race; the cron route can also overlap a live request).
  // ===========================================================================
  async function scenarioConcurrentSweep() {
    console.log(`\n=== SCENARIO 5: two concurrent releaseExpiredHolds() sweeps on the same expired-hold instance ===`);
    const { profile: doctor } = await createDoctor();
    const patient = await createPatient("sweep");
    const slotId = `slot-sweep-${Math.random()}`;
    const startAt = new Date(sundayDate.getTime() + 11 * 60 * 60 * 1000);
    const instance = await SundaySlotInstanceModel.create({
      doctorId: doctor._id,
      sundayDate,
      slots: [
        {
          slotId,
          startAt,
          endAt: new Date(startAt.getTime() + 10 * 60 * 1000),
          status: SlotStatuses.HELD,
          heldUntil: new Date(Date.now() - 1000), // already expired
          holdToken: "expired-token",
          patientId: patient._id,
        },
      ],
    });

    const results = await Promise.allSettled([
      SundayConsultService.releaseExpiredHolds(),
      SundayConsultService.releaseExpiredHolds(),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled").length;
    let rawError: unknown = null;
    for (const r of results) {
      if (r.status === "rejected") rawError = r.reason;
    }

    const finalInstance = await SundaySlotInstanceModel.findById(instance._id).lean();
    const finalSlotStatus = finalInstance?.slots.find((s) => s.slotId === slotId)?.status;

    console.log(`  fulfilled=${fulfilled}/2  final slot status (expected AVAILABLE): ${finalSlotStatus}`);
    if (rawError) {
      console.log(`  >>> concurrent sweep threw:`, rawError instanceof Error ? `${rawError.constructor.name}: ${rawError.message}` : rawError);
    }

    return { fulfilled, finalSlotStatus, threw: !!rawError, errorName: rawError instanceof Error ? rawError.constructor.name : null };
  }

  // ---------------------------------------------------------------------------
  // Run everything
  // ---------------------------------------------------------------------------
  const progressive = [];
  for (const n of [10, 25, 50, 100, 250, 500]) {
    progressive.push(await scenarioUniquePatients(n));
  }

  const duplicateStress = [];
  for (const n of [1, 5, 10, 25, 50, 100]) {
    duplicateStress.push(await scenarioDuplicatePatient(n));
  }

  const confirmRace = await scenarioConcurrentConfirm();
  const assignRace = await scenarioConcurrentAssign();
  const sweepRace = await scenarioConcurrentSweep();

  console.log("\n\n===================== SUMMARY =====================");
  console.log(JSON.stringify({ progressive, duplicateStress, confirmRace, assignRace, sweepRace }, null, 2));

  await mongooseMod.disconnect();
  await mongod.stop();
  console.log("\nDone. Ephemeral MongoDB stopped and discarded.");
}

main().catch(async (e) => {
  console.error("SCRIPT ERROR:", e);
  process.exit(1);
});
