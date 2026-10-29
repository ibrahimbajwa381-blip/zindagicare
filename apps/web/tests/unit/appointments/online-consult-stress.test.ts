/**
 * Stress / adversarial-input tests for the online-consult routes
 * (checkout, doctor discovery, slots). Goal: prove these routes degrade to a
 * clean 4xx/5xx JSON response under hostile or extreme input and under high
 * concurrency — never an unhandled exception, never a hang, never a raw
 * stack trace leaked to the client.
 *
 * Pure unit tests: @zindagi/database is mocked outright (no real MongoDB
 * connection), matching the convention in online-consult-checkout.test.ts.
 */
import { NextRequest } from "next/server";
import { Roles, VerificationStatuses } from "@zindagi/shared";
import { generateConsultSlots, parseConsultSlotId } from "@/lib/consult/slot-utils";

jest.mock("@/server/api/resolve-session", () => ({
  resolveSession: (...args: unknown[]) => mockResolveSession(...args),
}));
const mockResolveSession = jest.fn();

const mockConnectDatabase = jest.fn();
const mockDoctorProfileFind = jest.fn();
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
    find: (...args: unknown[]) => mockDoctorProfileFind(...args),
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

jest.mock("@/lib/notifications/consult-notifications", () => ({
  sendOnlineConsultConfirmation: jest.fn(),
  sendDoctorConsultBooked: jest.fn(),
}));

jest.mock("@/server/services/chat.service", () => ({
  ChatService: {
    ensureAppointmentThread: jest.fn(),
    startIntakeConversation: jest.fn(),
  },
}));

// This file's concurrency scenarios deliberately fire 25-50+ near-simultaneous
// checkout requests from one mocked session to prove DB-level idempotency
// (unique-index/race handling) — a different concern from per-user abuse
// throttling (see tests/integration/rate-limit-endpoints.test.ts RT-007 for
// that). Neutralize the route's rate limiter here so it can't produce a
// false 429 partway through a burst and mask the actual race-condition
// assertion under test.
jest.mock("@/server/lib/rate-limit", () => {
  const actual = jest.requireActual("@/server/lib/rate-limit");
  return {
    ...actual,
    createRateLimiter: () => ({
      consume: () => ({ allowed: true, remaining: Infinity, retryAfterSeconds: 0 }),
    }),
  };
});

function chain<T>(finalValue: T) {
  const obj = { ...(finalValue as Record<string, unknown>) } as Record<string, unknown>;
  obj.lean = jest.fn().mockResolvedValue(finalValue);
  obj.populate = jest.fn(() => obj);
  obj.select = jest.fn(() => obj);
  obj.sort = jest.fn(() => obj);
  return obj;
}

/** A chain whose .lean() rejects — simulates a real DoctorProfileModel.findById(garbage) CastError. */
function rejectingChain(err: unknown) {
  const obj: Record<string, unknown> = {};
  obj.lean = jest.fn().mockRejectedValue(err);
  obj.populate = jest.fn(() => obj);
  obj.select = jest.fn(() => obj);
  obj.sort = jest.fn(() => obj);
  return obj;
}

const PATIENT_A = { user: { id: "patient-a-id", roles: [Roles.PATIENT] } };
const VALID_DOCTOR_ID = "507f1f77bcf86cd799439011";
const ALL_DAY_AVAILABILITY = Array.from({ length: 7 }, (_, dayOfWeek) => ({
  dayOfWeek,
  startTimeLocal: "00:00",
  endTimeLocal: "23:40",
}));
const REAL_FUTURE_SLOTS = generateConsultSlots(ALL_DAY_AVAILABILITY, new Date(), 14, 20);
const VALID_SLOT_ID = REAL_FUTURE_SLOTS[0].slotId;

const APPROVED_DOCTOR = {
  _id: { toString: () => VALID_DOCTOR_ID },
  isListed: true,
  verificationStatus: VerificationStatuses.APPROVED,
  consultationFee: 1500,
  weeklyAvailability: ALL_DAY_AVAILABILITY,
  userId: { name: "Ali Raza", isActive: true, deletedAt: null, _id: "doctor-user-id" },
};

const PENDING_PHONE_USER = { phone: "+923001234567", name: "Test Patient" };

function req(url: string, init: RequestInit & { headers?: Record<string, string> } = {}) {
  return new NextRequest(url, init as ConstructorParameters<typeof NextRequest>[1]);
}

/** Short display label for a long/hostile string — keeps test-runner output and CI logs readable. */
function label(value: string, max = 30): string {
  return value.length > max ? `${value.slice(0, max)}…(${value.length} chars)` : value;
}

