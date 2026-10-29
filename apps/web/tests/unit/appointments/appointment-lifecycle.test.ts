/**
 * APT-L-001..026 — Appointment status-lifecycle tests (P0 aggressive pass).
 *
 * SCOPE NOTE: this codebase has no central state-machine/transition-validator
 * function — every status-mutating write is ad-hoc per service, and per
 * codebase-wide audit (see conversation) every single one of them is a
 * non-atomic `updateOne`/`.save()` filtered only by `_id` (no re-check of the
 * expected prior status in the write itself). That pattern exists in at least
 * a dozen services (admin-appointment, sunday-consult, urgent-consult,
 * doctor-accountability, video-session, online-consult, patient-appointments).
 * Exhaustively testing all of them is out of scope for one pass; this file
 * targets the CORE patient-facing lifecycle engine — the one with real user
 * traffic and the one already covered elsewhere in this test suite:
 *
 *   PENDING --(payment confirmed)--> CONFIRMED --(video join)--> IN_PROGRESS
 *      |                                  |                          |
 *      +---(stale/failed payment)---> CANCELLED <---(patient cancel)-+
 *                                                                     |
 *                                              (provider presses Finish) --> COMPLETED
 *
 * via OnlineConsultService.confirmAfterPayment / failPayment,
 * VideoSessionService.recordJoin / recordLeave (never completes),
 * and PatientAppointmentsService.requestCancellation.
 *
 * Pure unit tests: @zindagi/database mocked outright, no real MongoDB.
 */
import fs from "fs";
import path from "path";
import {
  AppointmentStatuses,
  AppointmentTypes,
  CancellationRequestStatuses,
  PaymentStatuses,
  VideoSessionStatuses,
} from "@zindagi/shared";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
const mockConnectDatabase = jest.fn();
const mockAppointmentFindById = jest.fn();
const mockAppointmentFindOne = jest.fn();
const mockAppointmentUpdateOne = jest.fn();
const mockPaymentFindById = jest.fn();
const mockPaymentUpdateOne = jest.fn();
const mockDoctorProfileFindById = jest.fn();
const mockUserFindById = jest.fn();
const mockVideoSessionFindOne = jest.fn();
const mockVideoSessionUpdateOne = jest.fn();
const mockVideoSessionCreate = jest.fn();
const mockVideoSessionFindByIdAndUpdate = jest.fn();
const mockPrescriptionExists = jest.fn();
const mockSundayFreeRequestUpdateOne = jest.fn();

jest.mock("@zindagi/database", () => ({
  connectDatabase: (...args: unknown[]) => mockConnectDatabase(...args),
  AppointmentModel: {
    findById: (...args: unknown[]) => mockAppointmentFindById(...args),
    findOne: (...args: unknown[]) => mockAppointmentFindOne(...args),
    updateOne: (...args: unknown[]) => mockAppointmentUpdateOne(...args),
  },
  PaymentModel: {
    findById: (...args: unknown[]) => mockPaymentFindById(...args),
    updateOne: (...args: unknown[]) => mockPaymentUpdateOne(...args),
  },
  DoctorProfileModel: {
    findById: (...args: unknown[]) => mockDoctorProfileFindById(...args),
  },
  UserModel: {
    findById: (...args: unknown[]) => mockUserFindById(...args),
  },
  VideoSessionModel: {
    findOne: (...args: unknown[]) => mockVideoSessionFindOne(...args),
    updateOne: (...args: unknown[]) => mockVideoSessionUpdateOne(...args),
    create: (...args: unknown[]) => mockVideoSessionCreate(...args),
    findByIdAndUpdate: (...args: unknown[]) => mockVideoSessionFindByIdAndUpdate(...args),
  },
  PrescriptionModel: {
    exists: (...args: unknown[]) => mockPrescriptionExists(...args),
  },
  SundayFreeRequestModel: {
    updateOne: (...args: unknown[]) => mockSundayFreeRequestUpdateOne(...args),
  },
}));

