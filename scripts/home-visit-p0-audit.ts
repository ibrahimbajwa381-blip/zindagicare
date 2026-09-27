/**
 * Home Visits — P0 audit extension: authorization matrix, fuzz/malformed
 * input handling, date/location boundaries, and high-concurrency stress
 * (100/250-way) + the 100-patient main stress test + payment/cancel/assign/
 * refund races.
 *
 * Runs OUTSIDE next/jest deliberately (see scripts/home-visit-concurrency-test.ts
 * for why: this repo's next.config.ts + next/jest's config-ts require-hook has
 * a confirmed, reproducible defect that throws spurious
 * "Invariant: AsyncLocalStorage accessed in runtime where it is not available"
 * errors from unrelated lazy module loads inside the Jest worker process —
 * verified NOT to be a Home Visits bug (see bugs.txt, TEST-INFRA-001).
 * mongodb-memory-server (ephemeral, local, never Atlas/production) + the REAL
 * @zindagi/database models + REAL HomeVisitService. No mocks of the service
 * under test.
 *
 * Run: cd apps/web && npx tsx ../../scripts/home-visit-p0-audit.ts
 */
import { MongoMemoryServer } from "mongodb-memory-server";
import { randomBytes } from "crypto";

function isAppError(err: unknown): err is { statusCode: number; message?: string } {
  return !!err && typeof err === "object" && "statusCode" in err;
}

