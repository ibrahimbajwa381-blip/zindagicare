/**
 * APT-001..026 — Online consult checkout/booking backend tests.
 *
 * Pure unit tests: every MongoDB model (@zindagi/database), the auth session
 * resolver, admin/patient notification senders, and the chat/video services
 * pulled in transitively by online-consult.service.ts are mocked. This file
 * never touches the real MongoDB Atlas cluster — no connectDatabase call
 * reaches a real driver, no create/updateOne/find ever executes against
 * real data. `payments.PAYMENTS_LIVE=false` in the real .env is irrelevant
 * here since PaymentModel/AppointmentModel are mocked outright.
 *
 * Route-level tests exercise the real `POST /api/v1/consult/checkout`
 * handler (real withApiHandler + real Zod schema + real OnlineConsultService
 * business logic), with only persistence mocked — so validation, error
 * codes/status, and business rules are genuinely under test, not assumed.
 */
import fs from "fs";
import path from "path";
import { NextRequest } from "next/server";
import { Types } from "mongoose";
import {
  AppointmentStatuses,
  AppointmentTypes,
  PaymentProviders,
  PaymentStatuses,
  Roles,
  VerificationStatuses,
} from "@zindagi/shared";
import { generateConsultSlots } from "@/lib/consult/slot-utils";

// ---------------------------------------------------------------------------
// Mocks — declared before jest.mock() calls per existing repo convention
// (tests/unit/api/doctor-auth.test.ts). babel-plugin-jest-hoist allows
// referencing `mock*`-named consts from inside the hoisted jest.mock factory.
// ---------------------------------------------------------------------------
const mockResolveSession = jest.fn();
jest.mock("@/server/api/resolve-session", () => ({
  resolveSession: (...args: unknown[]) => mockResolveSession(...args),
}));

const mockConnectDatabase = jest.fn();
const mockDoctorProfileFindById = jest.fn();
const mockAppointmentFindById = jest.fn();
const mockAppointmentFindOne = jest.fn();
const mockAppointmentFind = jest.fn();
const mockAppointmentCreate = jest.fn();
const mockAppointmentUpdateOne = jest.fn();
const mockAppointmentUpdateMany = jest.fn();
const mockPaymentFindById = jest.fn();
const mockPaymentCreate = jest.fn();
const mockPaymentUpdateOne = jest.fn();
const mockUserFindById = jest.fn();
const mockUserFindOne = jest.fn();

jest.mock("@zindagi/database", () => ({
  connectDatabase: (...args: unknown[]) => mockConnectDatabase(...args),
  DoctorProfileModel: {
    findById: (...args: unknown[]) => mockDoctorProfileFindById(...args),
  },
  AppointmentModel: {
    findById: (...args: unknown[]) => mockAppointmentFindById(...args),
    findOne: (...args: unknown[]) => mockAppointmentFindOne(...args),
    find: (...args: unknown[]) => mockAppointmentFind(...args),
    create: (...args: unknown[]) => mockAppointmentCreate(...args),
    updateOne: (...args: unknown[]) => mockAppointmentUpdateOne(...args),
    updateMany: (...args: unknown[]) => mockAppointmentUpdateMany(...args),
  },
  PaymentModel: {
    findById: (...args: unknown[]) => mockPaymentFindById(...args),
    create: (...args: unknown[]) => mockPaymentCreate(...args),
    updateOne: (...args: unknown[]) => mockPaymentUpdateOne(...args),
  },
  UserModel: {
    findById: (...args: unknown[]) => mockUserFindById(...args),
    findOne: (...args: unknown[]) => mockUserFindOne(...args),
  },
}));

const mockAttributeReferralIfEligible = jest.fn();
jest.mock("@/server/services/doctor-referral.service", () => ({
  REFERRAL_COOKIE_NAME: "zc_ref",
  attributeReferralIfEligible: (...args: unknown[]) => mockAttributeReferralIfEligible(...args),
}));

const mockNotifyAdmins = jest.fn();
jest.mock("@/lib/notifications/notify-admins", () => ({
  notifyAdmins: (...args: unknown[]) => mockNotifyAdmins(...args),
}));

const mockSendOnlineConsultConfirmation = jest.fn();
const mockSendDoctorConsultBooked = jest.fn();
jest.mock("@/lib/notifications/consult-notifications", () => ({
  sendOnlineConsultConfirmation: (...args: unknown[]) => mockSendOnlineConsultConfirmation(...args),
  sendDoctorConsultBooked: (...args: unknown[]) => mockSendDoctorConsultBooked(...args),
}));

const mockEnsureAppointmentThread = jest.fn();
const mockStartIntakeConversation = jest.fn();
jest.mock("@/server/services/chat.service", () => ({
  ChatService: {
    ensureAppointmentThread: (...args: unknown[]) => mockEnsureAppointmentThread(...args),
    startIntakeConversation: (...args: unknown[]) => mockStartIntakeConversation(...args),
  },
}));

const mockFinalizeAppointmentIfAttended = jest.fn();
jest.mock("@/server/services/video-session.service", () => ({
  VideoSessionService: {
    finalizeAppointmentIfAttended: (...args: unknown[]) => mockFinalizeAppointmentIfAttended(...args),
  },
}));