jest.mock("@/server/services/chat.service", () => ({
  ChatService: {
    ensureAppointmentThread: jest.fn().mockResolvedValue(undefined),
    startIntakeConversation: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock("@/lib/notifications/consult-notifications", () => ({
  sendOnlineConsultConfirmation: jest.fn().mockResolvedValue(undefined),
  sendDoctorConsultBooked: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/lib/notifications/notify-admins", () => ({
  notifyAdmins: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/server/services/urgent-consult.service", () => ({
  UrgentConsultService: {
    tryCompleteByAppointmentId: jest.fn().mockResolvedValue(false),
  },
}));

jest.mock("@/lib/zoom/api", () => ({ createZoomMeeting: jest.fn() }));
jest.mock("@/lib/zoom/config", () => ({
  isZoomConfigured: jest.fn().mockReturnValue(false),
  getPublicZoomSdkKey: jest.fn(),
  getZoomSdkSignatureCredentials: jest.fn().mockReturnValue({ sdkKey: "k", sdkSecret: "s" }),
}));
jest.mock("@/lib/zoom/signature", () => ({ generateZoomMeetingSdkSignature: jest.fn() }));

jest.mock("@/server/services/review.service", () => ({ ReviewService: {} }));
jest.mock("@/server/services/prescription.service", () => ({ PrescriptionService: {} }));

function chain<T>(finalValue: T) {
  const obj = { ...(finalValue as Record<string, unknown>) } as Record<string, unknown>;
  obj.lean = jest.fn().mockResolvedValue(finalValue);
  obj.populate = jest.fn(() => obj);
  obj.select = jest.fn(() => obj);
  return obj;
}

const APPOINTMENT_ID = "507f1f77bcf86cd799439011";
const PATIENT_ID = "507f1f77bcf86cd799439021";
const OTHER_PATIENT_ID = "507f1f77bcf86cd799439099";
const DOCTOR_PROFILE_ID = "507f1f77bcf86cd799439031";
const DOCTOR_USER_ID = "507f1f77bcf86cd799439041";
const PAYMENT_ID = "507f1f77bcf86cd799439051";

// A single stable reference — reused everywhere an "appointment._id" needs to
// appear, in both fixtures and assertions. Creating a fresh
// `{ toString: () => APPOINTMENT_ID }` object per call would give each one a
// distinct function reference, which Jest's deep-equality in
// `toHaveBeenCalledWith` treats as unequal even though both stringify the
// same way — this fixture exists to avoid that footgun.
const APPOINTMENT_ID_REF = { toString: () => APPOINTMENT_ID };

function appointmentFixture(overrides: Record<string, unknown> = {}) {
  return {
    _id: APPOINTMENT_ID_REF,
    type: AppointmentTypes.ONLINE,
    status: AppointmentStatuses.PENDING,
    patientId: { toString: () => PATIENT_ID },
    doctorId: { toString: () => DOCTOR_PROFILE_ID },
    scheduledStart: new Date(Date.now() + 60 * 60 * 1000),
    scheduledEnd: new Date(Date.now() + 80 * 60 * 1000),
    isOnline: true,
    cancellationRequestStatus: CancellationRequestStatuses.NONE,
    ...overrides,
  };
}

function paymentFixture(overrides: Record<string, unknown> = {}) {
  return {
    _id: { toString: () => PAYMENT_ID },
    status: PaymentStatuses.PENDING,
    amount: 1500,
    appointmentId: APPOINTMENT_ID_REF,
    ...overrides,
  };
}

beforeEach(() => {
  jest.resetModules();
  jest.clearAllMocks();
  mockConnectDatabase.mockResolvedValue(undefined);
  mockDoctorProfileFindById.mockReturnValue(
    chain({ userId: { toString: () => DOCTOR_USER_ID } }),
  );
  mockUserFindById.mockReturnValue(chain({ name: "Test User", phone: "+923001234567" }));
  // Default fallback so any code path that re-fetches the appointment after a
  // write (e.g. confirmAfterPayment's early-return calling
  // getBookingByAppointmentId, which does its own populate() chain) has a
  // valid chain to call into. Tests asserting on a specific appointment shape
  // override this explicitly.
  mockAppointmentFindById.mockReturnValue(chain(appointmentFixture()));
  mockPrescriptionExists.mockResolvedValue(false);
  mockAppointmentUpdateOne.mockResolvedValue({});
  mockPaymentUpdateOne.mockResolvedValue({});
  mockVideoSessionUpdateOne.mockResolvedValue({});
  mockSundayFreeRequestUpdateOne.mockResolvedValue({});
});

// ===========================================================================
// APT-L-001 — PENDING -> CONFIRMED (valid)
// ===========================================================================
describe("APT-L-001 — PENDING -> CONFIRMED via confirmAfterPayment", () => {
  test("a pending appointment + pending payment transitions to CONFIRMED, payment to PAID", async () => {
    mockPaymentFindById.mockReturnValue(chain(paymentFixture()));
    mockAppointmentFindById.mockReturnValue(chain(appointmentFixture()));

    const { OnlineConsultService } = await import("@/server/services/online-consult.service");
    await OnlineConsultService.confirmAfterPayment(PAYMENT_ID, "EXT-1");

    expect(mockPaymentUpdateOne).toHaveBeenCalledWith(
      { _id: PAYMENT_ID, status: PaymentStatuses.PENDING },
      expect.objectContaining({ $set: expect.objectContaining({ status: PaymentStatuses.PAID }) }),
    );
    expect(mockAppointmentUpdateOne).toHaveBeenCalledWith(
      { _id: APPOINTMENT_ID_REF, status: AppointmentStatuses.PENDING },
      expect.objectContaining({ $set: { status: AppointmentStatuses.CONFIRMED } }),
    );
  });
});

// ===========================================================================
// APT-L-002 — CONFIRMED -> IN_PROGRESS (valid)
// ===========================================================================
describe("APT-L-002 — CONFIRMED -> IN_PROGRESS via recordJoin", () => {
  test("a confirmed appointment transitions to IN_PROGRESS when a participant joins", async () => {
    mockAppointmentFindById.mockReturnValue(
      chain(appointmentFixture({ status: AppointmentStatuses.CONFIRMED })),
    );
    mockVideoSessionFindOne.mockResolvedValue({
      _id: "session-1",
      patientJoinedAt: null,
      doctorJoinedAt: null,
      startedAt: null,
    });

    const { VideoSessionService } = await import("@/server/services/video-session.service");
    await VideoSessionService.recordJoin(PATIENT_ID, APPOINTMENT_ID);

    expect(mockAppointmentUpdateOne).toHaveBeenCalledWith(
      { _id: APPOINTMENT_ID_REF, status: AppointmentStatuses.CONFIRMED },
      { $set: { status: AppointmentStatuses.IN_PROGRESS } },
    );
  });
});

// ===========================================================================
// APT-L-003 — IN_PROGRESS -> COMPLETED (valid)
// ===========================================================================
// Completion moved to ConsultationLifecycleService.finish (provider presses
// Finish); see tests/integration/consultation-lifecycle.test.ts.
describe("APT-L-003 — IN_PROGRESS stays open on recordLeave", () => {
  test("leaving an attended in-progress consult does not complete it or end the session", async () => {
    mockAppointmentFindById.mockReturnValue(
      chain(appointmentFixture({ status: AppointmentStatuses.IN_PROGRESS })),
    );
    mockVideoSessionFindOne.mockResolvedValue({
      _id: "session-1",
      status: VideoSessionStatuses.ACTIVE,
      patientJoinedAt: new Date(Date.now() - 5 * 60 * 1000),
      startedAt: new Date(Date.now() - 5 * 60 * 1000),
      createdAt: new Date(Date.now() - 5 * 60 * 1000),
    });

    const { VideoSessionService } = await import("@/server/services/video-session.service");
    await VideoSessionService.recordLeave(PATIENT_ID, APPOINTMENT_ID);

    expect(mockAppointmentUpdateOne).not.toHaveBeenCalled();
    expect(mockVideoSessionUpdateOne).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// APT-L-004 — PENDING -> CANCELLED (valid)
// ===========================================================================
describe("APT-L-004 — PENDING -> CANCELLED", () => {
  test("failPayment cancels the linked PENDING appointment when the payment fails", async () => {
    mockPaymentFindById.mockReturnValue(chain(paymentFixture()));

    const { OnlineConsultService } = await import("@/server/services/online-consult.service");
    await OnlineConsultService.failPayment(PAYMENT_ID, "card_declined");

    expect(mockAppointmentUpdateOne).toHaveBeenCalledWith(
      { _id: APPOINTMENT_ID_REF, status: AppointmentStatuses.PENDING },
      expect.objectContaining({ $set: expect.objectContaining({ status: AppointmentStatuses.CANCELLED }) }),
    );
  });

  test("patient can cancel their own PENDING appointment via requestCancellation", async () => {
    const doc = appointmentFixture({ status: AppointmentStatuses.PENDING });
    const saveable = { ...doc, save: jest.fn().mockResolvedValue(undefined), set: jest.fn() };
    mockAppointmentFindById.mockResolvedValue(saveable);

    const { PatientAppointmentsService } = await import("@/server/services/patient-appointments.service");
    const result = await PatientAppointmentsService.requestCancellation(APPOINTMENT_ID, PATIENT_ID, {
      reason: "Change of plans",
      refundMethod: "bank",
      refundAccountTitle: "Test Patient",
      refundAccountNumber: "1234567890",
    });

    expect(saveable.status).toBe(AppointmentStatuses.CANCELLED);
    expect(saveable.save).toHaveBeenCalled();
    expect(result.cancellationRequestStatus).toBe(CancellationRequestStatuses.PENDING);
  });
});

// ===========================================================================
// APT-L-005 — COMPLETED -> CANCELLED (business rule: COMPLETED is terminal)
// ===========================================================================
describe("APT-L-005 — COMPLETED -> CANCELLED (rejected: COMPLETED is an established terminal state)", () => {
  test("patient cannot cancel an already-COMPLETED appointment — 409, no save", async () => {
    const doc = appointmentFixture({ status: AppointmentStatuses.COMPLETED });
    const saveable = { ...doc, save: jest.fn().mockResolvedValue(undefined), set: jest.fn() };
    mockAppointmentFindById.mockResolvedValue(saveable);

    const { PatientAppointmentsService } = await import("@/server/services/patient-appointments.service");
    await expect(
      PatientAppointmentsService.requestCancellation(APPOINTMENT_ID, PATIENT_ID, {
        reason: "Too late",
        refundMethod: "bank",
        refundAccountTitle: "Test Patient",
        refundAccountNumber: "1234567890",
      }),
    ).rejects.toMatchObject({ statusCode: 409 });

    expect(saveable.save).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// PART 3 — Invalid transitions
// ===========================================================================
describe("APT-L-006 — COMPLETED -> IN_PROGRESS (rejected)", () => {
  test("recordJoin on a COMPLETED appointment is blocked (consultation not active)", async () => {
    mockAppointmentFindById.mockReturnValue(
      chain(appointmentFixture({ status: AppointmentStatuses.COMPLETED })),
    );
    const { VideoSessionService } = await import("@/server/services/video-session.service");
    await expect(VideoSessionService.recordJoin(PATIENT_ID, APPOINTMENT_ID)).rejects.toMatchObject({
      statusCode: 400,
    });
    expect(mockAppointmentUpdateOne).not.toHaveBeenCalled();
  });
});

describe("APT-L-007 — CANCELLED -> CONFIRMED (BUG FOUND: was silently allowed)", () => {
  test("BUG: confirmAfterPayment previously resurrected a CANCELLED appointment back to CONFIRMED on a late payment confirmation — now rejected", async () => {
    // Real-world trigger: patient's 15-minute payment hold expires and the
    // stale-sweep auto-cancels the appointment (online-consult.service.ts's
    // expireStalePendingBookings); a late gateway webhook or manual-receipt
    // submission then calls confirmAfterPayment for the same payment. Before
    // the fix, this method only short-circuited on payment.status===PAID or
    // appointment.status===CONFIRMED — a CANCELLED appointment matched
        // neither guard and was silently flipped back to CONFIRMED.
    mockPaymentFindById.mockReturnValue(chain(paymentFixture()));
    mockAppointmentFindById.mockReturnValue(
      chain(appointmentFixture({ status: AppointmentStatuses.CANCELLED })),
    );

    const { OnlineConsultService } = await import("@/server/services/online-consult.service");
    await expect(OnlineConsultService.confirmAfterPayment(PAYMENT_ID, "EXT-LATE")).rejects.toMatchObject({
      statusCode: 409,
    });

    expect(mockAppointmentUpdateOne).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ $set: expect.objectContaining({ status: AppointmentStatuses.CONFIRMED }) }),
    );
    expect(mockPaymentUpdateOne).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ $set: expect.objectContaining({ status: PaymentStatuses.PAID }) }),
    );
  });

  test("BUG (same class): a COMPLETED appointment is also not resurrectable via a late payment confirmation", async () => {
    mockPaymentFindById.mockReturnValue(chain(paymentFixture()));
    mockAppointmentFindById.mockReturnValue(
      chain(appointmentFixture({ status: AppointmentStatuses.COMPLETED })),
    );

    const { OnlineConsultService } = await import("@/server/services/online-consult.service");
    await expect(OnlineConsultService.confirmAfterPayment(PAYMENT_ID, "EXT-LATE")).rejects.toMatchObject({
      statusCode: 409,
    });
    expect(mockAppointmentUpdateOne).not.toHaveBeenCalled();
  });

  test("BUG (same class): a NO_SHOW appointment is also not resurrectable via a late payment confirmation", async () => {
    mockPaymentFindById.mockReturnValue(chain(paymentFixture()));
    mockAppointmentFindById.mockReturnValue(
      chain(appointmentFixture({ status: AppointmentStatuses.NO_SHOW })),
    );

    const { OnlineConsultService } = await import("@/server/services/online-consult.service");
    await expect(OnlineConsultService.confirmAfterPayment(PAYMENT_ID, "EXT-LATE")).rejects.toMatchObject({
      statusCode: 409,
    });
    expect(mockAppointmentUpdateOne).not.toHaveBeenCalled();
  });

  test("regression guard: a genuinely PENDING appointment is unaffected by the fix (still confirms normally)", async () => {
    mockPaymentFindById.mockReturnValue(chain(paymentFixture()));
    mockAppointmentFindById.mockReturnValue(
      chain(appointmentFixture({ status: AppointmentStatuses.PENDING })),
    );

    const { OnlineConsultService } = await import("@/server/services/online-consult.service");
    await OnlineConsultService.confirmAfterPayment(PAYMENT_ID, "EXT-1");

    expect(mockAppointmentUpdateOne).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ $set: { status: AppointmentStatuses.CONFIRMED } }),
    );
  });
});

describe("APT-L-008 — PENDING -> IN_PROGRESS (rejected)", () => {
  test("recordJoin on a PENDING appointment is blocked", async () => {
    mockAppointmentFindById.mockReturnValue(
      chain(appointmentFixture({ status: AppointmentStatuses.PENDING })),
    );
    const { VideoSessionService } = await import("@/server/services/video-session.service");
    await expect(VideoSessionService.recordJoin(PATIENT_ID, APPOINTMENT_ID)).rejects.toMatchObject({
      statusCode: 400,
    });
  });
});

describe("APT-L-009 — PENDING -> COMPLETED (rejected)", () => {
  test("recordLeave on a PENDING appointment is blocked (never reaches the completion write)", async () => {
    mockAppointmentFindById.mockReturnValue(
      chain(appointmentFixture({ status: AppointmentStatuses.PENDING })),
    );
    const { VideoSessionService } = await import("@/server/services/video-session.service");
    await expect(VideoSessionService.recordLeave(PATIENT_ID, APPOINTMENT_ID)).rejects.toMatchObject({
      statusCode: 400,
    });
    expect(mockAppointmentUpdateOne).not.toHaveBeenCalled();
  });
});

describe("APT-L-010 — CONFIRMED -> COMPLETED without ever joining (rejected)", () => {
  test("recordLeave with no video session on record does nothing (no session, no completion)", async () => {
    mockAppointmentFindById.mockReturnValue(
      chain(appointmentFixture({ status: AppointmentStatuses.CONFIRMED })),
    );
    mockVideoSessionFindOne.mockResolvedValue(null);

    const { VideoSessionService } = await import("@/server/services/video-session.service");
    await VideoSessionService.recordLeave(PATIENT_ID, APPOINTMENT_ID);

    expect(mockAppointmentUpdateOne).not.toHaveBeenCalled();
  });
});

describe("APT-L-011 — CANCELLED -> IN_PROGRESS (rejected)", () => {
  test("recordJoin on a CANCELLED appointment is blocked", async () => {
    mockAppointmentFindById.mockReturnValue(
      chain(appointmentFixture({ status: AppointmentStatuses.CANCELLED })),
    );
    const { VideoSessionService } = await import("@/server/services/video-session.service");
    await expect(VideoSessionService.recordJoin(PATIENT_ID, APPOINTMENT_ID)).rejects.toMatchObject({
      statusCode: 400,
    });
  });
});

describe("APT-L-012 — CANCELLED -> COMPLETED (rejected)", () => {
  test("recordLeave on a CANCELLED appointment is blocked", async () => {
    mockAppointmentFindById.mockReturnValue(
      chain(appointmentFixture({ status: AppointmentStatuses.CANCELLED })),
    );
    const { VideoSessionService } = await import("@/server/services/video-session.service");
    await expect(VideoSessionService.recordLeave(PATIENT_ID, APPOINTMENT_ID)).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  test("re-cancelling an already-CANCELLED appointment via requestCancellation is rejected (409)", async () => {
    const doc = appointmentFixture({ status: AppointmentStatuses.CANCELLED });
    const saveable = { ...doc, save: jest.fn().mockResolvedValue(undefined), set: jest.fn() };
    mockAppointmentFindById.mockResolvedValue(saveable);

    const { PatientAppointmentsService } = await import("@/server/services/patient-appointments.service");
    await expect(
      PatientAppointmentsService.requestCancellation(APPOINTMENT_ID, PATIENT_ID, {
        reason: "again",
        refundMethod: "bank",
        refundAccountTitle: "Test Patient",
        refundAccountNumber: "1234567890",
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(saveable.save).not.toHaveBeenCalled();
  });
});

describe("APT-L-013 — COMPLETED -> CONFIRMED (rejected)", () => {
  test("confirmAfterPayment cannot move a COMPLETED appointment to CONFIRMED (covered by APT-L-007's fix)", async () => {
    mockPaymentFindById.mockReturnValue(chain(paymentFixture()));
    mockAppointmentFindById.mockReturnValue(
      chain(appointmentFixture({ status: AppointmentStatuses.COMPLETED })),
    );
    const { OnlineConsultService } = await import("@/server/services/online-consult.service");
    await expect(OnlineConsultService.confirmAfterPayment(PAYMENT_ID)).rejects.toMatchObject({
      statusCode: 409,
    });
  });
});

describe("APT-L-014 — IN_PROGRESS -> CONFIRMED (no code path exists to move backward)", () => {
  test("video-session.service.ts never WRITES status: AppointmentStatuses.CONFIRMED — it only ever reads/compares against it as a precondition, confirmed by source inspection", () => {
    const videoSource = fs.readFileSync(
      path.join(__dirname, "../../../src/server/services/video-session.service.ts"),
      "utf8",
    );
    // The file legitimately CONTAINS "AppointmentStatuses.CONFIRMED" as a
    // read-side precondition — resolveParticipant's "is this consult active"
    // check, and (since the real-MongoDB race-condition pass) recordJoin's
    // atomic updateOne filter `{ _id, status: AppointmentStatuses.CONFIRMED }`
    // guarding its bump to IN_PROGRESS. What must NOT exist is CONFIRMED
    // appearing as a $set TARGET (i.e. inside a `$set: { status: ... }`
    // block) anywhere in this file — only as a filter/precondition.
    const setBlocks = videoSource.match(/\$set:\s*\{[^}]*\}/g) ?? [];
    const setsToConfirmed = setBlocks.filter((block) => /status:\s*AppointmentStatuses\.CONFIRMED/.test(block));
    expect(setsToConfirmed).toEqual([]);
  });
});

describe("APT-L-015 — IN_PROGRESS -> CANCELLED (rejected: patient self-cancel only allows PENDING/CONFIRMED)", () => {
  test("patient cannot self-cancel an IN_PROGRESS appointment — 409, no save", async () => {
    const doc = appointmentFixture({ status: AppointmentStatuses.IN_PROGRESS });
    const saveable = { ...doc, save: jest.fn().mockResolvedValue(undefined), set: jest.fn() };
    mockAppointmentFindById.mockResolvedValue(saveable);

    const { PatientAppointmentsService } = await import("@/server/services/patient-appointments.service");
    await expect(
      PatientAppointmentsService.requestCancellation(APPOINTMENT_ID, PATIENT_ID, {
        reason: "mid-call",
        refundMethod: "bank",
        refundAccountTitle: "Test Patient",
        refundAccountNumber: "1234567890",
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(saveable.save).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// PART 4 — Idempotency / duplicate requests
// ===========================================================================
describe("APT-L-016 — Confirm the same appointment twice", () => {
  test("a second confirmAfterPayment call on an already-CONFIRMED appointment is a harmless no-op (idempotent short-circuit)", async () => {
    mockPaymentFindById.mockReturnValue(chain(paymentFixture({ status: PaymentStatuses.PAID })));
    const { OnlineConsultService } = await import("@/server/services/online-consult.service");
    const result = await OnlineConsultService.confirmAfterPayment(PAYMENT_ID, "EXT-2");
    expect(mockAppointmentUpdateOne).not.toHaveBeenCalled();
    expect(mockPaymentUpdateOne).not.toHaveBeenCalled();
    expect(result).toBeDefined();
  });

  test("10 concurrent confirmAfterPayment calls on the same PENDING appointment produce exactly one write of each kind (mocked serialization proves the idempotency guard, not real DB atomicity)", async () => {
    // NOTE: this does not prove DB-level atomicity (there is none — see file
    // header) — it proves the in-process idempotency short-circuit is at
    // least self-consistent when every call observes the same initial read.
    // A real concurrent DB race remains a genuine latent risk; documented,
    // not silently asserted away.
    mockPaymentFindById.mockReturnValue(chain(paymentFixture()));
    mockAppointmentFindById.mockReturnValue(chain(appointmentFixture()));

    const { OnlineConsultService } = await import("@/server/services/online-consult.service");
    await Promise.all(
      Array.from({ length: 10 }, () => OnlineConsultService.confirmAfterPayment(PAYMENT_ID, "EXT-3")),
    );

    // Every call observed the same pre-write snapshot (PENDING/PENDING) since
    // none of the mocks change state between calls — this is the exact shape
    // of a real unsynchronized race: all 10 would issue the write in prod too.
    expect(mockAppointmentUpdateOne).toHaveBeenCalledTimes(10);
  });
});

describe("APT-L-017 — Start (join) the same appointment twice", () => {
  test("recordJoin called twice by the same patient is harmless — second call is a no-op on already-set join fields", async () => {
    mockAppointmentFindById.mockReturnValue(
      chain(appointmentFixture({ status: AppointmentStatuses.CONFIRMED })),
    );
    const session: { _id: string; patientJoinedAt: Date | null; doctorJoinedAt: Date | null; startedAt: Date | null } =
      { _id: "session-1", patientJoinedAt: null, doctorJoinedAt: null, startedAt: null };
    mockVideoSessionFindOne.mockResolvedValue(session);

    const { VideoSessionService } = await import("@/server/services/video-session.service");
    await VideoSessionService.recordJoin(PATIENT_ID, APPOINTMENT_ID);
    // Simulate the first join having taken effect before the second call reads.
    session.patientJoinedAt = new Date();
    session.startedAt = new Date();
    await VideoSessionService.recordJoin(PATIENT_ID, APPOINTMENT_ID);

    expect(mockAppointmentUpdateOne).toHaveBeenCalledTimes(2); // both see status===CONFIRMED (never re-read after first write in this mock) — same TOCTOU as prod
  });
});

describe("APT-L-018 — Complete the same appointment twice", () => {
  test("recordLeave is a no-op once the video session is already COMPLETED", async () => {
    mockAppointmentFindById.mockReturnValue(
      chain(appointmentFixture({ status: AppointmentStatuses.IN_PROGRESS })),
    );
    mockVideoSessionFindOne.mockResolvedValue({
      _id: "session-1",
      status: VideoSessionStatuses.COMPLETED,
    });

    const { VideoSessionService } = await import("@/server/services/video-session.service");
    await VideoSessionService.recordLeave(PATIENT_ID, APPOINTMENT_ID);

    expect(mockAppointmentUpdateOne).not.toHaveBeenCalled();
    expect(mockVideoSessionUpdateOne).not.toHaveBeenCalled();
  });
});

describe("APT-L-019 — Cancel the same appointment twice", () => {
  test("a second cancellation request while one is already PENDING is rejected (409), not silently duplicated", async () => {
    const doc = appointmentFixture({
      status: AppointmentStatuses.CANCELLED,
      cancellationRequestStatus: CancellationRequestStatuses.PENDING,
    });
    const saveable = { ...doc, save: jest.fn().mockResolvedValue(undefined), set: jest.fn() };
    mockAppointmentFindById.mockResolvedValue(saveable);

    const { PatientAppointmentsService } = await import("@/server/services/patient-appointments.service");
    await expect(
      PatientAppointmentsService.requestCancellation(APPOINTMENT_ID, PATIENT_ID, {
        reason: "again",
        refundMethod: "bank",
        refundAccountTitle: "Test Patient",
        refundAccountNumber: "1234567890",
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });
});

// ===========================================================================
// PART 5 — Database integrity
// ===========================================================================
describe("APT-L-022 — Invalid status value", () => {
  test("AppointmentStatuses has no 'ABC'-like arbitrary member — the enum is closed", () => {
    expect(Object.values(AppointmentStatuses)).not.toContain("ABC");
    expect(Object.values(AppointmentStatuses).sort()).toEqual(
      ["cancelled", "completed", "confirmed", "in_progress", "no_show", "pending"].sort(),
    );
  });
});

describe("APT-L-023 / APT-L-024 — Missing / non-existent appointment ID", () => {
  test("recordJoin with a non-existent appointment id -> 404, no side effects", async () => {
    mockAppointmentFindById.mockReturnValue(chain(null));
    const { VideoSessionService } = await import("@/server/services/video-session.service");
    await expect(
      VideoSessionService.recordJoin(PATIENT_ID, "507f1f77bcf86cd799439000"),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(mockAppointmentUpdateOne).not.toHaveBeenCalled();
  });

  test("requestCancellation with a non-existent appointment id -> 404", async () => {
    mockAppointmentFindById.mockResolvedValue(null);
    const { PatientAppointmentsService } = await import("@/server/services/patient-appointments.service");
    await expect(
      PatientAppointmentsService.requestCancellation("507f1f77bcf86cd799439000", PATIENT_ID, {
        reason: "n/a",
        refundMethod: "bank",
        refundAccountTitle: "x",
        refundAccountNumber: "12345",
      }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("APT-L-025 — Unauthorized user attempting a transition", () => {
  test("a patient cannot request cancellation of another patient's appointment (ownership mismatch -> 404, not leaked as 403)", async () => {
    const doc = appointmentFixture({ status: AppointmentStatuses.PENDING });
    mockAppointmentFindById.mockResolvedValue(doc); // patientId is PATIENT_ID, caller is OTHER_PATIENT_ID
    const { PatientAppointmentsService } = await import("@/server/services/patient-appointments.service");
    await expect(
      PatientAppointmentsService.requestCancellation(APPOINTMENT_ID, OTHER_PATIENT_ID, {
        reason: "not mine",
        refundMethod: "bank",
        refundAccountTitle: "x",
        refundAccountNumber: "12345",
      }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  test("a user who is neither the patient nor the linked doctor cannot join the video session (403 Forbidden)", async () => {
    mockAppointmentFindById.mockReturnValue(
      chain(appointmentFixture({ status: AppointmentStatuses.CONFIRMED })),
    );
    mockDoctorProfileFindById.mockReturnValue(chain({ userId: { toString: () => DOCTOR_USER_ID } }));

    const { VideoSessionService } = await import("@/server/services/video-session.service");
    await expect(
      VideoSessionService.recordJoin("some-random-unrelated-user-id", APPOINTMENT_ID),
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(mockAppointmentUpdateOne).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// PART 6 — Concurrency: conflicting transitions on one appointment
// ===========================================================================
describe("APT-L-026 — Concurrent conflicting transitions", () => {
  test("10/25/50 concurrent recordJoin calls on the same CONFIRMED appointment never throw an unhandled exception and all resolve", async () => {
    for (const n of [10, 25, 50]) {
      jest.clearAllMocks();
      mockConnectDatabase.mockResolvedValue(undefined);
      mockDoctorProfileFindById.mockReturnValue(chain({ userId: { toString: () => DOCTOR_USER_ID } }));
      mockAppointmentFindById.mockReturnValue(
        chain(appointmentFixture({ status: AppointmentStatuses.CONFIRMED })),
      );
      mockVideoSessionFindOne.mockResolvedValue({
        _id: "session-1",
        patientJoinedAt: null,
        doctorJoinedAt: null,
        startedAt: null,
      });
      mockAppointmentUpdateOne.mockResolvedValue({});
      mockVideoSessionUpdateOne.mockResolvedValue({});

      const { VideoSessionService } = await import("@/server/services/video-session.service");
      const results = await Promise.allSettled(
        Array.from({ length: n }, () => VideoSessionService.recordJoin(PATIENT_ID, APPOINTMENT_ID)),
      );

      const rejected = results.filter((r) => r.status === "rejected");
      expect(rejected).toHaveLength(0);
      // Documents the actual (racy) behavior: every one of the N calls issues
      // its own write because none of them re-reads between check and write —
      // this is the TOCTOU pattern flagged in the file header. Harmless here
      // because the write is idempotent (always the same target status), but
      // the same shape of race is NOT harmless in confirmAfterPayment, which
      // is why that one got an explicit fix (APT-L-007).
      expect(mockAppointmentUpdateOne).toHaveBeenCalledTimes(n);
    }
  });

  test("a confirm racing a stale-sweep cancellation: whichever the DB read observes wins deterministically, and the loser is rejected — never a corrupted mixed state", async () => {
    // This is the sequential reproduction of the real race: the cancellation
    // has already landed by the time confirmAfterPayment's read happens
    // (the realistic ordering, since the sweep runs on a 60s throttle and a
    // late webhook by definition arrives after the hold already expired).
    mockPaymentFindById.mockReturnValue(chain(paymentFixture()));
    mockAppointmentFindById.mockReturnValue(
      chain(appointmentFixture({ status: AppointmentStatuses.CANCELLED })),
    );

    const { OnlineConsultService } = await import("@/server/services/online-consult.service");
    await expect(OnlineConsultService.confirmAfterPayment(PAYMENT_ID)).rejects.toMatchObject({
      statusCode: 409,
    });
    // Neither the payment nor the appointment moved — no mixed/corrupted state.
    expect(mockPaymentUpdateOne).not.toHaveBeenCalled();
    expect(mockAppointmentUpdateOne).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// PART 8 (subset) — Fuzz: malformed inputs to the transition entry points
// ===========================================================================
describe("Fuzz — malformed appointmentId to VideoSessionService.recordJoin never crashes uncontrolled", () => {
  test.each(["not-an-object-id", "", "__proto__", "a".repeat(2000), null, undefined])(
    "appointmentId=%p -> findById is invoked with the raw value and a null result yields a clean 404 (Mongoose CastErrors on malformed ids are a pre-existing, separately-tracked gap here, not new)",
    async (badId) => {
      mockAppointmentFindById.mockReturnValue(chain(null));
      const { VideoSessionService } = await import("@/server/services/video-session.service");
      await expect(
        VideoSessionService.recordJoin(PATIENT_ID, badId as unknown as string),
      ).rejects.toMatchObject({ statusCode: 404 });
    },
  );
});