async function main() {
  const mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri("zindagi_home_visit_p0_audit");
  process.env.FIELD_ENCRYPTION_KEY = randomBytes(32).toString("base64");

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
  const { createHomeVisitSchema, assignHomeVisitSchema, updateHomeVisitStatusSchema } =
    await import("@zindagi/validators");

  await connectDatabase();
  await HomeVisitModel.init();
  await PaymentModel.init();

  const { HomeVisitService } = await import("@/server/services/home-visit.service");

  let counter = 0;
  const makePhone = (tag: string, n: number) => `+92${tag}${n.toString().padStart(9, "0")}`;

  async function createPatient() {
    counter += 1;
    return UserModel.create({
      name: `Audit Patient ${counter}`,
      email: `audit-patient-${counter}-${Date.now()}@example.com`,
      phone: makePhone("30", counter),
      roles: ["patient"],
      isActive: true,
    });
  }
  async function createAdmin() {
    counter += 1;
    return UserModel.create({
      name: `Audit Admin ${counter}`,
      email: `audit-admin-${counter}-${Date.now()}@example.com`,
      phone: makePhone("31", counter),
      roles: ["admin"],
      isActive: true,
    });
  }
  async function createNurse(lng = 74.3587, lat = 31.5204) {
    counter += 1;
    const user = await UserModel.create({
      name: `Audit Nurse ${counter}`,
      email: `audit-nurse-${counter}-${Date.now()}@example.com`,
      phone: makePhone("32", counter),
      roles: [Roles.NURSE],
      isActive: true,
    });
    await StaffProfileModel.create({
      userId: user._id,
      staffType: Roles.NURSE,
      homeVisitEnabled: true,
      isAvailable: true,
      verificationStatus: "approved",
      serviceAreas: [{ city: "Lahore", area: "DHA", geo: { type: "Point", coordinates: [lng, lat] }, radiusKm: 15 }],
    });
    return user;
  }
  async function createDoctor() {
    counter += 1;
    const user = await UserModel.create({
      name: `Audit Doctor ${counter}`,
      email: `audit-doctor-${counter}-${Date.now()}@example.com`,
      phone: makePhone("33", counter),
      roles: ["doctor"],
      isActive: true,
    });
    await DoctorProfileModel.create({
      userId: user._id,
      isListed: true,
      verificationStatus: VerificationStatuses.APPROVED,
      consultationFee: 1500,
      specialties: ["General Physician"],
      coverageCities: ["Lahore"],
      homeVisitEnabled: true,
      homeVisitLocation: { area: "DHA", geo: { type: "Point", coordinates: [74.3587, 31.5204] } },
      weeklyAvailability: Array.from({ length: 7 }, (_, dayOfWeek) => ({
        dayOfWeek,
        startTimeLocal: "00:00",
        endTimeLocal: "23:40",
      })),
    });
    return user;
  }

  let slotCounter = 0;
  const nextSlot = () => {
    slotCounter += 1;
    return new Date(Date.now() + slotCounter * 5 * 60 * 60 * 1000);
  };

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

  const report: Record<string, unknown> = {};

  // ===========================================================================
  // SECTION 10 — AUTHORIZATION MATRIX
  // ===========================================================================
  async function authMatrix() {
    const results: Record<string, unknown> = {};
    const patientA = await createPatient();
    const patientB = await createPatient();
    const nurse = await createNurse();
    const otherNurse = await createNurse(80, 40); // far away, uninvolved
    const admin = await createAdmin();

    const visit = await HomeVisitService.createRequest(
      patientA._id.toString(),
      bookingInput(HomeVisitServiceTypes.NURSE, nextSlot()),
    );
    await HomeVisitService.autoAssignStaff(visit.id);

    // view: stranger patient cannot view
    try {
      await HomeVisitService.getById(visit.id, patientB._id.toString(), ["patient"]);
      results.strangerCanView = true; // BUG if true
    } catch (e) {
      results.strangerCanView = false;
      results.strangerViewStatus = isAppError(e) ? e.statusCode : "RAW";
    }
    // view: uninvolved staff cannot view
    try {
      await HomeVisitService.getById(visit.id, otherNurse._id.toString(), ["nurse"]);
      results.uninvolvedStaffCanView = true; // BUG if true
    } catch (e) {
      results.uninvolvedStaffCanView = false;
      results.uninvolvedStaffViewStatus = isAppError(e) ? e.statusCode : "RAW";
    }
    // view: assigned staff CAN view
    try {
      await HomeVisitService.getById(visit.id, nurse._id.toString(), ["nurse"]);
      results.assignedStaffCanView = true;
    } catch {
      results.assignedStaffCanView = false; // would be a bug (legit staff blocked)
    }
    // view: admin CAN view
    try {
      await HomeVisitService.getById(visit.id, admin._id.toString(), ["admin"]);
      results.adminCanView = true;
    } catch {
      results.adminCanView = false; // bug if admin blocked
    }
    // cancel: stranger cannot cancel
    try {
      await HomeVisitService.updateStatus(visit.id, patientB._id.toString(), ["patient"], {
        status: HomeVisitStatuses.CANCELLED,
      } as never);
      results.strangerCanCancel = true; // BUG if true
    } catch (e) {
      results.strangerCanCancel = false;
      results.strangerCancelStatus = isAppError(e) ? e.statusCode : "RAW";
    }
    // update status: uninvolved staff cannot progress status
    try {
      await HomeVisitService.updateStatus(visit.id, otherNurse._id.toString(), ["nurse"], {
        status: HomeVisitStatuses.EN_ROUTE,
      } as never);
      results.uninvolvedStaffCanProgress = true; // BUG if true
    } catch (e) {
      results.uninvolvedStaffCanProgress = false;
      results.uninvolvedStaffProgressStatus = isAppError(e) ? e.statusCode : "RAW";
    }
    // refund resolve: non-admin cannot resolve
    try {
      await HomeVisitService.resolveCancellationRequest(visit.id, patientA._id.toString(), "approve");
      results.patientCanResolveRefund = true; // BUG if true (would also 409 anyway since none pending, but check role gating path first)
    } catch (e) {
      results.patientCanResolveRefund = false;
      results.patientResolveRefundStatus = isAppError(e) ? e.statusCode : "RAW";
    }
    // checkout: stranger cannot initiate checkout on someone else's visit
    const visit2 = await HomeVisitService.createRequest(
      patientA._id.toString(),
      bookingInput(HomeVisitServiceTypes.NURSE, nextSlot()),
    );
    try {
      await HomeVisitService.initiateCheckout(visit2.id, patientB._id.toString());
      results.strangerCanCheckout = true; // BUG if true
    } catch (e) {
      results.strangerCanCheckout = false;
      results.strangerCheckoutStatus = isAppError(e) ? e.statusCode : "RAW";
    }
    return results;
  }
  report.authMatrix = await authMatrix();

  // ===========================================================================
  // SECTION 11 — FUZZ / MALFORMED INPUT
  // ===========================================================================
  async function fuzzInputs() {
    const results: Record<string, unknown> = {};
    const patient = await createPatient();

    // Schema-level fuzz
    const badCreateInputs: [string, unknown][] = [
      ["null_serviceType", bookingInput(null as never, nextSlot())],
      ["missing_geo", { ...bookingInput(HomeVisitServiceTypes.NURSE, nextSlot()), geo: undefined }],
      ["wrong_type_geo", { ...bookingInput(HomeVisitServiceTypes.NURSE, nextSlot()), geo: "not-an-object" }],
      ["oversized_addressLine", bookingInput(HomeVisitServiceTypes.NURSE, nextSlot(), { addressLine: "a".repeat(5000) })],
      ["empty_addressLine", bookingInput(HomeVisitServiceTypes.NURSE, nextSlot(), { addressLine: "" })],
      ["lat_out_of_range", bookingInput(HomeVisitServiceTypes.NURSE, nextSlot(), { geo: { lng: 74, lat: 999 } })],
      ["lng_out_of_range", bookingInput(HomeVisitServiceTypes.NURSE, nextSlot(), { geo: { lng: -9999, lat: 31 } })],
      ["lat_wrong_type", bookingInput(HomeVisitServiceTypes.NURSE, nextSlot(), { geo: { lng: 74, lat: "31" } })],
      ["unexpected_extra_field", { ...bookingInput(HomeVisitServiceTypes.NURSE, nextSlot()), isAdmin: true, pricing: { total: 1 } }],
    ];
    for (const [name, input] of badCreateInputs) {
      try {
        createHomeVisitSchema.parse(input);
        results[`create_${name}`] = "ACCEPTED (unexpected)";
      } catch {
        results[`create_${name}`] = "REJECTED (clean)";
      }
    }

    // Service-level fuzz: malformed/invalid ObjectIds against real service calls
    const badIds = ["", "not-an-objectid", "123", "x".repeat(24), "000000000000000000000000"];
    for (const id of badIds) {
      try {
        await HomeVisitService.getById(id, patient._id.toString(), ["patient"]);
        results[`getById_${id || "empty"}`] = "ACCEPTED (unexpected)";
      } catch (e) {
        results[`getById_${id || "empty"}`] = isAppError(e)
          ? `CLEAN ${e.statusCode}`
          : `RAW CRASH: ${e instanceof Error ? e.constructor.name + ": " + e.message : String(e)}`;
      }
    }
    for (const id of badIds) {
      try {
        await HomeVisitService.updateStatus(id, patient._id.toString(), ["patient"], {
          status: HomeVisitStatuses.CANCELLED,
        } as never);
        results[`updateStatus_${id || "empty"}`] = "ACCEPTED (unexpected)";
      } catch (e) {
        results[`updateStatus_${id || "empty"}`] = isAppError(e)
          ? `CLEAN ${e.statusCode}`
          : `RAW CRASH: ${e instanceof Error ? e.constructor.name + ": " + e.message : String(e)}`;
      }
    }
    for (const id of badIds) {
      try {
        await HomeVisitService.initiateCheckout(id, patient._id.toString());
        results[`checkout_${id || "empty"}`] = "ACCEPTED (unexpected)";
      } catch (e) {
        results[`checkout_${id || "empty"}`] = isAppError(e)
          ? `CLEAN ${e.statusCode}`
          : `RAW CRASH: ${e instanceof Error ? e.constructor.name + ": " + e.message : String(e)}`;
      }
    }
    // assignHomeVisitSchema fuzz
    const badAssignInputs: [string, unknown][] = [
      ["missing_staffId_no_auto", {}],
      ["null_staffId", { staffId: null }],
      ["wrong_type_staffId", { staffId: 12345 }],
      ["unexpected_field", { staffId: "x", admin: true }],
    ];
    for (const [name, input] of badAssignInputs) {
      try {
        assignHomeVisitSchema.parse(input);
        results[`assignSchema_${name}`] = "ACCEPTED";
      } catch {
        results[`assignSchema_${name}`] = "REJECTED (clean)";
      }
    }
    // updateHomeVisitStatusSchema fuzz
    const badStatusInputs: [string, unknown][] = [
      ["invalid_status_string", { status: "not_a_real_status" }],
      ["null_status", { status: null }],
      ["missing_status", {}],
      ["status_wrong_type", { status: 123 }],
    ];
    for (const [name, input] of badStatusInputs) {
      try {
        updateHomeVisitStatusSchema.parse(input);
        results[`statusSchema_${name}`] = "ACCEPTED";
      } catch {
        results[`statusSchema_${name}`] = "REJECTED (clean)";
      }
    }
    return results;
  }
  report.fuzz = await fuzzInputs();

  // ===========================================================================
  // SECTION 15 — DATE / TIME BOUNDARY
  // ===========================================================================
  async function dateTimeBoundary() {
    const results: Record<string, unknown> = {};
    const patient = await createPatient();
    const cases: [string, Date][] = [
      ["1s_past", new Date(Date.now() - 1000)],
      ["1s_future", new Date(Date.now() + 5 * 3600 * 1000 + 1000)],
      ["exact_now", new Date(Date.now())],
      ["midnight_boundary", new Date(new Date(Date.now() + 24 * 3600 * 1000).setUTCHours(0, 0, 0, 0))],
      ["month_transition", new Date(Date.now() + 40 * 24 * 3600 * 1000)],
      ["far_future_1yr", new Date(Date.now() + 365 * 24 * 3600 * 1000)],
    ];
    for (const [name, date] of cases) {
      try {
        const res = await HomeVisitService.createRequest(
          patient._id.toString(),
          bookingInput(HomeVisitServiceTypes.NURSE, date),
        );
        const doc = await HomeVisitModel.findById(res.id).lean();
        results[name] = {
          accepted: true,
          persistedScheduledAtISO: doc?.scheduledAt?.toISOString(),
          inputISO: date.toISOString(),
          matches: doc?.scheduledAt?.toISOString() === date.toISOString(),
        };
      } catch (e) {
        results[name] = { accepted: false, statusCode: isAppError(e) ? e.statusCode : "RAW" };
      }
    }
    return results;
  }
  report.dateTimeBoundary = await dateTimeBoundary();

  // ===========================================================================
  // SECTION 16 — LOCATION BOUNDARY (radius-based staff matching — the ONLY
  // location gate that actually exists in this codebase; see HOME-003 above)
  // ===========================================================================
  async function locationBoundary() {
    const results: Record<string, unknown> = {};
    const { HOME_CARE_MATCH_RADIUS_KM } = await import("@zindagi/shared");
    const nurseLng = 74.3587;
    const nurseLat = 31.5204;
    await createNurse(nurseLng, nurseLat);

    function pointAtDistanceKm(km: number) {
      // ~111.32 km per degree latitude
      const dLat = km / 111.32;
      return { lng: nurseLng, lat: nurseLat + dLat };
    }

    const cases: [string, number][] = [
      ["just_inside_radius", HOME_CARE_MATCH_RADIUS_KM - 0.5],
      ["exact_radius", HOME_CARE_MATCH_RADIUS_KM],
      ["just_outside_radius", HOME_CARE_MATCH_RADIUS_KM + 0.5],
      ["far_outside", HOME_CARE_MATCH_RADIUS_KM + 50],
    ];
    for (const [name, km] of cases) {
      const patient = await createPatient();
      const point = pointAtDistanceKm(km);
      const visit = await HomeVisitService.createRequest(
        patient._id.toString(),
        bookingInput(HomeVisitServiceTypes.NURSE, nextSlot(), { geo: point }),
      );
      try {
        const assign = await HomeVisitService.autoAssignStaff(visit.id);
        results[name] = { distanceKmRequested: km, matched: true, actualDistanceKm: assign.distanceKm };
      } catch (e) {
        results[name] = { distanceKmRequested: km, matched: false, statusCode: isAppError(e) ? e.statusCode : "RAW" };
      }
    }
    return results;
  }
  report.locationBoundary = await locationBoundary();

  // ===========================================================================
  // SECTION 7 — PAYMENT + BOOKING RACE
  // ===========================================================================
  async function paymentBookingRace() {
    const patient = await createPatient();
    const visit = await HomeVisitService.createRequest(
      patient._id.toString(),
      bookingInput(HomeVisitServiceTypes.NURSE, nextSlot()),
    );
    const checkout = await HomeVisitService.initiateCheckout(visit.id, patient._id.toString());

    // Concurrently: submit manual receipt (pay), cancel, and retry checkout.
    const results = await Promise.allSettled([
      HomeVisitService.submitManualReceipt(checkout.paymentId, patient._id.toString(), {
        storageKey: "k", url: "https://example.com/r.jpg", originalName: "r.jpg", mimeType: "image/jpeg",
      }),
      HomeVisitService.updateStatus(visit.id, patient._id.toString(), ["patient"], {
        status: HomeVisitStatuses.CANCELLED,
      } as never),
      HomeVisitService.initiateCheckout(visit.id, patient._id.toString()),
    ]);

    const finalVisit = await HomeVisitModel.findById(visit.id).lean();
    const finalPayment = await PaymentModel.findById(checkout.paymentId).lean();
    const impossibleState =
      finalVisit?.status === HomeVisitStatuses.CANCELLED &&
      finalPayment?.status === PaymentStatuses.PAID &&
      !finalVisit?.cancellationRequestStatus;
    let rawError: unknown = null;
    for (const r of results) if (r.status === "rejected" && !isAppError(r.reason)) rawError = r.reason;

    return {
      outcomes: results.map((r) => (r.status === "fulfilled" ? "fulfilled" : isAppError(r.reason) ? `rejected(${r.reason.statusCode})` : "RAW")),
      finalVisitStatus: finalVisit?.status,
      finalPaymentStatus: finalPayment?.status,
      cancellationRequestStatus: finalVisit?.cancellationRequestStatus,
      impossibleState_paidCancelledWithoutRefundTracking: impossibleState,
      hadRawError: !!rawError,
    };
  }
  report.paymentBookingRace = await paymentBookingRace();

  // ===========================================================================
  // SECTION 8 — CANCEL + ASSIGN RACE
  // ===========================================================================
  async function cancelAssignRace() {
    const patient = await createPatient();
    const nurse = await createNurse();
    const visit = await HomeVisitService.createRequest(
      patient._id.toString(),
      bookingInput(HomeVisitServiceTypes.NURSE, nextSlot()),
    );

    const results = await Promise.allSettled([
      HomeVisitService.updateStatus(visit.id, patient._id.toString(), ["patient"], {
        status: HomeVisitStatuses.CANCELLED,
      } as never),
      HomeVisitService.assignStaff(visit.id, { staffId: nurse._id.toString() }),
    ]);

    const finalVisit = await HomeVisitModel.findById(visit.id).lean();
    const corrupted =
      finalVisit?.status === HomeVisitStatuses.CANCELLED && !!finalVisit?.assignedStaffId;
    let rawError: unknown = null;
    for (const r of results) if (r.status === "rejected" && !isAppError(r.reason)) rawError = r.reason;

    return {
      outcomes: results.map((r) => (r.status === "fulfilled" ? "fulfilled" : isAppError(r.reason) ? `rejected(${r.reason.statusCode})` : "RAW")),
      finalStatus: finalVisit?.status,
      finalAssignedStaffId: finalVisit?.assignedStaffId?.toString(),
      corrupted_cancelledButStillAssigned: corrupted,
      hadRawError: !!rawError,
    };
  }
  report.cancelAssignRace = await cancelAssignRace();

  // ===========================================================================
  // SECTION 9 — REFUND RACE at scale (10/25/50/100)
  // ===========================================================================
  async function refundRace(n: number) {
    const patient = await createPatient();
    const admin = await createAdmin();
    const visit = await HomeVisitService.createRequest(
      patient._id.toString(),
      bookingInput(HomeVisitServiceTypes.NURSE, nextSlot()),
    );
    const checkout = await HomeVisitService.initiateCheckout(visit.id, patient._id.toString());
    await HomeVisitService.submitManualReceipt(checkout.paymentId, patient._id.toString(), {
      storageKey: "k", url: "https://example.com/r.jpg", originalName: "r.jpg", mimeType: "image/jpeg",
    });
    await HomeVisitService.updateStatus(visit.id, patient._id.toString(), ["patient"], {
      status: HomeVisitStatuses.CANCELLED,
      refundMethod: "bank",
      refundAccountTitle: "Audit Patient",
      refundAccountNumber: "1234567890",
    } as never);

    const results = await Promise.allSettled(
      Array.from({ length: n }, () => HomeVisitService.resolveCancellationRequest(visit.id, admin._id.toString(), "approve")),
    );
    const fulfilled = results.filter((r) => r.status === "fulfilled").length;
    const rawErrors = results.filter((r) => r.status === "rejected" && !isAppError((r as PromiseRejectedResult).reason)).length;
    const finalPayment = await PaymentModel.findById(checkout.paymentId).lean();

    return { n, fulfilled, rawErrors, finalPaymentStatus: finalPayment?.status, exactlyOneLogicalRefund: fulfilled === 1 };
  }
  report.refundRace = [];
  for (const n of [10, 25, 50, 100]) {
    (report.refundRace as unknown[]).push(await refundRace(n));
  }

  // ===========================================================================
  // CRITICAL PROVIDER RACE — extended to 100 and 250
  // ===========================================================================
  async function sameSlotStress(n: number) {
    const nurse = await createNurse();
    const scheduledAt = nextSlot();
    const visits = [];
    for (let i = 0; i < n; i++) {
      const patient = await createPatient();
      visits.push(await HomeVisitService.createRequest(patient._id.toString(), bookingInput(HomeVisitServiceTypes.NURSE, scheduledAt)));
    }
    const start = Date.now();
    const results = await Promise.allSettled(visits.map((v) => HomeVisitService.autoAssignStaff(v.id)));
    const elapsed = Date.now() - start;
    const fulfilled = results.filter((r) => r.status === "fulfilled").length;
    const rawErrors = results.filter((r) => r.status === "rejected" && !isAppError((r as PromiseRejectedResult).reason)).length;
    const finalVisits = await HomeVisitModel.find({ _id: { $in: visits.map((v) => v.id) } }).lean();
    const assignedToNurse = finalVisits.filter((v) => v.assignedStaffId?.toString() === nurse._id.toString() && v.status === HomeVisitStatuses.ASSIGNED);
    return { n, elapsedMs: elapsed, fulfilled, rawErrors, assignedCount: assignedToNurse.length, doubleBooked: assignedToNurse.length > 1, zeroSuccesses: assignedToNurse.length === 0 };
  }
  report.sameSlotStress = [];
  for (const n of [100, 250]) {
    (report.sameSlotStress as unknown[]).push(await sameSlotStress(n));
  }

  // ===========================================================================
  // SECTION 18 — MAIN HOME-VISIT STRESS TEST: 100 unique patients, several
  // providers/services/time slots, released concurrently.
  // ===========================================================================
  async function mainStressTest() {
    const NUM_PATIENTS = 100;
    const NUM_NURSES = 5;
    const NUM_DOCTORS = 3;
    const NUM_SLOTS = 4;

    const nurses = [];
    for (let i = 0; i < NUM_NURSES; i++) nurses.push(await createNurse());
    const doctors = [];
    for (let i = 0; i < NUM_DOCTORS; i++) doctors.push(await createDoctor());

    const slots = Array.from({ length: NUM_SLOTS }, () => nextSlot());

    const patients = [];
    for (let i = 0; i < NUM_PATIENTS; i++) patients.push(await createPatient());

    const bookings = await Promise.allSettled(
      patients.map((p, i) => {
        const isDoctorReq = i % 3 === 0;
        const slot = slots[i % NUM_SLOTS];
        return HomeVisitService.createRequest(
          p._id.toString(),
          bookingInput(isDoctorReq ? HomeVisitServiceTypes.DOCTOR_VISIT : HomeVisitServiceTypes.NURSE, slot, { autoAssign: true }),
        );
      }),
    );

    const createdOk = bookings.filter((b) => b.status === "fulfilled").length;
    const createFailedRaw = bookings.filter((b) => b.status === "rejected" && !isAppError((b as PromiseRejectedResult).reason)).length;

    const allVisits = await HomeVisitModel.find({ patientId: { $in: patients.map((p) => p._id) } }).lean();
    const assignedVisits = allVisits.filter((v) => v.status === HomeVisitStatuses.ASSIGNED && v.assignedStaffId);

    // Per (staff, overlapping-time-window) — detect any staff double-booked
    // across DIFFERENT slots that are within the 2h conflict window (here,
    // slots are 5h apart, so only same-slot collisions matter).
    const perStaffPerSlot = new Map<string, number>();
    for (const v of assignedVisits) {
      const key = `${v.assignedStaffId!.toString()}|${v.scheduledAt.toISOString()}`;
      perStaffPerSlot.set(key, (perStaffPerSlot.get(key) ?? 0) + 1);
    }
    const maxPerStaffSlot = Math.max(0, ...perStaffPerSlot.values());

    const payments = await PaymentModel.find({}).lean();
    const paymentInconsistencies = payments.filter(
      (p) => (p.metadata as { kind?: string } | undefined)?.kind === "home_visit" && p.status === "paid" && !p.userId,
    ).length;

    return {
      requestsSent: NUM_PATIENTS,
      uniquePatients: NUM_PATIENTS,
      createdOk,
      createFailedRaw,
      totalVisitsInDb: allVisits.length,
      assignedVisits: assignedVisits.length,
      maxVisitsOnOneStaffAtSameSlot: maxPerStaffSlot,
      slotConflicts: maxPerStaffSlot > 1 ? maxPerStaffSlot - 1 : 0,
      paymentInconsistencies,
      dbCountMatchesCreatedOk: allVisits.length === createdOk,
    };
  }
  report.mainStressTest = await mainStressTest();

  console.log("\n\n===================== P0 AUDIT REPORT =====================");
  console.log(JSON.stringify(report, null, 2));

  await mongooseMod.disconnect();
  await mongod.stop();
}

main().catch(async (e) => {
  console.error("SCRIPT ERROR:", e);
  process.exit(1);
});
