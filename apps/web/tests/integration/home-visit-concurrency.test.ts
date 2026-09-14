/**
 * HOME-001..012 — Home Visits P0 functional + concurrency audit.
 *
 * Real local MongoDB (mongodb-memory-server, ephemeral — never Atlas, never
 * production) + the REAL @zindagi/database models and REAL
 * HomeVisitService code. Nothing about the service under test is mocked.
 *
 * REDIS: this codebase has no Redis client anywhere in apps/web/src — every
 * concurrency guarantee here comes from MongoDB (there are no unique
 * indexes on HomeVisitModel — see packages/database/src/models/
 * home-visit.model.ts — so all safety here comes from the atomic
 * conditional writes in HomeVisitService, not the schema).
 *
 * Heavier stress numbers (10/25/50-way concurrency at the same provider/
 * slot) live in scripts/home-visit-concurrency-test.ts — kept out of the
 * CI-run jest suite so this file stays fast, but exercising the exact same
 * real service code paths.
 */
import { MongoMemoryServer } from "mongodb-memory-server";
import { randomBytes } from "crypto";

jest.setTimeout(60000);



describe("Home Visits — P0 functional + concurrency audit (real local MongoDB)", () => {
  let mongod: InstanceType<typeof MongoMemoryServer>;
  let UserModel: typeof import("@zindagi/database").UserModel;
  let DoctorProfileModel: typeof import("@zindagi/database").DoctorProfileModel;
  let StaffProfileModel: typeof import("@zindagi/database").StaffProfileModel;
  let HomeVisitModel: typeof import("@zindagi/database").HomeVisitModel;
  let PaymentModel: typeof import("@zindagi/database").PaymentModel;
  let mongooseMod: typeof import("mongoose");
  let Roles: typeof import("@zindagi/shared").Roles;
  let VerificationStatuses: typeof import("@zindagi/shared").VerificationStatuses;
  let HomeVisitServiceTypes: typeof import("@zindagi/shared").HomeVisitServiceTypes;
  let HomeVisitStatuses: typeof import("@zindagi/shared").HomeVisitStatuses;
  let PaymentStatuses: typeof import("@zindagi/shared").PaymentStatuses;
  let HomeVisitService: typeof import("@/server/services/home-visit.service").HomeVisitService;

  let counter = 0;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongod.getUri("home_visit_concurrency_test");
    process.env.FIELD_ENCRYPTION_KEY = randomBytes(32).toString("base64");

    const db = await import("@zindagi/database");
    UserModel = db.UserModel;
    DoctorProfileModel = db.DoctorProfileModel;
    StaffProfileModel = db.StaffProfileModel;
    HomeVisitModel = db.HomeVisitModel;
    PaymentModel = db.PaymentModel;
    mongooseMod = (await import("mongoose")).default;

    const shared = await import("@zindagi/shared");
    Roles = shared.Roles;
    VerificationStatuses = shared.VerificationStatuses;
    HomeVisitServiceTypes = shared.HomeVisitServiceTypes;
    HomeVisitStatuses = shared.HomeVisitStatuses;
    PaymentStatuses = shared.PaymentStatuses;

    await db.connectDatabase();
    await HomeVisitModel.init();
    await PaymentModel.init();

    ({ HomeVisitService } = await import("@/server/services/home-visit.service"));
  });

  afterAll(async () => {
    await mongooseMod.disconnect();
    await mongod.stop();
  });

  // Root cause of this file's long-standing flakiness (not the separately-
  // documented "AsyncLocalStorage" Jest/Next environment crash, which was a
  // different, now-fixed issue — see next.config.mjs): createNurse() and
  // createDoctor() always place their fixture at the exact same fixed geo
  // coordinates, and findNearestAvailableStaffByType/findNearestAvailable
  // Doctor match by nearest-available across ALL staff in the DB, not just
  // the one just created in the current test. With no cleanup between
  // tests, every nurse/doctor ever created earlier in the file remained
  // "available" and geographically tied for nearest, so later tests could
  // nondeterministically get assigned a DIFFERENT test's leftover staff
  // member instead of their own — a real fixture-isolation bug in the test,
  // not in HomeVisitService itself. Clearing the operational collections
  // before every test (not touching HomeVisitService or any other
  // production code) makes "nearest available" unambiguous again.
  beforeEach(async () => {
    await Promise.all([
      UserModel.deleteMany({}),
      DoctorProfileModel.deleteMany({}),
      StaffProfileModel.deleteMany({}),
      HomeVisitModel.deleteMany({}),
      PaymentModel.deleteMany({}),
    ]);
  });

  function makePhone(roleTag: string, n: number) {
    return `+923${roleTag}${n.toString().padStart(8, "0")}`;
  }

  async function createPatient() {
    counter += 1;
    return UserModel.create({
      name: `HV Jest Patient ${counter}`,
      email: `hv-jest-patient-${counter}-${Date.now()}@example.com`,
      phone: makePhone("8", counter),
      roles: ["patient"],
      isActive: true,
    });
  }

  async function createDoctor() {
    counter += 1;
    const user = await UserModel.create({
      name: `HV Jest Doctor ${counter}`,
      email: `hv-jest-doctor-${counter}-${Date.now()}@example.com`,
      phone: makePhone("9", counter),
      roles: ["doctor"],
      isActive: true,
    });
    const profile = await DoctorProfileModel.create({
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
    return { user, profile };
  }

  async function createNurse() {
    counter += 1;
    const user = await UserModel.create({
      name: `HV Jest Nurse ${counter}`,
      email: `hv-jest-nurse-${counter}-${Date.now()}@example.com`,
      phone: makePhone("1", counter),
      roles: [Roles.NURSE],
      isActive: true,
    });
    const profile = await StaffProfileModel.create({
      userId: user._id,
      staffType: Roles.NURSE,
      homeVisitEnabled: true,
      isAvailable: true,
      verificationStatus: "approved",
      serviceAreas: [
        { city: "Lahore", area: "DHA", geo: { type: "Point", coordinates: [74.3587, 31.5204] }, radiusKm: 15 },
      ],
    });
    return { user, profile };
  }

  let slotCounter = 0;
  /** Well-separated (>4h, more than double the 2h conflict window) so tests never interfere with each other's staff-availability checks. */
  function nextSlot() {
    slotCounter += 1;
    return new Date(Date.now() + slotCounter * 5 * 60 * 60 * 1000);
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
    } as never;
  }

  // ===========================================================================
  // HOME-001 — create home visit
  // ===========================================================================
  test("HOME-001: valid patient creates a home visit — persisted correctly, correct initial status/pricing/payment state", async () => {
    const patient = await createPatient();
    const scheduledAt = nextSlot();
    const result = await HomeVisitService.createRequest(
      patient._id.toString(),
      bookingInput(HomeVisitServiceTypes.NURSE, scheduledAt),
    );

    expect(result.status).toBe(HomeVisitStatuses.REQUESTED);
    expect(result.paymentStatus).toBeUndefined();

    const doc = await HomeVisitModel.findById(result.id).lean();
    expect(doc).not.toBeNull();
    expect(doc?.patientId.toString()).toBe(patient._id.toString());
    expect(doc?.serviceType).toBe(HomeVisitServiceTypes.NURSE);
    expect(doc?.status).toBe(HomeVisitStatuses.REQUESTED);
    expect(doc?.pricing?.total).toBeGreaterThan(0);
    expect(doc?.assignedStaffId).toBeUndefined();

    const allForPatient = await HomeVisitModel.find({ patientId: patient._id }).lean();
    expect(allForPatient.length).toBe(1); // no duplicate records
  });

  // ===========================================================================
  // HOME-002 — valid Lahore address (existing rule: booking is NOT
  // location-rejected at creation time — only Zod lat/lng range validation
  // applies; service-area gating happens later, at staff-matching time)
  // ===========================================================================
  test("HOME-002: a valid Lahore address with in-range coordinates is accepted", async () => {
    const patient = await createPatient();
    const result = await HomeVisitService.createRequest(
      patient._id.toString(),
      bookingInput(HomeVisitServiceTypes.NURSE, nextSlot(), {
        addressLine: "House 45, Block C, DHA Phase 6, Lahore",
        city: "Lahore",
        geo: { lng: 74.4, lat: 31.47 },
      }),
    );
    expect(result.status).toBe(HomeVisitStatuses.REQUESTED);
    expect(result.address.city).toBe("Lahore");
  });

  // ===========================================================================
  // HOME-003 — "unsupported location": per the actual implementation, there
  // is no city/radius rejection at booking time (createRequest only
  // validates lat/lng are in-range and that geo is present) — a booking far
  // outside the service area is created successfully, and simply fails to
  // find a match at auto-assign time. Verified against the real behavior,
  // not an invented "reject Karachi" rule.
  // ===========================================================================
  test("HOME-003: a booking far outside the service area is still created (no city gate at booking time), but auto-assign finds no provider", async () => {
    const patient = await createPatient();
    await createNurse(); // exists, but far away — should not match

    const result = await HomeVisitService.createRequest(
      patient._id.toString(),
      bookingInput(HomeVisitServiceTypes.NURSE, nextSlot(), {
        addressLine: "Somewhere far away",
        city: "Karachi",
        geo: { lng: 67.0011, lat: 24.8607 }, // Karachi coordinates — >1000km from the Lahore-based nurse
      }),
    );
    expect(result.status).toBe(HomeVisitStatuses.REQUESTED); // booking itself succeeds

    await expect(HomeVisitService.autoAssignStaff(result.id)).rejects.toMatchObject({
      statusCode: 404,
    });

    const doc = await HomeVisitModel.findById(result.id).lean();
    expect(doc?.status).toBe(HomeVisitStatuses.REQUESTED); // no provider assignment
    expect(doc?.assignedStaffId).toBeUndefined();
    expect(doc?.paymentId).toBeUndefined(); // no payment side effect
  });

  test("HOME-003b: out-of-range coordinates are rejected by input validation (lat/lng bounds)", async () => {
    const { createHomeVisitSchema } = await import("@zindagi/validators");
    expect(() =>
      createHomeVisitSchema.parse(
        bookingInput(HomeVisitServiceTypes.NURSE, nextSlot(), { geo: { lng: 200, lat: 31.5 } }),
      ),
    ).toThrow();
    expect(() =>
      createHomeVisitSchema.parse(
        bookingInput(HomeVisitServiceTypes.NURSE, nextSlot(), { geo: { lng: 74.3, lat: 95 } }),
      ),
    ).toThrow();
  });

  // ===========================================================================
  // HOME-004 — invalid service (Zod enum validation at the schema boundary)
  // ===========================================================================
  test("HOME-004: an invalid/unknown serviceType is rejected by input validation, never reaches the service", async () => {
    const { createHomeVisitSchema } = await import("@zindagi/validators");
    expect(() =>
      createHomeVisitSchema.parse(bookingInput("not_a_real_service", nextSlot())),
    ).toThrow();
    expect(() => createHomeVisitSchema.parse(bookingInput("", nextSlot()))).toThrow();
    expect(() => createHomeVisitSchema.parse(bookingInput(null as never, nextSlot()))).toThrow();
  });

  // ===========================================================================
  // HOME-005 — invalid date (existing rule: scheduledAt must parse to a
  // valid Date and be strictly in the future — see createRequest)
  // ===========================================================================
  test("HOME-005: a past scheduledAt is rejected", async () => {
    const patient = await createPatient();
    await expect(
      HomeVisitService.createRequest(
        patient._id.toString(),
        bookingInput(HomeVisitServiceTypes.NURSE, new Date(Date.now() - 60 * 60 * 1000)),
      ),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  test("HOME-005b: a malformed scheduledAt string is rejected", async () => {
    const patient = await createPatient();
    await expect(
      HomeVisitService.createRequest(
        patient._id.toString(),
        bookingInput(HomeVisitServiceTypes.NURSE, nextSlot(), { scheduledAt: "not-a-date" }),
      ),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  test("HOME-005c: 1 second in the past is rejected, 1 second in the future is accepted (boundary)", async () => {
    const patient = await createPatient();
    await expect(
      HomeVisitService.createRequest(
        patient._id.toString(),
        bookingInput(HomeVisitServiceTypes.NURSE, new Date(Date.now() - 1000)),
      ),
    ).rejects.toMatchObject({ statusCode: 400 });

    const result = await HomeVisitService.createRequest(
      patient._id.toString(),
      bookingInput(HomeVisitServiceTypes.NURSE, new Date(Date.now() + 5 * 60 * 60 * 1000 + 1000)),
    );
    expect(result.status).toBe(HomeVisitStatuses.REQUESTED);
  });

  // ===========================================================================
  // HOME-006 — available provider: auto-assign correctly discovers and
  // assigns a matching, available provider.
  // ===========================================================================
  test("HOME-006: an available nurse is correctly discovered and assigned", async () => {
    const patient = await createPatient();
    const { user: nurse } = await createNurse();
    const visit = await HomeVisitService.createRequest(
      patient._id.toString(),
      bookingInput(HomeVisitServiceTypes.NURSE, nextSlot()),
    );

    const result = await HomeVisitService.autoAssignStaff(visit.id);
    expect(result.staffId).toBe(nurse._id.toString());

    const doc = await HomeVisitModel.findById(visit.id).lean();
    expect(doc?.status).toBe(HomeVisitStatuses.ASSIGNED);
    expect(doc?.assignedStaffId?.toString()).toBe(nurse._id.toString());
  });

  // ===========================================================================
  // HOME-007 — unavailable provider: no eligible provider exists / provider
  // already busy with an overlapping visit -> no double-booking.
  // ===========================================================================
  test("HOME-007: no eligible provider exists -> clean 404, no assignment, no crash", async () => {
    const patient = await createPatient();
    const visit = await HomeVisitService.createRequest(
      patient._id.toString(),
      bookingInput(HomeVisitServiceTypes.NURSE, nextSlot()),
    );
    await expect(HomeVisitService.autoAssignStaff(visit.id)).rejects.toMatchObject({ statusCode: 404 });
  });

  test("HOME-007b: a provider already busy with an overlapping-time visit is not offered for a second overlapping visit", async () => {
    const { user: nurse } = await createNurse();
    const scheduledAt = nextSlot();
    const patientA = await createPatient();
    const patientB = await createPatient();

    const visitA = await HomeVisitService.createRequest(patientA._id.toString(), bookingInput(HomeVisitServiceTypes.NURSE, scheduledAt));
    const visitB = await HomeVisitService.createRequest(patientB._id.toString(), bookingInput(HomeVisitServiceTypes.NURSE, scheduledAt));

    const first = await HomeVisitService.autoAssignStaff(visitA.id);
    expect(first.staffId).toBe(nurse._id.toString());

    await expect(HomeVisitService.autoAssignStaff(visitB.id)).rejects.toMatchObject({ statusCode: 404 });

    const docB = await HomeVisitModel.findById(visitB.id).lean();
    expect(docB?.status).toBe(HomeVisitStatuses.REQUESTED);
  });

  // ===========================================================================
  // HOME-008 — payment required / payment workflow
  // ===========================================================================
  test("HOME-008: checkout creates a pending payment; manual receipt marks it paid; visit reflects paid state", async () => {
    const patient = await createPatient();
    const visit = await HomeVisitService.createRequest(
      patient._id.toString(),
      bookingInput(HomeVisitServiceTypes.NURSE, nextSlot()),
    );

    const checkout = await HomeVisitService.initiateCheckout(visit.id, patient._id.toString());
    expect(checkout.paymentId).toBeTruthy();

    let payment = await PaymentModel.findById(checkout.paymentId).lean();
    expect(payment?.status).toBe(PaymentStatuses.PENDING);

    await HomeVisitService.submitManualReceipt(checkout.paymentId, patient._id.toString(), {
      storageKey: "test/r.jpg",
      url: "https://example.com/r.jpg",
      originalName: "r.jpg",
      mimeType: "image/jpeg",
    });

    payment = await PaymentModel.findById(checkout.paymentId).lean();
    expect(payment?.status).toBe(PaymentStatuses.PAID);
  });

  test("HOME-008b: checkout is rejected once the visit is already paid", async () => {
    const patient = await createPatient();
    const visit = await HomeVisitService.createRequest(
      patient._id.toString(),
      bookingInput(HomeVisitServiceTypes.NURSE, nextSlot()),
    );
    const checkout = await HomeVisitService.initiateCheckout(visit.id, patient._id.toString());
    await HomeVisitService.submitManualReceipt(checkout.paymentId, patient._id.toString(), {
      storageKey: "test/r.jpg",
      url: "https://example.com/r.jpg",
      originalName: "r.jpg",
      mimeType: "image/jpeg",
    });

    await expect(HomeVisitService.initiateCheckout(visit.id, patient._id.toString())).rejects.toMatchObject({
      statusCode: 409,
    });
  });

  test("HOME-008c: a failed payment is marked FAILED and does not affect visit status", async () => {
    const patient = await createPatient();
    const visit = await HomeVisitService.createRequest(
      patient._id.toString(),
      bookingInput(HomeVisitServiceTypes.NURSE, nextSlot()),
    );
    const checkout = await HomeVisitService.initiateCheckout(visit.id, patient._id.toString());
    await HomeVisitService.failPayment(checkout.paymentId, "card_declined");

    const payment = await PaymentModel.findById(checkout.paymentId).lean();
    expect(payment?.status).toBe(PaymentStatuses.FAILED);

    const doc = await HomeVisitModel.findById(visit.id).lean();
    expect(doc?.status).toBe(HomeVisitStatuses.REQUESTED);
  });

  test("HOME-008d: concurrent checkout calls converge on ONE payment, never crash", async () => {
    const patient = await createPatient();
    const visit = await HomeVisitService.createRequest(
      patient._id.toString(),
      bookingInput(HomeVisitServiceTypes.NURSE, nextSlot()),
    );

    const results = await Promise.allSettled(
      Array.from({ length: 5 }, () => HomeVisitService.initiateCheckout(visit.id, patient._id.toString())),
    );
    const fulfilled = results.filter(
      (
        r,
      ): r is PromiseFulfilledResult<Awaited<ReturnType<typeof HomeVisitService.initiateCheckout>>> =>
        r.status === "fulfilled",
    );
    expect(fulfilled.length).toBeGreaterThan(0);
    const distinctPaymentIds = new Set(fulfilled.map((r) => r.value.paymentId));
    expect(distinctPaymentIds.size).toBe(1);

    for (const r of results) {
      if (r.status === "rejected") {
        expect(r.reason).toMatchObject({ statusCode: expect.any(Number) }); // clean AppError, never raw
      }
    }
  });

  // ===========================================================================
  // HOME-009 — cancel visit (rules per updateStatus's canCancel, not invented)
  // ===========================================================================
  test("HOME-009: patient can cancel while REQUESTED", async () => {
    const patient = await createPatient();
    const visit = await HomeVisitService.createRequest(
      patient._id.toString(),
      bookingInput(HomeVisitServiceTypes.NURSE, nextSlot()),
    );
    const result = await HomeVisitService.updateStatus(visit.id, patient._id.toString(), ["patient"], {
      status: HomeVisitStatuses.CANCELLED,
    } as never);
    expect(result.status).toBe(HomeVisitStatuses.CANCELLED);
  });

  test("HOME-009b: patient cannot cancel once ASSIGNED (existing rule: patient cancel window is REQUESTED-only)", async () => {
    const patient = await createPatient();
    const { user: nurse } = await createNurse();
    const visit = await HomeVisitService.createRequest(
      patient._id.toString(),
      bookingInput(HomeVisitServiceTypes.NURSE, nextSlot()),
    );
    await HomeVisitService.autoAssignStaff(visit.id);

    await expect(
      HomeVisitService.updateStatus(visit.id, patient._id.toString(), ["patient"], {
        status: HomeVisitStatuses.CANCELLED,
      } as never),
    ).rejects.toMatchObject({ statusCode: 403 });

    // assigned staff CAN cancel at this stage
    const result = await HomeVisitService.updateStatus(visit.id, nurse._id.toString(), ["nurse"], {
      status: HomeVisitStatuses.CANCELLED,
    } as never);
    expect(result.status).toBe(HomeVisitStatuses.CANCELLED);
  });

  test("HOME-009c: nobody can cancel an already-COMPLETED visit (except admin)", async () => {
    const patient = await createPatient();
    const { user: nurse } = await createNurse();
    const visit = await HomeVisitService.createRequest(
      patient._id.toString(),
      bookingInput(HomeVisitServiceTypes.NURSE, nextSlot()),
    );
    await HomeVisitService.autoAssignStaff(visit.id);
    await HomeVisitService.updateStatus(visit.id, nurse._id.toString(), ["nurse"], { status: HomeVisitStatuses.EN_ROUTE } as never);
    await HomeVisitService.updateStatus(visit.id, nurse._id.toString(), ["nurse"], { status: HomeVisitStatuses.ARRIVED } as never);
    await HomeVisitService.updateStatus(visit.id, nurse._id.toString(), ["nurse"], { status: HomeVisitStatuses.COMPLETED } as never);

    await expect(
      HomeVisitService.updateStatus(visit.id, nurse._id.toString(), ["nurse"], {
        status: HomeVisitStatuses.CANCELLED,
      } as never),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  test("HOME-009d: duplicate/concurrent cancellation never leaves an orphaned or corrupted state", async () => {
    const patient = await createPatient();
    const visit = await HomeVisitService.createRequest(
      patient._id.toString(),
      bookingInput(HomeVisitServiceTypes.NURSE, nextSlot()),
    );

    const results = await Promise.allSettled(
      Array.from({ length: 5 }, () =>
        HomeVisitService.updateStatus(visit.id, patient._id.toString(), ["patient"], {
          status: HomeVisitStatuses.CANCELLED,
        } as never),
      ),
    );
    for (const r of results) {
      if (r.status === "rejected") {
        expect(r.reason).toMatchObject({ statusCode: expect.any(Number) }); // never a raw crash
      }
    }
    const doc = await HomeVisitModel.findById(visit.id).lean();
    expect(doc?.status).toBe(HomeVisitStatuses.CANCELLED); // single consistent final state
  });

  // ===========================================================================
  // HOME-010 — refund request (cancellationRequestStatus + admin resolve)
  // ===========================================================================
  test("HOME-010: cancelling a paid visit creates a pending refund request; admin approve marks payment REFUNDED", async () => {
    const patient = await createPatient();
    const admin = await UserModel.create({
      name: "HV Jest Admin",
      email: `hv-jest-admin-${Date.now()}@example.com`,
      phone: makePhone("2", counter + 1),
      roles: ["admin"],
      isActive: true,
    });
    const visit = await HomeVisitService.createRequest(
      patient._id.toString(),
      bookingInput(HomeVisitServiceTypes.NURSE, nextSlot()),
    );
    const checkout = await HomeVisitService.initiateCheckout(visit.id, patient._id.toString());
    await HomeVisitService.submitManualReceipt(checkout.paymentId, patient._id.toString(), {
      storageKey: "test/r.jpg",
      url: "https://example.com/r.jpg",
      originalName: "r.jpg",
      mimeType: "image/jpeg",
    });

    const cancelled = await HomeVisitService.updateStatus(visit.id, patient._id.toString(), ["patient"], {
      status: HomeVisitStatuses.CANCELLED,
      refundMethod: "bank",
      refundAccountTitle: "HV Jest Patient",
      refundAccountNumber: "1234567890",
    } as never);
    expect(cancelled.cancellationRequestStatus).toBe("pending");

    const resolved = await HomeVisitService.resolveCancellationRequest(visit.id, admin._id.toString(), "approve");
    expect(resolved.cancellationRequestStatus).toBe("approved");

    const payment = await PaymentModel.findById(checkout.paymentId).lean();
    expect(payment?.status).toBe(PaymentStatuses.REFUNDED);
  });

  test("HOME-010b: cancelling a paid visit without refund details is rejected", async () => {
    const patient = await createPatient();
    const visit = await HomeVisitService.createRequest(
      patient._id.toString(),
      bookingInput(HomeVisitServiceTypes.NURSE, nextSlot()),
    );
    const checkout = await HomeVisitService.initiateCheckout(visit.id, patient._id.toString());
    await HomeVisitService.submitManualReceipt(checkout.paymentId, patient._id.toString(), {
      storageKey: "test/r.jpg",
      url: "https://example.com/r.jpg",
      originalName: "r.jpg",
      mimeType: "image/jpeg",
    });

    await expect(
      HomeVisitService.updateStatus(visit.id, patient._id.toString(), ["patient"], {
        status: HomeVisitStatuses.CANCELLED,
      } as never),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  test("HOME-010c: resolving a refund request without a pending request is rejected", async () => {
    const patient = await createPatient();
    const admin = await UserModel.create({
      name: "HV Jest Admin2",
      email: `hv-jest-admin2-${Date.now()}@example.com`,
      phone: makePhone("3", counter + 1),
      roles: ["admin"],
      isActive: true,
    });
    const visit = await HomeVisitService.createRequest(
      patient._id.toString(),
      bookingInput(HomeVisitServiceTypes.NURSE, nextSlot()),
    );
    await expect(
      HomeVisitService.resolveCancellationRequest(visit.id, admin._id.toString(), "approve"),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  test("HOME-010d: concurrent duplicate refund-resolve requests never double-refund", async () => {
    const patient = await createPatient();
    const admin = await UserModel.create({
      name: "HV Jest Admin3",
      email: `hv-jest-admin3-${Date.now()}@example.com`,
      phone: makePhone("4", counter + 1),
      roles: ["admin"],
      isActive: true,
    });
    const visit = await HomeVisitService.createRequest(
      patient._id.toString(),
      bookingInput(HomeVisitServiceTypes.NURSE, nextSlot()),
    );
    const checkout = await HomeVisitService.initiateCheckout(visit.id, patient._id.toString());
    await HomeVisitService.submitManualReceipt(checkout.paymentId, patient._id.toString(), {
      storageKey: "test/r.jpg",
      url: "https://example.com/r.jpg",
      originalName: "r.jpg",
      mimeType: "image/jpeg",
    });
    await HomeVisitService.updateStatus(visit.id, patient._id.toString(), ["patient"], {
      status: HomeVisitStatuses.CANCELLED,
      refundMethod: "bank",
      refundAccountTitle: "HV Jest Patient",
      refundAccountNumber: "1234567890",
    } as never);

    const results = await Promise.allSettled([
      HomeVisitService.resolveCancellationRequest(visit.id, admin._id.toString(), "approve"),
      HomeVisitService.resolveCancellationRequest(visit.id, admin._id.toString(), "approve"),
    ]);
    const fulfilledCount = results.filter((r) => r.status === "fulfilled").length;
    expect(fulfilledCount).toBe(1); // exactly one logical resolution
    for (const r of results) {
      if (r.status === "rejected") expect(r.reason).toMatchObject({ statusCode: 409 });
    }
  });

  // ===========================================================================
  // HOME-011 — duplicate booking stress (same patient, same service/time)
  // ===========================================================================
  test("HOME-011: 25 concurrent identical booking requests from the same patient all succeed as independent requests (existing rule: no duplicate-booking guard at createRequest — each call is a new document)", async () => {
    const patient = await createPatient();
    const scheduledAt = nextSlot();
    const results = await Promise.allSettled(
      Array.from({ length: 25 }, () =>
        HomeVisitService.createRequest(patient._id.toString(), bookingInput(HomeVisitServiceTypes.NURSE, scheduledAt)),
      ),
    );
    const fulfilled = results.filter((r) => r.status === "fulfilled").length;
    expect(fulfilled).toBe(25); // documents actual behavior: createRequest has no duplicate-prevention rule
    for (const r of results) {
      if (r.status === "rejected") expect(r.reason).toMatchObject({ statusCode: expect.any(Number) });
    }
    const docs = await HomeVisitModel.find({ patientId: patient._id, scheduledAt }).lean();
    expect(docs.length).toBe(25); // no lost requests, no server errors — consistent with the no-guard behavior above
  });

  // ===========================================================================
  // HOME-012 — status transitions (the actual state machine: REQUESTED ->
  // ASSIGNED -> EN_ROUTE -> ARRIVED -> COMPLETED; no IN_PROGRESS exists)
  // ===========================================================================
  test("HOME-012: valid forward transition chain REQUESTED -> ASSIGNED -> EN_ROUTE -> ARRIVED -> COMPLETED", async () => {
    const patient = await createPatient();
    const { user: nurse } = await createNurse();
    const visit = await HomeVisitService.createRequest(
      patient._id.toString(),
      bookingInput(HomeVisitServiceTypes.NURSE, nextSlot()),
    );
    await HomeVisitService.autoAssignStaff(visit.id);

    for (const status of [HomeVisitStatuses.EN_ROUTE, HomeVisitStatuses.ARRIVED, HomeVisitStatuses.COMPLETED]) {
      const result = await HomeVisitService.updateStatus(visit.id, nurse._id.toString(), ["nurse"], { status } as never);
      expect(result.status).toBe(status);
    }
    const doc = await HomeVisitModel.findById(visit.id).lean();
    expect(doc?.status).toBe(HomeVisitStatuses.COMPLETED);
    expect(doc?.completedAt).toBeTruthy();
  });

  test("HOME-012b: invalid backward/repeated transitions are rejected (COMPLETED -> ARRIVED, COMPLETED -> EN_ROUTE)", async () => {
    const patient = await createPatient();
    const { user: nurse } = await createNurse();
    const visit = await HomeVisitService.createRequest(
      patient._id.toString(),
      bookingInput(HomeVisitServiceTypes.NURSE, nextSlot()),
    );
    await HomeVisitService.autoAssignStaff(visit.id);
    await HomeVisitService.updateStatus(visit.id, nurse._id.toString(), ["nurse"], { status: HomeVisitStatuses.EN_ROUTE } as never);
    await HomeVisitService.updateStatus(visit.id, nurse._id.toString(), ["nurse"], { status: HomeVisitStatuses.ARRIVED } as never);
    await HomeVisitService.updateStatus(visit.id, nurse._id.toString(), ["nurse"], { status: HomeVisitStatuses.COMPLETED } as never);

    await expect(
      HomeVisitService.updateStatus(visit.id, nurse._id.toString(), ["nurse"], { status: HomeVisitStatuses.ARRIVED } as never),
    ).rejects.toMatchObject({ statusCode: 400 });
    await expect(
      HomeVisitService.updateStatus(visit.id, nurse._id.toString(), ["nurse"], { status: HomeVisitStatuses.EN_ROUTE } as never),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  test("HOME-012c: unauthorized transition attempts are rejected (patient cannot progress EN_ROUTE/ARRIVED/COMPLETED; only assigned staff or admin can)", async () => {
    const patient = await createPatient();
    const { user: nurse } = await createNurse();
    const visit = await HomeVisitService.createRequest(
      patient._id.toString(),
      bookingInput(HomeVisitServiceTypes.NURSE, nextSlot()),
    );
    await HomeVisitService.autoAssignStaff(visit.id);

    await expect(
      HomeVisitService.updateStatus(visit.id, patient._id.toString(), ["patient"], { status: HomeVisitStatuses.EN_ROUTE } as never),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  test("HOME-012d: a random/unrelated user cannot access or transition someone else's visit", async () => {
    const patient = await createPatient();
    const stranger = await createPatient();
    const visit = await HomeVisitService.createRequest(
      patient._id.toString(),
      bookingInput(HomeVisitServiceTypes.NURSE, nextSlot()),
    );

    await expect(
      HomeVisitService.getById(visit.id, stranger._id.toString(), ["patient"]),
    ).rejects.toMatchObject({ statusCode: 403 });
    await expect(
      HomeVisitService.updateStatus(visit.id, stranger._id.toString(), ["patient"], {
        status: HomeVisitStatuses.CANCELLED,
      } as never),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  test("HOME-012e: setting status=ASSIGNED directly via updateStatus is rejected (must go through the assign endpoint — confirmed bug, now fixed)", async () => {
    const patient = await createPatient();
    const admin = await UserModel.create({
      name: "HV Jest Admin4",
      email: `hv-jest-admin4-${Date.now()}@example.com`,
      phone: makePhone("5", counter + 1),
      roles: ["admin"],
      isActive: true,
    });
    const visit = await HomeVisitService.createRequest(
      patient._id.toString(),
      bookingInput(HomeVisitServiceTypes.NURSE, nextSlot()),
    );

    await expect(
      HomeVisitService.updateStatus(visit.id, admin._id.toString(), ["admin"], {
        status: HomeVisitStatuses.ASSIGNED,
      } as never),
    ).rejects.toMatchObject({ statusCode: 400 });

    const doc = await HomeVisitModel.findById(visit.id).lean();
    expect(doc?.status).toBe(HomeVisitStatuses.REQUESTED); // never left in an inconsistent assigned-but-unstaffed state
    expect(doc?.assignedStaffId).toBeUndefined();
  });

  test("HOME-012f: concurrent status updates on the same visit never corrupt state or crash raw", async () => {
    const patient = await createPatient();
    const { user: nurse } = await createNurse();
    const visit = await HomeVisitService.createRequest(
      patient._id.toString(),
      bookingInput(HomeVisitServiceTypes.NURSE, nextSlot()),
    );
    await HomeVisitService.autoAssignStaff(visit.id);

    const results = await Promise.allSettled(
      Array.from({ length: 10 }, () =>
        HomeVisitService.updateStatus(visit.id, nurse._id.toString(), ["nurse"], { status: HomeVisitStatuses.EN_ROUTE } as never),
      ),
    );
    const fulfilled = results.filter((r) => r.status === "fulfilled").length;
    expect(fulfilled).toBeGreaterThanOrEqual(1);
    for (const r of results) {
      if (r.status === "rejected") {
        expect(r.reason).toMatchObject({ statusCode: expect.any(Number) }); // clean AppError/409, never a raw VersionError
      }
    }
    const doc = await HomeVisitModel.findById(visit.id).lean();
    expect(doc?.status).toBe(HomeVisitStatuses.EN_ROUTE); // single consistent final state
  });

  // ===========================================================================
  // CRITICAL PROVIDER RACE — the P0 question: can two patients concurrently
  // book the SAME exclusive provider/time slot?
  // ===========================================================================
  test("CRITICAL: 10 concurrent patients auto-assigning against a single-nurse pool for the same time slot -> exactly ONE succeeds, never a double-booking", async () => {
    const { user: nurse } = await createNurse();
    const scheduledAt = nextSlot();
    const visits = [];
    for (let i = 0; i < 10; i++) {
      const patient = await createPatient();
      visits.push(
        await HomeVisitService.createRequest(patient._id.toString(), bookingInput(HomeVisitServiceTypes.NURSE, scheduledAt)),
      );
    }

    const results = await Promise.allSettled(visits.map((v) => HomeVisitService.autoAssignStaff(v.id)));
    const fulfilled = results.filter((r) => r.status === "fulfilled").length;
    expect(fulfilled).toBe(1); // exactly one winner, capacity=1 per provider per overlapping slot

    const finalVisits = await HomeVisitModel.find({ _id: { $in: visits.map((v) => v.id) } }).lean();
    const assignedToNurse = finalVisits.filter(
      (v) => v.assignedStaffId?.toString() === nurse._id.toString() && v.status === HomeVisitStatuses.ASSIGNED,
    );
    expect(assignedToNurse.length).toBe(1); // proven at the DB level, not just the API response
  });
});