// ---------------------------------------------------------------------------
// Generic Mongoose-chain mock: supports .populate()/.select()/.sort()
// (each returns itself) terminated by .lean() (resolves finalValue), and
// also supports being awaited directly without .lean() (ensurePatientPhone
// does `await UserModel.findById(id).select("phone")` with no .lean()) by
// spreading finalValue's own fields onto the returned object itself.
// ---------------------------------------------------------------------------
function chain<T>(finalValue: T) {
  const obj = { ...(finalValue as Record<string, unknown>) } as Record<string, unknown>;
  obj.lean = jest.fn().mockResolvedValue(finalValue);
  obj.populate = jest.fn(() => obj);
  obj.select = jest.fn(() => obj);
  obj.sort = jest.fn(() => obj);
  return obj;
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const PATIENT_A = { user: { id: "patient-a-id", roles: [Roles.PATIENT] } };
const PATIENT_B = { user: { id: "patient-b-id", roles: [Roles.PATIENT] } };
const DOCTOR_SESSION = { user: { id: "doctor-user-id", roles: [Roles.DOCTOR] } };
const NURSE_SESSION = { user: { id: "nurse-user-id", roles: [Roles.NURSE] } };
const ADMIN_SESSION = { user: { id: "admin-user-id", roles: [Roles.ADMIN] } };

// Real generateConsultSlots (unmocked, pure) derives a genuinely valid future
// slotId from an all-day-every-day availability window, so tests don't hand-
// compute timezone-sensitive date strings.
const ALL_DAY_AVAILABILITY = Array.from({ length: 7 }, (_, dayOfWeek) => ({
  dayOfWeek,
  startTimeLocal: "00:00",
  endTimeLocal: "23:40",
}));
const REAL_FUTURE_SLOTS = generateConsultSlots(ALL_DAY_AVAILABILITY, new Date(), 14, 20);
const VALID_SLOT_ID = REAL_FUTURE_SLOTS[0].slotId;
const VALID_SLOT_START = REAL_FUTURE_SLOTS[0].startAt;

// Must be a syntactically valid ObjectId (24 hex chars) — validateSlotForBooking
// now rejects malformed ids before ever reaching DoctorProfileModel.findById
// (see APT-013's fix), so fixture ids used as real doctorId inputs can't be
// arbitrary strings like "doctor-1" any more.
const VALID_DOCTOR_ID = "507f1f77bcf86cd799439011";

const APPROVED_DOCTOR = {
  _id: { toString: () => VALID_DOCTOR_ID },
  isListed: true,
  verificationStatus: VerificationStatuses.APPROVED,
  consultationFee: 1500,
  weeklyAvailability: ALL_DAY_AVAILABILITY,
  userId: { name: "Ali Raza", isActive: true, deletedAt: null },
};

const PENDING_PHONE_USER = { phone: "+923001234567", name: "Test Patient" };

function req(url: string, init: RequestInit & { headers?: Record<string, string> } = {}) {
  return new NextRequest(url, init as ConstructorParameters<typeof NextRequest>[1]);
}

function checkoutBody(overrides: Record<string, unknown> = {}) {
  return {
    doctorId: VALID_DOCTOR_ID,
    slotId: VALID_SLOT_ID,
    ...overrides,
  };
}

async function callCheckout(body: unknown, url = "http://localhost/api/v1/consult/checkout") {
  const { POST } = await import("@/app/api/v1/consult/checkout/route");
  const res = await POST(
    req(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
  const json = await res.json();
  return { res, json };
}

/** Default happy-path plumbing shared by most tests; individual tests override specific mocks. */
function setupHappyPathMocks() {
  mockConnectDatabase.mockResolvedValue(undefined);
  mockAttributeReferralIfEligible.mockResolvedValue(undefined);
  mockNotifyAdmins.mockResolvedValue(undefined);

  mockDoctorProfileFindById.mockReturnValue(chain(APPROVED_DOCTOR));
  mockAppointmentFindOne.mockReturnValue(chain(null)); // no conflicting appointment
  mockAppointmentFind.mockReturnValue(chain([])); // no pending checkouts to reconcile
  mockUserFindById.mockReturnValue(chain(PENDING_PHONE_USER));
  mockUserFindOne.mockResolvedValue(null);

  mockAppointmentCreate.mockResolvedValue({ _id: { toString: () => "appt-new-1" } });
  mockAppointmentUpdateOne.mockResolvedValue({});
  mockAppointmentUpdateMany.mockResolvedValue({});
  mockPaymentCreate.mockResolvedValue({ _id: { toString: () => "payment-new-1" } });
  mockPaymentUpdateOne.mockResolvedValue({});
  mockPaymentFindById.mockReturnValue(chain(null));
}

beforeEach(() => {
  jest.resetModules();
  jest.clearAllMocks();
  mockResolveSession.mockResolvedValue(PATIENT_A);
  setupHappyPathMocks();
});

// ===========================================================================
// APT-001 — Valid online appointment
// ===========================================================================
describe("APT-001 — Valid online appointment", () => {
  test("checkout succeeds, creates an ONLINE pending appointment and a pending payment for the authenticated patient", async () => {
    const { res, json } = await callCheckout(checkoutBody());

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.paymentId).toBe("payment-new-1");
    expect(json.data.appointmentId).toBe("appt-new-1");

    expect(mockAppointmentCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        type: AppointmentTypes.ONLINE,
        status: AppointmentStatuses.PENDING,
        patientId: "patient-a-id",
        doctorId: VALID_DOCTOR_ID,
      }),
    );
    expect(mockPaymentCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "patient-a-id",
        status: PaymentStatuses.PENDING,
        amount: 1500,
        appointmentId: "appt-new-1",
      }),
    );
    // Manual-transfer mode (PAYMENTS_LIVE=false in this repo's dev config) —
    // checkout result carries the manual transfer + legacy testPayment preview.
    expect(json.data.manualTransfer).toBeDefined();
  });
});