/** Pairs each hostile value with a short label so test.each("%s", ...) prints cleanly. */
function labeled(values: string[]): [string, string][] {
  return values.map((v) => [label(v), v]);
}

async function callCheckout(body: unknown) {
  const { POST } = await import("@/app/api/v1/consult/checkout/route");
  const res = await POST(
    req("http://localhost/api/v1/consult/checkout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );
  const json = await res.json();
  return { res, json };
}

async function callDoctors(rawQuery: string) {
  const { GET } = await import("@/app/api/v1/consult/doctors/route");
  const res = await GET(req(`http://localhost/api/v1/consult/doctors?${rawQuery}`));
  const json = await res.json();
  return { res, json };
}

async function callSlots(rawQuery: string) {
  const { GET } = await import("@/app/api/v1/consult/slots/route");
  const res = await GET(req(`http://localhost/api/v1/consult/slots?${rawQuery}`));
  const json = await res.json();
  return { res, json };
}

function checkoutBody(overrides: Record<string, unknown> = {}) {
  return { doctorId: VALID_DOCTOR_ID, slotId: VALID_SLOT_ID, ...overrides };
}

function setupHappyPathMocks() {
  mockConnectDatabase.mockResolvedValue(undefined);
  mockAttributeReferralIfEligible.mockResolvedValue(undefined);
  mockNotifyAdmins.mockResolvedValue(undefined);

  // Id-aware: only the fixture's own doctorId resolves to a real doctor —
  // any other syntactically-valid ObjectId (e.g. "000...000") must behave
  // like a real "doctor doesn't exist" lookup, not silently match.
  mockDoctorProfileFindById.mockImplementation((id: string) =>
    id === VALID_DOCTOR_ID ? chain(APPROVED_DOCTOR) : chain(null),
  );
  mockDoctorProfileFind.mockReturnValue(chain([APPROVED_DOCTOR]));
  mockAppointmentFindOne.mockReturnValue(chain(null));
  mockAppointmentFind.mockReturnValue(chain([]));
  mockUserFindById.mockReturnValue(chain(PENDING_PHONE_USER));
  mockUserFindOne.mockResolvedValue(null);

  mockAppointmentCreate.mockResolvedValue({ _id: { toString: () => "appt-new-1" } });
  mockAppointmentUpdateOne.mockResolvedValue({});
  mockAppointmentUpdateMany.mockResolvedValue({});
  mockPaymentCreate.mockResolvedValue({ _id: { toString: () => "payment-new-1" } });
  mockPaymentUpdateOne.mockResolvedValue({});
  mockPaymentFindById.mockReturnValue(chain(null));
}

// Deliberately no jest.resetModules() here (unlike online-consult-checkout.test.ts):
// re-evaluating route.ts + its transitive imports from scratch on every dynamic
// import() was the dominant cost in this file — ~200ms/test, ~3x this suite's
// total runtime — for no correctness benefit, since no stress test here depends
// on fresh module-level state (e.g. expireStalePendingBookings' throttle var).
// jest.clearAllMocks() below still fully re-arms every mock's return value and
// call history each test, which is all these fuzzing/concurrency tests need.
beforeEach(() => {
  jest.clearAllMocks();
  mockResolveSession.mockResolvedValue(PATIENT_A);
  setupHappyPathMocks();
});

// ===========================================================================
// STRESS-001 — High-concurrency booking storm (beyond the 2-request case)
// ===========================================================================
describe("STRESS-001 — N-way concurrent checkout storm on the same slot", () => {
  test("25 simultaneous checkouts for the same doctor+slot: exactly one 200, every loser gets a clean 409, none crash to 500", async () => {
    mockAppointmentFindOne.mockReturnValue(chain(null)); // every request passes the app-level check
    let createCalls = 0;
    mockAppointmentCreate.mockImplementation(() => {
      createCalls += 1;
      if (createCalls === 1) {
        return Promise.resolve({ _id: { toString: () => "race-winner" } });
      }
      return Promise.reject(Object.assign(new Error("E11000 duplicate key"), { code: 11000 }));
    });
    mockPaymentCreate.mockResolvedValue({ _id: { toString: () => "race-payment" } });

    const N = 25;
    const results = await Promise.all(Array.from({ length: N }, () => callCheckout(checkoutBody())));

    const statuses = results.map((r) => r.res.status);
    const wins = statuses.filter((s) => s === 200);
    const losses = statuses.filter((s) => s === 409);
    const crashes = statuses.filter((s) => s !== 200 && s !== 409);

    expect(wins).toHaveLength(1);
    expect(losses).toHaveLength(N - 1);
    expect(crashes).toHaveLength(0);
    expect(mockAppointmentCreate).toHaveBeenCalledTimes(N);
  });

  test("50 concurrent checkouts across only 3 distinct doctors: no cross-contamination, no unhandled rejection, every response is well-formed JSON", async () => {
    const doctorIds = ["507f1f77bcf86cd799439011", "507f1f77bcf86cd799439012", "507f1f77bcf86cd799439013"];
    mockDoctorProfileFindById.mockImplementation((id: string) =>
      chain({ ...APPROVED_DOCTOR, _id: { toString: () => id } }),
    );
    mockAppointmentFindOne.mockReturnValue(chain(null));
    const winners = new Set<string>();
    mockAppointmentCreate.mockImplementation((doc: { doctorId: string }) => {
      if (winners.has(doc.doctorId)) {
        return Promise.reject(Object.assign(new Error("dup"), { code: 11000 }));
      }
      winners.add(doc.doctorId);
      return Promise.resolve({ _id: { toString: () => `appt-${doc.doctorId}` } });
    });
    mockPaymentCreate.mockResolvedValue({ _id: { toString: () => "payment" } });

    const calls = Array.from({ length: 50 }, (_, i) =>
      callCheckout(checkoutBody({ doctorId: doctorIds[i % doctorIds.length] })),
    );
    const results = await Promise.all(calls);

    for (const { res, json } of results) {
      expect([200, 409]).toContain(res.status);
      expect(json).toHaveProperty("success");
      expect(json).toHaveProperty("error");
    }
    // Exactly one winner per distinct doctor.
    const winsByDoctor = new Map<string, number>();
    results.forEach((r, i) => {
      if (r.res.status === 200) {
        const d = doctorIds[i % doctorIds.length];
        winsByDoctor.set(d, (winsByDoctor.get(d) ?? 0) + 1);
      }
    });
    for (const count of winsByDoctor.values()) {
      expect(count).toBe(1);
    }
  });
});

// ===========================================================================
// STRESS-002 — Adversarial checkout payloads
// ===========================================================================
describe("STRESS-002 — Adversarial / malformed checkout request bodies never produce a 500", () => {
  const hostileDoctorIds = [
    "a".repeat(5_000), // far longer than any real ObjectId — proves oversized input alone doesn't crash the route
    "__proto__",
    "constructor",
    "$where",
    '{"$gt":""}',
    "$ne",
    "   ",
    "🚀".repeat(1000),
    "\\u0000; DROP TABLE appointments;--",
    "../../../etc/passwd",
    "<script>alert(1)</script>",
    "0".repeat(24), // valid-length but all-zero ObjectId shape
    "-1",
    "NaN",
    "null",
    "undefined",
  ];

  test.each(labeled(hostileDoctorIds))("hostile doctorId %s -> clean 4xx, never 500, no appointment created", async (_label, doctorId) => {
    const { res } = await callCheckout(checkoutBody({ doctorId }));
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
    expect(mockAppointmentCreate).not.toHaveBeenCalled();
  });

  const hostileSlotIds = [
    "a".repeat(5_000),
    "9999-99-99:99:99", // regex-shaped but calendar-nonsensical
    "0000-00-00:00:00",
    "2024-13-45:25:99",
    "2024-02-30:10:00", // Feb 30 doesn't exist
    "____-__-__:__:__",
    "2024-01-01:10:00 extra",
    "__proto__",
    "-2024-01-01:10:00",
  ];

  test.each(labeled(hostileSlotIds))("hostile slotId %s -> clean 4xx (never 500), no appointment created", async (_label, slotId) => {
    const { res } = await callCheckout(checkoutBody({ slotId }));
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
    expect(mockAppointmentCreate).not.toHaveBeenCalled();
  });

  test("prototype-pollution-shaped body (__proto__/constructor keys) is parsed safely and never pollutes Object.prototype", async () => {
    const evilPayload = `{"doctorId":"${VALID_DOCTOR_ID}","slotId":"${VALID_SLOT_ID}","__proto__":{"polluted":"yes"},"constructor":{"prototype":{"polluted":"yes"}}}`;
    await callCheckout(evilPayload);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  test("deeply nested object body (2000 levels) does not hang or crash the handler", async () => {
    const nested: Record<string, unknown> = { doctorId: VALID_DOCTOR_ID, slotId: VALID_SLOT_ID };
    let cursor = nested;
    for (let i = 0; i < 2000; i++) {
      cursor.child = {};
      cursor = cursor.child as Record<string, unknown>;
    }
    const { res } = await callCheckout(nested);
    expect(res.status).toBeGreaterThanOrEqual(200);
    expect(res.status).toBeLessThan(600);
  });

  test("huge array body instead of an object -> clean 4xx, no crash", async () => {
    const { res } = await callCheckout(Array.from({ length: 10000 }, (_, i) => i));
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });

  // Calling the wrapped route's POST() directly inside Jest with a body that
  // makes req.json() throw triggers an unrelated Next.js/Jest source-map
  // lazy-require quirk ("AsyncLocalStorage accessed in runtime where it is
  // not available") that only reproduces inside this test harness — it's a
  // stack-trace-decoration side effect of the wrapped closure, not our code.
  // Verified directly against the real dev server instead (`next dev`, curl
  // with a malformed/empty JSON body against a public bodySchema route):
  // the server returned a clean `{"success":false,...,"code":"INTERNAL_ERROR"}`
  // with HTTP 500 both times, and a follow-up request confirmed the server
  // process stayed up and kept serving normally. The primitive itself
  // (NextRequest.json() on bad input) is a normal catchable rejection, which
  // is what actually matters for withApiHandler's try/catch to work:
  test("the underlying primitive — NextRequest.json() on malformed JSON — throws a normal catchable error, never crashes synchronously", async () => {
    const malformedReq = req("http://localhost/api/v1/consult/checkout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{not valid json!!!",
    });
    await expect(malformedReq.json()).rejects.toThrow();
  });

  test("null body -> clean 4xx", async () => {
    const { res } = await callCheckout(null);
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });

  test("the underlying primitive — NextRequest.json() on an empty body — also throws a normal catchable error", async () => {
    const emptyReq = req("http://localhost/api/v1/consult/checkout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "",
    });
    await expect(emptyReq.json()).rejects.toThrow();
  });
});

// ===========================================================================
// STRESS-003 — The database throws garbage, not well-formed Errors
// ===========================================================================
describe("STRESS-003 — Non-Error rejections from the persistence layer never crash the process", () => {
  const garbageRejections: unknown[] = [
    "a plain string thrown as a rejection",
    undefined,
    null,
    42,
    { message: "no code field, not an Error instance" },
    (() => {
      const circular: Record<string, unknown> = { code: 11000 };
      circular.self = circular;
      return circular;
    })(),
  ];

  test.each(garbageRejections)("AppointmentModel.create rejecting with %p resolves to a clean JSON error response", async (garbage) => {
    mockAppointmentFindOne.mockReturnValue(chain(null));
    mockAppointmentCreate.mockRejectedValueOnce(garbage);

    const { res, json } = await callCheckout(checkoutBody());
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(json.success).toBe(false);
    expect(typeof json.error.message).toBe("string");
  });

  test("DoctorProfileModel.findById().lean() rejecting (simulated real CastError) never crashes — clean error response", async () => {
    mockDoctorProfileFindById.mockReturnValue(
      rejectingChain(new Error('Cast to ObjectId failed for value "garbage"')),
    );
    const { res, json } = await callCheckout(checkoutBody({ doctorId: "z".repeat(24) }));
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(json.success).toBe(false);
  });

  test("a thrown value with a `toString` that itself throws does not crash apiError's console.error", async () => {
    const evil = {
      get message() {
        throw new Error("nested throw while reading .message");
      },
    };
    mockAppointmentFindOne.mockReturnValue(chain(null));
    mockAppointmentCreate.mockRejectedValueOnce(evil);

    const { res } = await callCheckout(checkoutBody());
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});

// ===========================================================================
// STRESS-004 — Doctor discovery / slots endpoints under hostile query input
// ===========================================================================
describe("STRESS-004 — Discovery + slots endpoints survive hostile query strings", () => {
  const hostileQueryValues = [
    "a".repeat(5_000),
    "$where=1",
    "__proto__=polluted",
    "🚀".repeat(200),
    "  ",
    "(a+)+$", // classic ReDoS pattern, should be treated as a literal string
    "a".repeat(50) + "!".repeat(2_000),
  ];

  test.each(labeled(hostileQueryValues))("GET /consult/doctors?city=%s never returns 5xx", async (_label, value) => {
    mockDoctorProfileFind.mockReturnValue(chain([]));
    const { res } = await callDoctors(`city=${encodeURIComponent(value)}`);
    expect(res.status).toBeLessThan(500);
  });

  test.each(labeled(hostileQueryValues))("GET /consult/doctors?specialty=%s never returns 5xx", async (_label, value) => {
    mockDoctorProfileFind.mockReturnValue(chain([]));
    const { res } = await callDoctors(`specialty=${encodeURIComponent(value)}`);
    expect(res.status).toBeLessThan(500);
  });

  test("hundreds of distinct query params does not hang or crash", async () => {
    mockDoctorProfileFind.mockReturnValue(chain([]));
    const rawQuery = Array.from({ length: 500 }, (_, i) => `x${i}=1`).join("&");
    const { res } = await callDoctors(rawQuery);
    expect(res.status).toBeLessThan(500);
  });

  const hostileDoctorIdsForSlots = [
    "not-an-object-id",
    "z".repeat(24),
    "__proto__",
    "a".repeat(5_000),
    "",
  ];

  test.each(labeled(hostileDoctorIdsForSlots))("GET /consult/slots?doctorId=%s -> clean 4xx, never 5xx", async (_label, doctorId) => {
    const { res } = await callSlots(`doctorId=${encodeURIComponent(doctorId)}`);
    expect(res.status).toBeLessThan(500);
  });

  test("GET /consult/slots with a calendar-nonsensical but regex-valid date (9999-99-99) -> clean 400, not a raw date-fns crash", async () => {
    mockDoctorProfileFindById.mockReturnValue(chain(APPROVED_DOCTOR));
    const { res, json } = await callSlots(`doctorId=${VALID_DOCTOR_ID}&date=9999-99-99`);
    expect(res.status).toBe(400);
    expect(json.error.message).toMatch(/invalid date/i);
  });

  test("GET /consult/slots with Feb 30 (regex-valid, calendar-invalid) -> clean 400", async () => {
    mockDoctorProfileFindById.mockReturnValue(chain(APPROVED_DOCTOR));
    const { res } = await callSlots(`doctorId=${VALID_DOCTOR_ID}&date=2024-02-30`);
    expect(res.status).toBe(400);
  });

  test("GET /consult/slots with a genuinely valid leap-day date (2024-02-29) succeeds normally", async () => {
    mockDoctorProfileFindById.mockReturnValue(chain(APPROVED_DOCTOR));
    const { res } = await callSlots(`doctorId=${VALID_DOCTOR_ID}&date=2024-02-29`);
    expect(res.status).toBe(200);
  });

  test("60 concurrent discovery requests with varied hostile params complete without any 5xx or hang", async () => {
    mockDoctorProfileFind.mockReturnValue(chain([APPROVED_DOCTOR]));
    const cities = ["Lahore", "$ne", "a".repeat(5_000), "__proto__", "", "  ", "🚀"];
    const calls = Array.from({ length: 60 }, (_, i) =>
      callDoctors(`city=${encodeURIComponent(cities[i % cities.length])}`),
    );
    const results = await Promise.all(calls);
    for (const { res } of results) {
      expect(res.status).toBeLessThan(500);
    }
  });
});

// ===========================================================================
// STRESS-005 — parseConsultSlotId hardening (unit-level, no HTTP layer)
// ===========================================================================
describe("STRESS-005 — parseConsultSlotId rejects calendar-nonsensical ids instead of returning a silent Invalid Date", () => {
  const invalidButShapelyIds = [
    "9999-99-99:99:99",
    "0000-00-00:00:00",
    "2024-13-01:10:00",
    "2024-01-32:10:00",
    "2024-02-30:10:00",
    "2023-02-29:10:00", // not a leap year
  ];

  test.each(invalidButShapelyIds)("%p throws instead of yielding an Invalid Date", (slotId) => {
    expect(() => parseConsultSlotId(slotId)).toThrow();
  });

  test("a genuinely valid slot id still parses to a real, non-NaN Date", () => {
    const { startAt } = parseConsultSlotId("2024-06-15:10:00");
    expect(Number.isNaN(startAt.getTime())).toBe(false);
  });
});

// ===========================================================================
// STRESS-006 — Sanity: none of the above ever left dangling mock state that
// would make a legitimate booking fail afterwards (no shared-state leakage
// between stress iterations).
// ===========================================================================
describe("STRESS-006 — A normal booking still succeeds after a batch of hostile requests", () => {
  test("happy-path checkout works after running the full hostile-doctorId matrix in sequence", async () => {
    for (const doctorId of ["__proto__", "$ne", "a".repeat(1000)]) {
      await callCheckout(checkoutBody({ doctorId }));
    }
    const { res, json } = await callCheckout(checkoutBody());
    expect(res.status).toBe(200);
    expect(json.data.appointmentId).toBe("appt-new-1");
  });
});
