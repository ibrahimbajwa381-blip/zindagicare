/**
 * Home Visits — REAL MongoDB concurrency / correctness audit.
 *
 * Same technique as scripts/sunday-concurrency-test.ts and
 * scripts/real-mongo-concurrency-test.ts: an ephemeral local mongod
 * (mongodb-memory-server — never Atlas, never production), the REAL
 * @zindagi/database models, and the REAL HomeVisitService code. No mocks of
 * the service under test.
 *
 * NOTE ON REDIS: this codebase has no Redis client anywhere. All
 * concurrency safety comes from MongoDB. HomeVisitModel has NO unique
 * indexes (unlike SundayFreeRequest/Appointment) — this script exists to
 * find out empirically whether that matters.
 *
 * Run: cd apps/web && npx tsx ../../scripts/home-visit-concurrency-test.ts
 */
import { MongoMemoryServer } from "mongodb-memory-server";
import { randomBytes } from "crypto";

type Counts = Record<string, number>;
function tally(counts: Counts, key: string) {
  counts[key] = (counts[key] ?? 0) + 1;
}
function isAppError(err: unknown): boolean {
  return !!err && typeof err === "object" && "statusCode" in err;
}

async function main() {
  console.log("Starting ephemeral local MongoDB (mongodb-memory-server)...");
  const mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri("zindagi_home_visit_concurrency_test");
  process.env.FIELD_ENCRYPTION_KEY = randomBytes(32).toString("base64");
  console.log("Local MongoDB URI:", process.env.MONGODB_URI);

  const {
    connectDatabase,
    UserModel,
    DoctorProfileModel,
    StaffProfileModel,
    HomeVisitModel,
    PaymentModel,
  } = await import("@zindagi/database");
  const mongooseMod = (await import("mongoose")).default;
  const {
    Roles,
    VerificationStatuses,
    HomeVisitServiceTypes,
    HomeVisitStatuses,
    PaymentStatuses,
  } = await import("@zindagi/shared");

  await connectDatabase();
  console.log("Connected. Waiting for indexes to build...");
  await HomeVisitModel.init();
  await PaymentModel.init();
  console.log("Indexes ready.\n");

  const { HomeVisitService } = await import("@/server/services/home-visit.service");

  let counter = 0;
  function makePhone(roleTag: string, n: number) {
    return `+923${roleTag}${n.toString().padStart(8, "0")}`;
  }

  async function createPatient() {
    counter += 1;
    return UserModel.create({
      name: `HV Patient ${counter}`,
      email: `hv-patient-${counter}-${Date.now()}@example.com`,
      phone: makePhone("4", counter),
      roles: ["patient"],
      isActive: true,
    });
  }

  async function createDoctor(opts: { coverageCities?: string[] } = {}) {
    counter += 1;
    const user = await UserModel.create({
      name: `HV Doctor ${counter}`,
      email: `hv-doctor-${counter}-${Date.now()}@example.com`,
      phone: makePhone("5", counter),
      roles: ["doctor"],
      isActive: true,
    });
    const profile = await DoctorProfileModel.create({
      userId: user._id,
      isListed: true,
      verificationStatus: VerificationStatuses.APPROVED,
      consultationFee: 1500,
      specialties: ["General Physician"],
      coverageCities: opts.coverageCities ?? ["Lahore"],
      homeVisitEnabled: true,
      homeVisitLocation: { area: "DHA", geo: { type: "Point", coordinates: [74.3587, 31.5204] } },
      weeklyAvailability: Array.from({ length: 7 }, (_, dayOfWeek) => ({
        dayOfWeek,
        startTimeLocal: "00:00",
        endTimeLocal: "23:40",
      })),
    });
    return { user, profile };
  }

  async function createNurse(staffType: string = Roles.NURSE) {
    counter += 1;
    const user = await UserModel.create({
      name: `HV Staff ${counter}`,
      email: `hv-staff-${counter}-${Date.now()}@example.com`,
      phone: makePhone("6", counter),
      roles: [staffType],
      isActive: true,
    });
    const profile = await StaffProfileModel.create({
      userId: user._id,
      staffType,
      homeVisitEnabled: true,
      isAvailable: true,
      verificationStatus: "approved",
      serviceAreas: [
        { city: "Lahore", area: "DHA", geo: { type: "Point", coordinates: [74.3587, 31.5204] }, radiusKm: 15 },
      ],
    });
    return { user, profile };
  }

  function bookingInput(serviceType: string, scheduledAt: Date, overrides: Record<string, unknown> = {}) {
    return {
      serviceType,
      scheduledAt: scheduledAt.toISOString(),
      addressLine: "House 12, Street 5, DHA Phase 5",
      city: "Lahore",
      geo: { lng: 74.3587, lat: 31.5204 },
      autoAssign: false,
      ...overrides,
    };
  }

  // Each call returns a scheduledAt far enough from every other call's (>4h,
  // more than double the service's own 2h conflict window) that different
  // scenarios sharing this one ephemeral DB never overlap and interfere
  // with each other's staff-availability checks.
  let slotCounter = 0;
  const nextSlot = () => {
    slotCounter += 1;
    return new Date(Date.now() + slotCounter * 5 * 60 * 60 * 1000);
  };

  // ===========================================================================
  // SCENARIO 1 — SEQUENTIAL nurse double-assign (no concurrency needed: does
  // findNearestAvailableStaffByType check busy status at all?)
  // ===========================================================================
  async function scenarioSequentialNurseDoubleAssign() {
    console.log(`\n=== SCENARIO 1: SEQUENTIAL nurse auto-assign to two overlapping-time visits (same nurse, only one available) ===`);
    const { user: nurse } = await createNurse(Roles.NURSE);
    const patientA = await createPatient();
    const patientB = await createPatient();
    const scheduledAt = nextSlot();

    const visitA = await HomeVisitService.createRequest(
      patientA._id.toString(),
      bookingInput(HomeVisitServiceTypes.NURSE, scheduledAt),
    );
    const visitB = await HomeVisitService.createRequest(
      patientB._id.toString(),
      bookingInput(HomeVisitServiceTypes.NURSE, scheduledAt),
    );

    const assignA = await HomeVisitService.autoAssignStaff(visitA.id);
    let assignBError: unknown = null;
    let assignB: { staffId: string } | null = null;
    try {
      assignB = await HomeVisitService.autoAssignStaff(visitB.id);
    } catch (e) {
      assignBError = e;
    }

    const sameNurseDoubleBooked = assignA.staffId === nurse._id.toString() && assignB?.staffId === nurse._id.toString();
    console.log(`  visitA assigned to: ${assignA.staffId} (expected nurse: ${nurse._id.toString()})`);
    console.log(`  visitB result: ${assignB ? `ASSIGNED to ${assignB.staffId}` : `REJECTED (${(assignBError as { message?: string })?.message})`}`);
    console.log(`  >>> Same nurse double-booked to two overlapping-time visits: ${sameNurseDoubleBooked}`);

    return { sameNurseDoubleBooked, assignBSucceeded: !!assignB };
  }

  // ===========================================================================
  // SCENARIO 2 — SEQUENTIAL manual assignStaff double-assign (admin assigns
  // the SAME staff member to two overlapping-time visits manually — does
  // assignStaff check busy status at all, for ANY service type?)
  // ===========================================================================
  async function scenarioSequentialManualDoubleAssign() {
    console.log(`\n=== SCENARIO 2: SEQUENTIAL manual assignStaff — same doctor assigned to two overlapping-time visits ===`);
    const { user: doctor } = await createDoctor();
    const patientA = await createPatient();
    const patientB = await createPatient();
    const scheduledAt = nextSlot();

    const visitA = await HomeVisitService.createRequest(
      patientA._id.toString(),
      bookingInput(HomeVisitServiceTypes.DOCTOR_VISIT, scheduledAt),
    );
    const visitB = await HomeVisitService.createRequest(
      patientB._id.toString(),
      bookingInput(HomeVisitServiceTypes.DOCTOR_VISIT, scheduledAt),
    );

    const assignA = await HomeVisitService.assignStaff(visitA.id, { staffId: doctor._id.toString() });
    let assignBError: unknown = null;
    let assignB: { staffId: string } | null = null;
    try {
      assignB = await HomeVisitService.assignStaff(visitB.id, { staffId: doctor._id.toString() });
    } catch (e) {
      assignBError = e;
    }

    const doubleBooked = assignA.staffId === doctor._id.toString() && assignB?.staffId === doctor._id.toString();
    console.log(`  visitA assigned to: ${assignA.staffId}`);
    console.log(`  visitB result: ${assignB ? `ASSIGNED to ${assignB.staffId}` : `REJECTED (${(assignBError as { message?: string })?.message})`}`);
    console.log(`  >>> Same doctor manually double-booked via assignStaff: ${doubleBooked}`);

    return { doubleBooked, assignBSucceeded: !!assignB };
  }

  // ===========================================================================
  // SCENARIO 3 — CONCURRENT auto-assign race: N different patients' visits,
  // ALL requesting the same service/time, only ONE eligible doctor exists.
  // ===========================================================================
  async function scenarioConcurrentAutoAssignRace(n: number) {
    console.log(`\n=== SCENARIO 3: ${n}-way CONCURRENT autoAssignStaff race, one eligible doctor ===`);
    const { user: doctor } = await createDoctor();
    const scheduledAt = nextSlot();

    const visits = [];
    for (let i = 0; i < n; i++) {
      const patient = await createPatient();
      const visit = await HomeVisitService.createRequest(
        patient._id.toString(),
        bookingInput(HomeVisitServiceTypes.DOCTOR_VISIT, scheduledAt),
      );
      visits.push(visit);
    }

    const results = await Promise.allSettled(
      visits.map((v) => HomeVisitService.autoAssignStaff(v.id)),
    );

    const fulfilled = results.filter((r) => r.status === "fulfilled").length;
    const rejectedClean = results.filter((r) => r.status === "rejected" && isAppError((r as PromiseRejectedResult).reason)).length;
    const rejectedRaw = results.filter((r) => r.status === "rejected" && !isAppError((r as PromiseRejectedResult).reason)).length;

    const finalVisits = await HomeVisitModel.find({
      _id: { $in: visits.map((v) => v.id) },
    }).lean();
    const assignedVisits = finalVisits.filter((v) => v.status === HomeVisitStatuses.ASSIGNED && v.assignedStaffId);
    // Real signal (see SCENARIO 8): does any ONE doctor end up holding more
    // than one of these same-time-slot visits, regardless of which doctor
    // the geo tie-break happens to prefer (several equally-eligible doctors
    // can legitimately exist by this point in the run).
    const perDoctorCount = new Map<string, number>();
    for (const v of assignedVisits) {
      const id = v.assignedStaffId!.toString();
      perDoctorCount.set(id, (perDoctorCount.get(id) ?? 0) + 1);
    }
    const maxAssignedToOneDoctor = Math.max(0, ...perDoctorCount.values());

    console.log(`  n=${n} fulfilled=${fulfilled} rejectedClean(AppError)=${rejectedClean} rejectedRaw(non-AppError)=${rejectedRaw}`);
    if (rejectedClean > 0) {
      const msgs = results
        .filter((r) => r.status === "rejected")
        .map((r) => (r as PromiseRejectedResult).reason?.message);
      console.log(`  rejection messages:`, JSON.stringify(msgs));
    }
    console.log(`  Distinct doctors assigned: ${perDoctorCount.size}, max visits on any one doctor at this same time slot: ${maxAssignedToOneDoctor} (must be 1)`);
    if (rejectedRaw > 0) {
      const rawReason = (results.find((r) => r.status === "rejected" && !isAppError((r as PromiseRejectedResult).reason)) as PromiseRejectedResult)?.reason;
      console.log(`  >>> RAW ERROR sample:`, rawReason instanceof Error ? `${rawReason.constructor.name}: ${rawReason.message}` : rawReason);
    }

    return { n, fulfilled, rejectedClean, rejectedRaw, doctorDoubleBooked: maxAssignedToOneDoctor > 1 };
  }

  // ===========================================================================
  // SCENARIO 4 — CONCURRENT double-click assign: TWO calls assigning the
  // SAME visit at the same time (admin double-click / auto+manual race).
  // ===========================================================================
  async function scenarioConcurrentSameVisitAssign() {
    console.log(`\n=== SCENARIO 4: CONCURRENT assignStaff x2 on the SAME visit (double-click) ===`);
    const { user: doctorA } = await createDoctor();
    const { user: doctorB } = await createDoctor();
    const patient = await createPatient();
    const visit = await HomeVisitService.createRequest(
      patient._id.toString(),
      bookingInput(HomeVisitServiceTypes.DOCTOR_VISIT, nextSlot()),
    );

    const results = await Promise.allSettled([
      HomeVisitService.assignStaff(visit.id, { staffId: doctorA._id.toString() }),
      HomeVisitService.assignStaff(visit.id, { staffId: doctorB._id.toString() }),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled").length;
    let rawError: unknown = null;
    for (const r of results) {
      if (r.status === "rejected" && !isAppError(r.reason)) rawError = r.reason;
    }
    const finalVisit = await HomeVisitModel.findById(visit.id).lean();

    console.log(`  fulfilled=${fulfilled}/2 final assignedStaffId=${finalVisit?.assignedStaffId} final status=${finalVisit?.status}`);
    if (rawError) {
      console.log(`  >>> RAW ERROR (not a clean AppError):`, rawError instanceof Error ? `${rawError.constructor.name}: ${rawError.message}` : rawError);
    }

    return { fulfilled, hadRawError: !!rawError, finalStatus: finalVisit?.status };
  }

  // ===========================================================================
  // SCENARIO 5 — CONCURRENT initiateCheckout on same visit (duplicate payment?)
  // ===========================================================================
  async function scenarioConcurrentCheckout() {
    console.log(`\n=== SCENARIO 5: CONCURRENT initiateCheckout x5 on the SAME visit ===`);
    const patient = await createPatient();
    const visit = await HomeVisitService.createRequest(
      patient._id.toString(),
      bookingInput(HomeVisitServiceTypes.NURSE, nextSlot()),
    );

    const results = await Promise.allSettled(
      Array.from({ length: 5 }, () => HomeVisitService.initiateCheckout(visit.id, patient._id.toString())),
    );

    const fulfilled = results.filter(
      (r): r is PromiseFulfilledResult<{ paymentId: string }> => r.status === "fulfilled",
    );
    let rawError: unknown = null;
    for (const r of results) {
      if (r.status === "rejected" && !isAppError((r as PromiseRejectedResult).reason)) rawError = (r as PromiseRejectedResult).reason;
    }

    // Payment docs get created before the atomic claim (same accepted
    // tradeoff as the pre-existing Zoom-duplicate-call fix elsewhere in this
    // codebase) — the number that matters isn't how many Payment documents
    // exist, it's whether every caller converged on the SAME winning one,
    // and whether the visit itself ends up linked to exactly one of them.
    const distinctPaymentIdsReturned = new Set(fulfilled.map((r) => r.value.paymentId));
    const finalVisit = await HomeVisitModel.findById(visit.id).lean();
    const payments = await PaymentModel.find({
      "metadata.homeVisitId": visit.id,
    }).lean();

    console.log(`  fulfilled=${fulfilled.length}/5 distinct paymentIds returned to callers: ${distinctPaymentIdsReturned.size} (must be 1) visit.paymentId=${finalVisit?.paymentId}`);
    console.log(`  Payment docs created in DB (orphans expected, same tradeoff as the Zoom dup-call precedent): ${payments.length}`);
    if (rawError) {
      console.log(`  >>> RAW ERROR:`, rawError instanceof Error ? `${rawError.constructor.name}: ${rawError.message}` : rawError);
    }

    return {
      fulfilled: fulfilled.length,
      distinctPaymentIdsReturned: distinctPaymentIdsReturned.size,
      paymentDocs: payments.length,
      hadRawError: !!rawError,
    };
  }

  // ===========================================================================
  // SCENARIO 6 — CONCURRENT resolveCancellationRequest (admin approve+deny,
  // or approve+approve) on the same pending refund request.
  // ===========================================================================
  async function scenarioConcurrentResolveCancellation() {
    console.log(`\n=== SCENARIO 6: CONCURRENT resolveCancellationRequest (approve x2) on same visit ===`);
    const patient = await createPatient();
    const admin = await UserModel.create({
      name: "HV Admin",
      email: `hv-admin-${Date.now()}@example.com`,
      phone: makePhone("7", counter + 1),
      roles: ["admin"],
      isActive: true,
    });
    const visit = await HomeVisitService.createRequest(
      patient._id.toString(),
      bookingInput(HomeVisitServiceTypes.NURSE, nextSlot()),
    );
    const checkout = await HomeVisitService.initiateCheckout(visit.id, patient._id.toString());
    // isManualTransferMode() is true in this env (no live payment provider configured),
    // so initiateCheckout creates a MANUAL_JAZZCASH payment, not DUMMY — mark it paid the
    // same way the real manual-transfer flow does.
    await HomeVisitService.submitManualReceipt(checkout.paymentId, patient._id.toString(), {
      storageKey: "test/receipt.jpg",
      url: "https://example.com/receipt.jpg",
      originalName: "receipt.jpg",
      mimeType: "image/jpeg",
    });

    // Patient cancels a paid REQUESTED visit -> pending cancellation/refund request.
    await HomeVisitService.updateStatus(visit.id, patient._id.toString(), ["patient"], {
      status: HomeVisitStatuses.CANCELLED,
      refundMethod: "bank",
      refundAccountTitle: "HV Patient",
      refundAccountNumber: "1234567890",
    } as never);

    const results = await Promise.allSettled([
      HomeVisitService.resolveCancellationRequest(visit.id, admin._id.toString(), "approve"),
      HomeVisitService.resolveCancellationRequest(visit.id, admin._id.toString(), "approve"),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled").length;
    let rawError: unknown = null;
    for (const r of results) {
      if (r.status === "rejected" && !isAppError((r as PromiseRejectedResult).reason)) rawError = (r as PromiseRejectedResult).reason;
    }
    const finalPayment = await PaymentModel.findById(checkout.paymentId).lean();

    console.log(`  fulfilled=${fulfilled}/2 final payment status=${finalPayment?.status} (must be REFUNDED, set exactly once)`);
    if (rawError) {
      console.log(`  >>> RAW ERROR:`, rawError instanceof Error ? `${rawError.constructor.name}: ${rawError.message}` : rawError);
    }

    return { fulfilled, hadRawError: !!rawError, finalPaymentStatus: finalPayment?.status };
  }

  // ===========================================================================
  // SCENARIO 7 — Admin sets status=ASSIGNED directly via updateStatus,
  // bypassing assignStaff entirely — does it create an inconsistent state
  // (status=ASSIGNED, assignedStaffId unset)?
  // ===========================================================================
  async function scenarioStatusEndpointAssignedGap() {
    console.log(`\n=== SCENARIO 7: admin sets status="assigned" via PATCH status endpoint directly (bypassing assignStaff) ===`);
    const patient = await createPatient();
    const admin = await UserModel.create({
      name: "HV Admin2",
      email: `hv-admin2-${Date.now()}@example.com`,
      phone: makePhone("8", counter + 1),
      roles: ["admin"],
      isActive: true,
    });
    const visit = await HomeVisitService.createRequest(
      patient._id.toString(),
      bookingInput(HomeVisitServiceTypes.NURSE, nextSlot()),
    );

    let threw = false;
    try {
      await HomeVisitService.updateStatus(visit.id, admin._id.toString(), ["admin"], {
        status: HomeVisitStatuses.ASSIGNED,
      } as never);
    } catch {
      threw = true;
    }

    const finalVisit = await HomeVisitModel.findById(visit.id).lean();
    const inconsistent = finalVisit?.status === HomeVisitStatuses.ASSIGNED && !finalVisit?.assignedStaffId;
    console.log(`  threw=${threw} final status=${finalVisit?.status} assignedStaffId=${finalVisit?.assignedStaffId}`);
    console.log(`  >>> Inconsistent state (status=ASSIGNED, no staff): ${inconsistent}`);

    return { threw, inconsistent };
  }

  // ===========================================================================
  // SCENARIO 8 — Same-provider/slot stress at scale (progressive)
  // ===========================================================================
  async function scenarioSameSlotStress(n: number) {
    console.log(`\n=== SCENARIO 8: ${n} patients, same nurse pool (1 nurse), same time slot, concurrent auto-assign ===`);
    const { user: nurse } = await createNurse(Roles.NURSE);
    const scheduledAt = nextSlot();

    const visits = [];
    for (let i = 0; i < n; i++) {
      const patient = await createPatient();
      const visit = await HomeVisitService.createRequest(
        patient._id.toString(),
        bookingInput(HomeVisitServiceTypes.NURSE, scheduledAt),
      );
      visits.push(visit);
    }

    const start = Date.now();
    const results = await Promise.allSettled(
      visits.map((v) => HomeVisitService.autoAssignStaff(v.id)),
    );
    const elapsed = Date.now() - start;

    const fulfilled = results.filter((r) => r.status === "fulfilled").length;
    const finalVisits = await HomeVisitModel.find({ _id: { $in: visits.map((v) => v.id) } }).lean();
    const assignedVisits = finalVisits.filter((v) => v.status === HomeVisitStatuses.ASSIGNED && v.assignedStaffId);
    // The real signal (independent of which specific staff member the matcher picks,
    // which can drift across scenarios sharing one ephemeral DB): does ANY staff
    // member end up assigned to more than one of these same-time-slot visits?
    const perStaffCount = new Map<string, number>();
    for (const v of assignedVisits) {
      const id = v.assignedStaffId!.toString();
      perStaffCount.set(id, (perStaffCount.get(id) ?? 0) + 1);
    }
    const maxAssignedToOneStaff = Math.max(0, ...perStaffCount.values());
    const distinctStaffUsed = perStaffCount.size;

    console.log(`  n=${n} elapsed=${elapsed}ms fulfilled=${fulfilled} distinctStaffAssigned=${distinctStaffUsed} maxVisitsOnOneStaffAtSameTime=${maxAssignedToOneStaff} (must be 1 if capacity=1/staff/slot)`);

    return { n, fulfilled, distinctStaffUsed, maxAssignedToOneStaff, doubleBooked: maxAssignedToOneStaff > 1 };
  }

  // ---------------------------------------------------------------------------
  // Run everything
  // ---------------------------------------------------------------------------
  const s1 = await scenarioSequentialNurseDoubleAssign();
  const s2 = await scenarioSequentialManualDoubleAssign();
  const s3results = [];
  for (const n of [2, 5, 10]) {
    s3results.push(await scenarioConcurrentAutoAssignRace(n));
  }
  const s4 = await scenarioConcurrentSameVisitAssign();
  const s5 = await scenarioConcurrentCheckout();
  const s6 = await scenarioConcurrentResolveCancellation();
  const s7 = await scenarioStatusEndpointAssignedGap();
  const s8results = [];
  for (const n of [10, 25, 50]) {
    s8results.push(await scenarioSameSlotStress(n));
  }

  console.log("\n\n===================== SUMMARY =====================");
  console.log(JSON.stringify({ s1, s2, s3results, s4, s5, s6, s7, s8results }, null, 2));

  await mongooseMod.disconnect();
  await mongod.stop();
  console.log("\nDone. Ephemeral MongoDB stopped and discarded.");
}

main().catch(async (e) => {
  console.error("SCRIPT ERROR:", e);
  process.exit(1);
});