// ===========================================================================
// APT-002 — Invalid doctor
// ===========================================================================
describe("APT-002 — Invalid doctor", () => {
  test("non-existing doctor id -> 404 Doctor not found, no appointment/payment created", async () => {
    mockDoctorProfileFindById.mockReturnValue(chain(null));

    const { res, json } = await callCheckout(checkoutBody({ doctorId: "5f5f5f5f5f5f5f5f5f5f5f5f" }));

    expect(res.status).toBe(404);
    expect(json.error.message).toMatch(/Doctor not found/i);
    expect(mockAppointmentCreate).not.toHaveBeenCalled();
    expect(mockPaymentCreate).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// APT-003 — Unverified doctor
// ===========================================================================
describe("APT-003 — Unverified doctor", () => {
  test("verificationStatus=pending -> booking rejected, no side effects (existing behavior: treated as 'not found')", async () => {
    mockDoctorProfileFindById.mockReturnValue(
      chain({ ...APPROVED_DOCTOR, verificationStatus: VerificationStatuses.PENDING }),
    );

    const { res, json } = await callCheckout(checkoutBody());

    expect(res.status).toBe(404);
    expect(json.error.message).toMatch(/Doctor not found/i);
    expect(mockAppointmentCreate).not.toHaveBeenCalled();
    expect(mockPaymentCreate).not.toHaveBeenCalled();
  });

  test("verificationStatus=restricted -> booking rejected the same way", async () => {
    mockDoctorProfileFindById.mockReturnValue(
      chain({ ...APPROVED_DOCTOR, verificationStatus: VerificationStatuses.RESTRICTED }),
    );

    const { res } = await callCheckout(checkoutBody());
    expect(res.status).toBe(404);
    expect(mockAppointmentCreate).not.toHaveBeenCalled();
  });

  test("isListed=false (unlisted, even if approved) -> booking rejected", async () => {
    mockDoctorProfileFindById.mockReturnValue(chain({ ...APPROVED_DOCTOR, isListed: false }));

    const { res } = await callCheckout(checkoutBody());
    expect(res.status).toBe(404);
    expect(mockAppointmentCreate).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// APT-004 — Invalid slot
// ===========================================================================
describe("APT-004 — Invalid slot", () => {
  test("malformed slot id -> 400 (existing behavior)", async () => {
    const { res, json } = await callCheckout(checkoutBody({ slotId: "not-a-real-slot-id" }));
    expect(res.status).toBe(400);
    expect(json.error.message).toMatch(/Invalid slot/i);
    expect(mockAppointmentCreate).not.toHaveBeenCalled();
  });

  test("valid-looking slotId that is not in the doctor's generated availability -> 409 (existing behavior)", async () => {
    mockDoctorProfileFindById.mockReturnValue(chain({ ...APPROVED_DOCTOR, weeklyAvailability: [] }));

    const { res, json } = await callCheckout(checkoutBody());
    expect(res.status).toBe(409);
    expect(json.error.message).toMatch(/not available/i);
    expect(mockAppointmentCreate).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// APT-005 — Past slot
// ===========================================================================
describe("APT-005 — Past slot", () => {
  test("a slot whose start time is in the past -> 409, no appointment created", async () => {
    const { res, json } = await callCheckout(checkoutBody({ slotId: "2020-01-01:10:00" }));
    expect(res.status).toBe(409);
    expect(json.error.message).toMatch(/past/i);
    expect(mockAppointmentCreate).not.toHaveBeenCalled();
  });

  // Boundary tests around "now". Deliberately NOT using jest.useFakeTimers()
  // here: faking timers in this repo's Next.js + Jest combination corrupts
  // an unrelated lazy module-load path used by Next's error/stack-trace
  // machinery and crashes the entire test *process* (not just the test) the
  // next time any route handler hits its catch branch — reproduced while
  // writing this suite. Real, un-frozen time is used instead:
  // `generateConsultSlots`'s own `now` parameter (the same primitive
  // production code uses) is repurposed to fetch a genuinely-real slot from
  // yesterday for the "past" case, and REAL_FUTURE_SLOTS[1] (20 real minutes
  // after VALID_SLOT_ID, computed at module load) for the "future" case.
  describe("boundary: slightly past vs. slightly future", () => {
    const YESTERDAY_SLOTS = generateConsultSlots(
      ALL_DAY_AVAILABILITY,
      new Date(Date.now() - 24 * 60 * 60 * 1000),
      1,
      20,
      new Date(0), // `now` param used only for the cursor>now inclusion check — epoch keeps every slot, past included
    );
    const PAST_SLOT_ID = YESTERDAY_SLOTS[0].slotId;
    const NEXT_FUTURE_SLOT_ID = REAL_FUTURE_SLOTS[1].slotId; // 20 real minutes after VALID_SLOT_ID

    test("slot slightly in the past (yesterday) -> 409 past", async () => {
      const { res, json } = await callCheckout(checkoutBody({ slotId: PAST_SLOT_ID }));
      expect(res.status).toBe(409);
      expect(json.error.message).toMatch(/past/i);
      expect(mockAppointmentCreate).not.toHaveBeenCalled();
    });

    test("slot slightly in the future (the very next real 20-min slot) -> succeeds normally", async () => {
      const { res, json } = await callCheckout(checkoutBody({ slotId: NEXT_FUTURE_SLOT_ID }));
      expect(res.status).toBe(200);
      expect(json.data.appointmentId).toBe("appt-new-1");
      expect(mockAppointmentCreate).toHaveBeenCalled();
    });

    test("the past/future boundary comparison is inclusive of the current instant (slotStart <= now, not <) — confirmed by source inspection", () => {
      const source = fs.readFileSync(
        path.join(__dirname, "../../../src/server/services/online-consult.service.ts"),
        "utf8",
      );
      // A slot exactly at "now" can't be tested dynamically without faking
      // the clock (see the note above on why that's unsafe here) — this
      // documents the exact comparison operator instead, which is the part
      // that determines whether the boundary instant itself is bookable.
      expect(source).toMatch(/slotStart\s*<=\s*new Date\(\)/);
    });
  });
});

// ===========================================================================
// APT-006 — Already booked slot
// ===========================================================================
describe("APT-006 — Already booked slot", () => {
  test("an existing active appointment occupies the slot -> 409, no second appointment created", async () => {
    mockAppointmentFindOne.mockReturnValue(
      chain({ _id: { toString: () => "existing-appt" }, scheduledStart: VALID_SLOT_START }),
    );

    const { res, json } = await callCheckout(checkoutBody());
    expect(res.status).toBe(409);
    expect(json.error.message).toMatch(/no longer available/i);
    expect(mockAppointmentCreate).not.toHaveBeenCalled();
  });

  test("the conflict check is scoped to ACTIVE statuses only (pending/confirmed/in_progress) — cancelled appointments are excluded from blocking", async () => {
    await callCheckout(checkoutBody());
    const conflictFilterArg = mockAppointmentFindOne.mock.calls[0][0];
    expect(conflictFilterArg.status.$in).toEqual(
      expect.arrayContaining([
        AppointmentStatuses.PENDING,
        AppointmentStatuses.CONFIRMED,
        AppointmentStatuses.IN_PROGRESS,
      ]),
    );
    expect(conflictFilterArg.status.$in).not.toContain(AppointmentStatuses.CANCELLED);
  });

  test.each([AppointmentStatuses.PENDING, AppointmentStatuses.CONFIRMED, AppointmentStatuses.IN_PROGRESS])(
    "a conflicting appointment with status=%s blocks the slot (409, no new appointment)",
    async (status) => {
      mockAppointmentFindOne.mockReturnValue(
        chain({ _id: { toString: () => "existing-appt" }, status, scheduledStart: VALID_SLOT_START }),
      );
      const { res, json } = await callCheckout(checkoutBody());
      expect(res.status).toBe(409);
      expect(json.error.message).toMatch(/no longer available/i);
      expect(mockAppointmentCreate).not.toHaveBeenCalled();
    },
  );

  test("a CANCELLED appointment at the same slot does NOT block a new booking (the query filter itself excludes it — this simulates real Mongo returning no match)", async () => {
    // The findOne conflict query only ever asks Mongo for ACTIVE_STATUSES
    // (asserted above), so a real CANCELLED appointment can never come back
    // as a match — mocking a null return here is the faithful simulation.
    mockAppointmentFindOne.mockReturnValue(chain(null));
    const { res } = await callCheckout(checkoutBody());
    expect(res.status).toBe(200);
    expect(mockAppointmentCreate).toHaveBeenCalled();
  });
});

// ===========================================================================
// APT-007 — Duplicate booking
// ===========================================================================
describe("APT-007 — Duplicate booking", () => {
  test("same patient + same doctor + same pending slot -> existing pending checkout is resumed, no second appointment created", async () => {
    mockAppointmentFind.mockReturnValue(
      chain([
        {
          _id: { toString: () => "pending-appt-1" },
          paymentId: { toString: () => "pending-payment-1" },
          createdAt: new Date(),
        },
      ]),
    );
    mockPaymentFindById.mockReturnValue(
      chain({
        _id: { toString: () => "pending-payment-1" },
        amount: 1500,
        provider: PaymentProviders.MANUAL_JAZZCASH,
        status: PaymentStatuses.PENDING,
        appointmentId: { toString: () => "pending-appt-1" },
        metadata: { slotId: VALID_SLOT_ID, expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString() },
      }),
    );

    const { res, json } = await callCheckout(checkoutBody());

    expect(res.status).toBe(200);
    expect(json.data.paymentId).toBe("pending-payment-1");
    expect(json.data.appointmentId).toBe("pending-appt-1");
    expect(mockAppointmentCreate).not.toHaveBeenCalled();
    expect(mockPaymentCreate).not.toHaveBeenCalled();
  });

  test("same patient + same doctor but a DIFFERENT slot -> the old pending hold is cancelled (not resumed) and a normal new booking is created", async () => {
    const OLD_SLOT_ID = "2099-01-01:09:00"; // deliberately not VALID_SLOT_ID
    mockAppointmentFind.mockReturnValue(
      chain([
        {
          _id: { toString: () => "old-pending-appt" },
          paymentId: { toString: () => "old-pending-payment" },
          createdAt: new Date(),
        },
      ]),
    );
    mockPaymentFindById.mockReturnValue(
      chain({
        _id: { toString: () => "old-pending-payment" },
        amount: 1500,
        provider: PaymentProviders.MANUAL_JAZZCASH,
        status: PaymentStatuses.PENDING,
        appointmentId: { toString: () => "old-pending-appt" },
        metadata: { slotId: OLD_SLOT_ID, expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString() },
      }),
    );

    // checkoutBody() requests VALID_SLOT_ID — different from the pending hold's OLD_SLOT_ID.
    const { res, json } = await callCheckout(checkoutBody());

    expect(res.status).toBe(200);
    // A brand-new appointment/payment was created — the old slot's hold was not resumed.
    expect(json.data.appointmentId).toBe("appt-new-1");
    expect(json.data.paymentId).toBe("payment-new-1");
    expect(mockAppointmentCreate).toHaveBeenCalledWith(
      expect.objectContaining({ doctorId: VALID_DOCTOR_ID, scheduledStart: VALID_SLOT_START }),
    );
    expect(mockPaymentCreate).toHaveBeenCalled();
    // The old slot's pending appointment + payment were cancelled, not left dangling.
    expect(mockAppointmentUpdateOne).toHaveBeenCalledWith(
      expect.objectContaining({ _id: "old-pending-appt" }),
      expect.objectContaining({ $set: expect.objectContaining({ status: AppointmentStatuses.CANCELLED }) }),
    );
    expect(mockPaymentUpdateOne).toHaveBeenCalledWith(
      expect.objectContaining({ _id: "old-pending-payment" }),
      expect.objectContaining({ $set: expect.objectContaining({ status: PaymentStatuses.CANCELLED }) }),
    );
  });
});

// ===========================================================================
// APT-008 — Doctor booking own slot
// ===========================================================================
describe("APT-008 — Doctor booking own slot", () => {
  test("FIXED: a patient whose own user id matches the doctor's linked userId is rejected with a clear 400, no appointment created", async () => {
    // Simulate: PATIENT_A's user IS the doctor behind VALID_DOCTOR_ID's profile
    // (e.g. an account that somehow holds both roles).
    mockDoctorProfileFindById.mockReturnValue(
      chain({ ...APPROVED_DOCTOR, userId: { name: "Ali Raza", isActive: true, deletedAt: null, _id: "patient-a-id" } }),
    );

    const { res, json } = await callCheckout(checkoutBody());

    expect(res.status).toBe(400);
    expect(json.error.message).toMatch(/cannot book your own/i);
    expect(mockAppointmentCreate).not.toHaveBeenCalled();
  });

  test("a different patient booking the same doctor is unaffected by the self-book guard", async () => {
    mockDoctorProfileFindById.mockReturnValue(
      chain({ ...APPROVED_DOCTOR, userId: { name: "Ali Raza", isActive: true, deletedAt: null, _id: "doctor-user-id" } }),
    );

    const { res } = await callCheckout(checkoutBody());
    expect(res.status).toBe(200);
    expect(mockAppointmentCreate).toHaveBeenCalled();
  });
});

// ===========================================================================
// APT-009 — Role authorization
// ===========================================================================
describe("APT-009 — Role authorization", () => {
  test("unauthenticated -> 401, no appointment created", async () => {
    mockResolveSession.mockResolvedValue(null);
    const { res } = await callCheckout(checkoutBody());
    expect(res.status).toBe(401);
    expect(mockAppointmentCreate).not.toHaveBeenCalled();
  });

  test("patient -> allowed (intended role)", async () => {
    mockResolveSession.mockResolvedValue(PATIENT_A);
    const { res } = await callCheckout(checkoutBody());
    expect(res.status).toBe(200);
  });

  test("FIXED: doctor -> 403 Forbidden, no appointment created", async () => {
    mockResolveSession.mockResolvedValue(DOCTOR_SESSION);
    const { res } = await callCheckout(checkoutBody());
    expect(res.status).toBe(403);
    expect(mockAppointmentCreate).not.toHaveBeenCalled();
  });

  test("FIXED: nurse -> 403 Forbidden, no appointment created", async () => {
    mockResolveSession.mockResolvedValue(NURSE_SESSION);
    const { res } = await callCheckout(checkoutBody());
    expect(res.status).toBe(403);
    expect(mockAppointmentCreate).not.toHaveBeenCalled();
  });

  test("FIXED: admin -> 403 Forbidden, no appointment created", async () => {
    mockResolveSession.mockResolvedValue(ADMIN_SESSION);
    const { res } = await callCheckout(checkoutBody());
    expect(res.status).toBe(403);
    expect(mockAppointmentCreate).not.toHaveBeenCalled();
  });

  test("the checkout route now restricts booking to Roles.PATIENT — confirmed by source inspection", () => {
    const source = fs.readFileSync(
      path.join(__dirname, "../../../src/app/api/v1/consult/checkout/route.ts"),
      "utf8",
    );
    expect(source).toMatch(/auth:\s*true/);
    expect(source).toMatch(/roles:\s*\[Roles\.PATIENT\]/);
  });
});

// ===========================================================================
// APT-010 — Correct appointment type
// ===========================================================================
describe("APT-010 — Correct appointment type", () => {
  test("server always creates type=ONLINE, never derived from the client", async () => {
    await callCheckout(checkoutBody());
    expect(mockAppointmentCreate).toHaveBeenCalledWith(
      expect.objectContaining({ type: AppointmentTypes.ONLINE }),
    );
  });
});

// ===========================================================================
// APT-011 — Wrong appointment type
// ===========================================================================
describe("APT-011 — Wrong appointment type", () => {
  test.each(["home", "HOME", "in_person", "video", "clinic", "not-a-real-type"])(
    "client-supplied type=%s is silently stripped by the schema and has no effect — appointment stays ONLINE",
    async (maliciousType) => {
      await callCheckout(checkoutBody({ type: maliciousType, appointmentType: maliciousType }));
      expect(mockAppointmentCreate).toHaveBeenCalledWith(
        expect.objectContaining({ type: AppointmentTypes.ONLINE }),
      );
    },
  );

  test("consultCheckoutSchema has no `type`/`appointmentType` field at all", async () => {
    const { consultCheckoutSchema } = await import("@zindagi/validators");
    const parsed = consultCheckoutSchema.parse(checkoutBody({ type: "home_visit" }));
    expect(parsed).not.toHaveProperty("type");
  });
});

// ===========================================================================
// APT-012 — Missing required fields
// ===========================================================================
describe("APT-012 — Missing required fields", () => {
  test("missing doctorId -> validation error, no appointment/payment created", async () => {
    const body = checkoutBody();
    delete (body as Record<string, unknown>).doctorId;
    const { res } = await callCheckout(body);
    expect(res.status).toBe(400);
    expect(mockAppointmentCreate).not.toHaveBeenCalled();
    expect(mockPaymentCreate).not.toHaveBeenCalled();
  });

  test("missing slotId -> validation error, no appointment/payment created", async () => {
    const body = checkoutBody();
    delete (body as Record<string, unknown>).slotId;
    const { res } = await callCheckout(body);
    expect(res.status).toBe(400);
    expect(mockAppointmentCreate).not.toHaveBeenCalled();
  });

  test("empty body -> validation error", async () => {
    const { res } = await callCheckout({});
    expect(res.status).toBe(400);
    expect(mockAppointmentCreate).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// APT-013 — Invalid doctor ID
// ===========================================================================
describe("APT-013 — Invalid doctor ID", () => {
  test("empty string doctorId -> clean 400 (schema min(1) rejects it), no 500", async () => {
    const { res } = await callCheckout(checkoutBody({ doctorId: "" }));
    expect(res.status).toBe(400);
    expect(mockAppointmentCreate).not.toHaveBeenCalled();
  });

  test("null doctorId -> clean 400, no 500", async () => {
    const { res } = await callCheckout(checkoutBody({ doctorId: null }));
    expect(res.status).toBe(400);
  });

  test("unexpected type (number) for doctorId -> clean 400, no 500", async () => {
    const { res } = await callCheckout(checkoutBody({ doctorId: 12345 }));
    expect(res.status).toBe(400);
  });

  test("unexpected type (array) for doctorId -> clean 400, no 500", async () => {
    const { res } = await callCheckout(checkoutBody({ doctorId: ["doctor-1"] }));
    expect(res.status).toBe(400);
  });

  test("FINDING: a malformed-but-non-empty doctorId (invalid ObjectId, e.g. 'not-an-id') currently reaches DoctorProfileModel.findById unguarded", () => {
    const source = fs.readFileSync(
      path.join(__dirname, "../../../src/server/services/online-consult.service.ts"),
      "utf8",
    );
    const validateBlock = source.slice(
      source.indexOf("static async validateSlotForBooking"),
      source.indexOf("static async validateSlotForBooking") + 800,
    );
    // Documents whether an ObjectId-format guard exists ahead of the DB call.
    // If this now contains `Types.ObjectId.isValid`, the fix described in the
    // final report has been applied and malformed ids are caught before
    // ever reaching Mongoose (avoiding a raw CastError -> 500).
    expect(validateBlock).toMatch(/Types\.ObjectId\.isValid\(doctorId\)/);
  });

  test("a malformed doctorId that would make Mongoose throw a CastError no longer produces a 500", async () => {
    mockDoctorProfileFindById.mockImplementation((id: string) => {
      if (!Types.ObjectId.isValid(id)) {
        return {
          populate: () => ({
            lean: () => Promise.reject(new Error(`Cast to ObjectId failed for value "${id}"`)),
          }),
        };
      }
      return chain(APPROVED_DOCTOR);
    });

    const { res, json } = await callCheckout(checkoutBody({ doctorId: "not-an-object-id" }));
    expect(res.status).toBe(404);
    expect(json.error.message).toMatch(/Doctor not found/i);
    expect(mockAppointmentCreate).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// APT-014 — Invalid slot ID
// ===========================================================================
describe("APT-014 — Invalid slot ID", () => {
  test("malformed slotId -> validation error (400), no DB side effect", async () => {
    const { res } = await callCheckout(checkoutBody({ slotId: "garbage" }));
    expect(res.status).toBe(400);
    expect(mockAppointmentCreate).not.toHaveBeenCalled();
  });

  test("empty slotId -> validation error (schema min(1)), no DB side effect", async () => {
    const { res } = await callCheckout(checkoutBody({ slotId: "" }));
    expect(res.status).toBe(400);
    expect(mockAppointmentCreate).not.toHaveBeenCalled();
  });

  test("null slotId -> validation error, no DB side effect", async () => {
    const { res } = await callCheckout(checkoutBody({ slotId: null }));
    expect(res.status).toBe(400);
  });

  test("unexpected type (object) for slotId -> validation error, no DB side effect", async () => {
    const { res } = await callCheckout(checkoutBody({ slotId: { evil: true } }));
    expect(res.status).toBe(400);
    expect(mockAppointmentCreate).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// APT-015 — Invalid/expired checkout state
// ===========================================================================
describe("APT-015 — Invalid/expired checkout state", () => {
  test("an expired pending hold is cancelled, not resumed, and a fresh booking proceeds safely", async () => {
    mockAppointmentFind.mockReturnValue(
      chain([
        {
          _id: { toString: () => "expired-appt-1" },
          paymentId: { toString: () => "expired-payment-1" },
          createdAt: new Date(Date.now() - 60 * 60 * 1000), // 1h ago
        },
      ]),
    );
    mockPaymentFindById.mockReturnValue(
      chain({
        _id: { toString: () => "expired-payment-1" },
        amount: 1500,
        provider: PaymentProviders.MANUAL_JAZZCASH,
        status: PaymentStatuses.PENDING,
        appointmentId: { toString: () => "expired-appt-1" },
        // expiresAt well in the past -> must be treated as expired, not resumable
        metadata: { slotId: VALID_SLOT_ID, expiresAt: new Date(Date.now() - 30 * 60 * 1000).toISOString() },
      }),
    );

    const { res, json } = await callCheckout(checkoutBody());

    expect(res.status).toBe(200);
    // A brand-new appointment/payment was created — the expired one was not resumed.
    expect(json.data.appointmentId).toBe("appt-new-1");
    expect(mockAppointmentUpdateOne).toHaveBeenCalledWith(
      expect.objectContaining({ _id: "expired-appt-1" }),
      expect.objectContaining({ $set: expect.objectContaining({ status: AppointmentStatuses.CANCELLED }) }),
    );
  });
});

// ===========================================================================
// APT-016 — Payment failure
// ===========================================================================
describe("APT-016 — Payment failure", () => {
  test("failPayment on a pending payment cancels the payment and the appointment, no confirmation", async () => {
    const appointmentIdRef = { toString: () => "appt-1" };
    mockPaymentFindById.mockReturnValue(
      chain({
        _id: { toString: () => "payment-1" },
        status: PaymentStatuses.PENDING,
        appointmentId: appointmentIdRef,
      }),
    );

    const { OnlineConsultService } = await import("@/server/services/online-consult.service");
    await OnlineConsultService.failPayment("payment-1", "card_declined");

    expect(mockPaymentUpdateOne).toHaveBeenCalledWith(
      expect.objectContaining({ _id: "payment-1" }),
      expect.objectContaining({
        $set: expect.objectContaining({ status: PaymentStatuses.FAILED, failureReason: "card_declined" }),
      }),
    );
    expect(mockAppointmentUpdateOne).toHaveBeenCalledWith(
      { _id: appointmentIdRef },
      expect.objectContaining({ $set: expect.objectContaining({ status: AppointmentStatuses.CANCELLED }) }),
    );
  });

  test("failPayment is a no-op on an already-PAID payment — does not flip a paid payment to failed", async () => {
    mockPaymentFindById.mockReturnValue(
      chain({ _id: { toString: () => "payment-2" }, status: PaymentStatuses.PAID }),
    );

    const { OnlineConsultService } = await import("@/server/services/online-consult.service");
    await OnlineConsultService.failPayment("payment-2", "late_callback");

    expect(mockPaymentUpdateOne).not.toHaveBeenCalled();
    expect(mockAppointmentUpdateOne).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// APT-017 — Successful payment
// ===========================================================================
describe("APT-017 — Successful payment", () => {
  test("confirmAfterPayment marks payment PAID, appointment CONFIRMED, and returns the correct doctor/patient/slot", async () => {
    const appointmentDoc = {
      _id: { toString: () => "appt-1" },
      type: AppointmentTypes.ONLINE,
      status: AppointmentStatuses.PENDING,
      patientId: { toString: () => "patient-a-id" },
      doctorId: {
        _id: { toString: () => "doctor-1" },
        specialties: ["Cardiologist"],
        pmdcVerified: true,
        ratingAvg: 4.5,
        ratingCount: 12,
        consultationFee: 1500,
        userId: { _id: { toString: () => "doctor-user-1" }, name: "Ali Raza", avatarUrl: undefined },
      },
      paymentId: { amount: 1500 },
      scheduledStart: VALID_SLOT_START,
      scheduledEnd: new Date(VALID_SLOT_START.getTime() + 20 * 60 * 1000),
    };

    mockPaymentFindById.mockReturnValue(
      chain({
        _id: { toString: () => "payment-1" },
        status: PaymentStatuses.PENDING,
        amount: 1500,
        appointmentId: { toString: () => "appt-1" },
      }),
    );
    mockAppointmentFindById.mockReturnValue(chain(appointmentDoc));
    mockUserFindById.mockReturnValue(chain({ name: "Test Patient", phone: "+923001234567" }));
    mockEnsureAppointmentThread.mockResolvedValue(undefined);
    mockStartIntakeConversation.mockResolvedValue(undefined);
    mockSendOnlineConsultConfirmation.mockResolvedValue(undefined);
    mockSendDoctorConsultBooked.mockResolvedValue(undefined);

    const { OnlineConsultService } = await import("@/server/services/online-consult.service");
    const booking = await OnlineConsultService.confirmAfterPayment("payment-1", "EXT-TXN-1");

    expect(mockPaymentUpdateOne).toHaveBeenCalledWith(
      { _id: "payment-1" },
      expect.objectContaining({ $set: expect.objectContaining({ status: PaymentStatuses.PAID }) }),
    );
    expect(mockAppointmentUpdateOne).toHaveBeenCalledWith(
      { _id: appointmentDoc._id },
      expect.objectContaining({ $set: { status: AppointmentStatuses.CONFIRMED } }),
    );
    expect(booking).not.toBeNull();
    expect(booking!.doctor.doctorId).toBe("doctor-1");
    expect(booking!.doctor.name).toBe("Ali Raza");
    expect(booking!.appointmentId).toBe("appt-1");
    expect(booking!.consultationFee).toBe(1500);
  });
});

// ===========================================================================
// APT-018 — Cross-user pending checkout
// ===========================================================================
describe("APT-018 — Cross-user pending checkout", () => {
  test("Patient B's checkout query is scoped to Patient B's own patientId — Patient A's pending appointment is never visible to it", async () => {
    mockResolveSession.mockResolvedValue(PATIENT_B);

    await callCheckout(checkoutBody());

    // AppointmentModel.find is also called once by the unrelated stale-hold
    // sweep (expireStalePendingBookings, no patientId in its filter) — find
    // the reconcile call specifically by its patientId field.
    const reconcileFilterArg = mockAppointmentFind.mock.calls
      .map((call) => call[0])
      .find((filter) => "patientId" in filter);
    expect(reconcileFilterArg).toBeDefined();
    expect(reconcileFilterArg.patientId).toBe("patient-b-id");
    expect(reconcileFilterArg.patientId).not.toBe("patient-a-id");
  });
});

// ===========================================================================
// APT-019 — Client-controlled patient ID
// ===========================================================================
describe("APT-019 — Client-controlled patient ID", () => {
  test("a client-supplied patientId in the body is ignored — the appointment is always created under the session's own user id", async () => {
    mockResolveSession.mockResolvedValue(PATIENT_A);

    await callCheckout(checkoutBody({ patientId: "patient-b-id", userId: "patient-b-id" }));

    expect(mockAppointmentCreate).toHaveBeenCalledWith(
      expect.objectContaining({ patientId: "patient-a-id" }),
    );
    expect(mockAppointmentCreate).not.toHaveBeenCalledWith(
      expect.objectContaining({ patientId: "patient-b-id" }),
    );
  });

  test("consultCheckoutSchema has no patientId/userId field — it cannot be smuggled through validation at all", async () => {
    const { consultCheckoutSchema } = await import("@zindagi/validators");
    const parsed = consultCheckoutSchema.parse(checkoutBody({ patientId: "patient-b-id" }));
    expect(parsed).not.toHaveProperty("patientId");
  });
});

// ===========================================================================
// APT-020 — Cross-doctor slot manipulation
// ===========================================================================
describe("APT-020 — Cross-doctor slot manipulation", () => {
  test("the double-booking conflict check is scoped to the requested doctorId — another doctor's booking at the same time never blocks this one", async () => {
    await callCheckout(checkoutBody({ doctorId: VALID_DOCTOR_ID }));

    const conflictFilterArg = mockAppointmentFindOne.mock.calls[0][0];
    expect(conflictFilterArg.doctorId).toBe(VALID_DOCTOR_ID);
  });

  test("booking Doctor B with a slotId/time identical to Doctor A's real appointment does not touch Doctor A's data (conflict check queried only against doctorId=B)", async () => {
    mockAppointmentFindOne.mockReturnValue(chain(null)); // Doctor B has no conflict of their own
    const { res } = await callCheckout(checkoutBody({ doctorId: VALID_DOCTOR_ID }));
    expect(res.status).toBe(200);
    // Only one doctorId was ever queried for conflicts — Doctor B's, not some other doctor's.
    for (const call of mockAppointmentFindOne.mock.calls) {
      expect(call[0].doctorId).toBe(VALID_DOCTOR_ID);
    }
  });
});

// ===========================================================================
// APT-021 — Concurrent booking / race condition (mocked only, no real Atlas)
// ===========================================================================
describe("APT-021 — Concurrent booking / race condition", () => {
  test("FIXED: when the DB-level unique index rejects the loser's write as a duplicate key, exactly one of two concurrent checkouts succeeds and the other gets a clean 409", async () => {
    // Both "simultaneous" requests still pass the app-level findOne()
    // conflict check (mock always returns null) — reproducing the exact
    // TOCTOU window two real near-simultaneous requests would hit. The fix
    // isn't in that check; it's that the second create() now fails with a
    // duplicate-key error (E11000) exactly as the real unique partial index
    // on Appointment{doctorId, scheduledStart} (active statuses) would
    // produce once the loser's write reaches Mongo after the winner's.
    mockAppointmentFindOne.mockReturnValue(chain(null));
    mockAppointmentCreate
      .mockResolvedValueOnce({ _id: { toString: () => "race-appt-A" } })
      .mockRejectedValueOnce(
        Object.assign(new Error("E11000 duplicate key error"), { code: 11000 }),
      );
    mockPaymentCreate.mockResolvedValueOnce({ _id: { toString: () => "race-payment-A" } });

    const [a, b] = await Promise.all([
      callCheckout(checkoutBody()),
      callCheckout(checkoutBody()),
    ]);

    const statuses = [a.res.status, b.res.status].sort();
    expect(statuses).toEqual([200, 409]);
    const loser = a.res.status === 409 ? a : b;
    expect(loser.json.error.message).toMatch(/no longer available/i);
    expect(mockAppointmentCreate).toHaveBeenCalledTimes(2);
    // Only the winner ever created a payment — the loser's create() threw
    // before payment creation was reached.
    expect(mockPaymentCreate).toHaveBeenCalledTimes(1);
  });

  test("the Appointment model now has a unique partial index on {doctorId, scheduledStart} for active statuses", () => {
    const modelSource = fs.readFileSync(
      path.join(__dirname, "../../../../../packages/database/src/models/appointment.model.ts"),
      "utf8",
    );
    const doctorSlotUniqueIndex =
      /appointmentSchema\.index\(\s*\{\s*doctorId:\s*1,\s*scheduledStart:\s*1\s*\}[\s\S]{0,300}unique:\s*true/;
    expect(modelSource).toMatch(doctorSlotUniqueIndex);
  });

  test("a create() failure unrelated to a duplicate key (e.g. a real DB outage) is NOT swallowed as a 409 — it still propagates as a 500", async () => {
    mockAppointmentFindOne.mockReturnValue(chain(null));
    mockAppointmentCreate.mockRejectedValueOnce(new Error("connection timeout"));

    const { res } = await callCheckout(checkoutBody());
    expect(res.status).toBe(500);
  });
});

// ===========================================================================
// APT-022 — Cancelled appointment releases the slot
// ===========================================================================
describe("APT-022 — Cancelled appointment", () => {
  test("a cancelled appointment does not permanently block the slot — the conflict filter's ACTIVE_STATUSES excludes cancelled", async () => {
    await callCheckout(checkoutBody());
    const conflictFilterArg = mockAppointmentFindOne.mock.calls[0][0];
    expect(conflictFilterArg.status.$in).not.toContain(AppointmentStatuses.CANCELLED);
  });

  test("a new valid booking succeeds when the only prior appointment for that slot is cancelled (mocked as not returned by the active-status conflict query)", async () => {
    // A cancelled appointment simply never matches the ACTIVE_STATUSES filter,
    // so the mock correctly returns null (as real Mongo would for this filter).
    mockAppointmentFindOne.mockReturnValue(chain(null));
    const { res } = await callCheckout(checkoutBody());
    expect(res.status).toBe(200);
  });
});

// ===========================================================================
// APT-023 — Restricted/inactive/deleted doctor
// ===========================================================================
describe("APT-023 — Restricted/inactive/deleted doctor", () => {
  test("restricted doctor -> rejected (covered under APT-003)", async () => {
    mockDoctorProfileFindById.mockReturnValue(
      chain({ ...APPROVED_DOCTOR, verificationStatus: VerificationStatuses.RESTRICTED }),
    );
    const { res } = await callCheckout(checkoutBody());
    expect(res.status).toBe(404);
  });

  test("FIXED: a doctor whose linked User account is deactivated/deleted (isActive=false) is now rejected, even though DoctorProfile.isListed=true + verificationStatus=approved", async () => {
    // Prior to the fix in validateSlotForBooking, this scenario returned 200
    // (bookable) — deleteOwnAccount() only flips User.isActive/deletedAt and
    // never touches the linked DoctorProfile. Confirmed as a real bug and
    // fixed by checking the populated userId's isActive/deletedAt.
    mockDoctorProfileFindById.mockReturnValue(
      chain({
        ...APPROVED_DOCTOR,
        userId: { name: "Ali Raza", isActive: false, deletedAt: new Date() },
      }),
    );

    const { res, json } = await callCheckout(checkoutBody());

    expect(res.status).toBe(404);
    expect(json.error.message).toMatch(/Doctor not found/i);
    expect(mockAppointmentCreate).not.toHaveBeenCalled();
  });

  test("FIXED: a doctor whose linked User account has deletedAt set (soft-deleted) is rejected even if isActive is still true", async () => {
    mockDoctorProfileFindById.mockReturnValue(
      chain({
        ...APPROVED_DOCTOR,
        userId: { name: "Ali Raza", isActive: true, deletedAt: new Date() },
      }),
    );

    const { res } = await callCheckout(checkoutBody());
    expect(res.status).toBe(404);
    expect(mockAppointmentCreate).not.toHaveBeenCalled();
  });

  test("an active, non-deleted doctor is still bookable (fix does not regress the normal case)", async () => {
    mockDoctorProfileFindById.mockReturnValue(chain(APPROVED_DOCTOR));
    const { res } = await callCheckout(checkoutBody());
    expect(res.status).toBe(200);
  });
});

// ===========================================================================
// APT-024 — Doctor with no availability
// ===========================================================================
describe("APT-024 — Doctor with no availability", () => {
  test("empty weeklyAvailability -> booking rejected with 409, no appointment created", async () => {
    mockDoctorProfileFindById.mockReturnValue(chain({ ...APPROVED_DOCTOR, weeklyAvailability: [] }));
    const { res, json } = await callCheckout(checkoutBody());
    expect(res.status).toBe(409);
    expect(json.error.message).toMatch(/not available/i);
    expect(mockAppointmentCreate).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// APT-025 — Price/fee manipulation
// ===========================================================================
describe("APT-025 — Price/fee manipulation", () => {
  test("a client-supplied fee/amount is ignored — the server always charges the doctor's own consultationFee", async () => {
    await callCheckout(checkoutBody({ amount: 1, consultationFee: 1, fee: 1, price: 1 }));

    expect(mockPaymentCreate).toHaveBeenCalledWith(
      expect.objectContaining({ amount: APPROVED_DOCTOR.consultationFee }),
    );
  });

  test("consultCheckoutSchema has no amount/fee/price field at all", async () => {
    const { consultCheckoutSchema } = await import("@zindagi/validators");
    const parsed = consultCheckoutSchema.parse(checkoutBody({ amount: 1 }));
    expect(parsed).not.toHaveProperty("amount");
  });
});

// ===========================================================================
// APT-026 — Appointment type manipulation
// ===========================================================================
describe("APT-026 — Appointment type manipulation", () => {
  test("type via body -> stripped, appointment stays ONLINE", async () => {
    await callCheckout(checkoutBody({ type: "home_visit" }));
    expect(mockAppointmentCreate).toHaveBeenCalledWith(expect.objectContaining({ type: AppointmentTypes.ONLINE }));
  });

  test("type via query string -> ignored (route never reads searchParams for this handler)", async () => {
    await callCheckout(checkoutBody(), "http://localhost/api/v1/consult/checkout?type=home_visit&appointmentType=clinic");
    expect(mockAppointmentCreate).toHaveBeenCalledWith(expect.objectContaining({ type: AppointmentTypes.ONLINE }));
  });

  test("type nested inside an unexpected object -> rejected by schema type-checking on known fields, or simply dropped as an unknown key; appointment stays ONLINE either way", async () => {
    const { res } = await callCheckout(checkoutBody({ meta: { type: "home_visit" }, doctor: { type: "clinic" } }));
    // Either a validation error (extra object rejected) or success with type
    // still forced server-side — both outcomes are safe. Only a 200 needs the
    // create-call assertion.
    if (res.status === 200) {
      expect(mockAppointmentCreate).toHaveBeenCalledWith(expect.objectContaining({ type: AppointmentTypes.ONLINE }));
    } else {
      expect(mockAppointmentCreate).not.toHaveBeenCalled();
    }
  });
});
