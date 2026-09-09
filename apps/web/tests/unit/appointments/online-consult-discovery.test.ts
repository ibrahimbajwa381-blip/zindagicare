/**
 * Follow-up to APT-023 — deleted/deactivated doctors must not surface in
 * patient-facing discovery either, matching the guard already added to
 * checkout's validateSlotForBooking. Pure unit tests: @zindagi/database is
 * mocked outright, no real MongoDB connection.
 */
import { NextRequest } from "next/server";
import { VerificationStatuses } from "@zindagi/shared";
import { generateConsultSlots } from "@/lib/consult/slot-utils";

// Both routes run with { public: true }, so resolveSession is never actually
// invoked on this path — mocked purely to avoid pulling in next-auth (ESM-only,
// unparsable by Jest), matching the convention in doctor-discovery.test.ts.
jest.mock("@/server/api/resolve-session", () => ({
  resolveSession: jest.fn(),
}));

const mockConnectDatabase = jest.fn();
const mockDoctorProfileFind = jest.fn();
const mockDoctorProfileFindById = jest.fn();
const mockAppointmentFind = jest.fn();
const mockAppointmentUpdateMany = jest.fn();

jest.mock("@zindagi/database", () => ({
  connectDatabase: (...args: unknown[]) => mockConnectDatabase(...args),
  DoctorProfileModel: {
    find: (...args: unknown[]) => mockDoctorProfileFind(...args),
    findById: (...args: unknown[]) => mockDoctorProfileFindById(...args),
  },
  AppointmentModel: {
    find: (...args: unknown[]) => mockAppointmentFind(...args),
    updateMany: (...args: unknown[]) => mockAppointmentUpdateMany(...args),
  },
}));

function chain<T>(finalValue: T) {
  const obj = { ...(finalValue as Record<string, unknown>) } as Record<string, unknown>;
  obj.lean = jest.fn().mockResolvedValue(finalValue);
  obj.populate = jest.fn(() => obj);
  obj.select = jest.fn(() => obj);
  obj.sort = jest.fn(() => obj);
  return obj;
}

const VALID_DOCTOR_ID = "507f1f77bcf86cd799439011";
const ALL_DAY_AVAILABILITY = Array.from({ length: 7 }, (_, dayOfWeek) => ({
  dayOfWeek,
  startTimeLocal: "00:00",
  endTimeLocal: "23:40",
}));

function doctorFixture(overrides: Record<string, unknown> = {}) {
  return {
    _id: { toString: () => VALID_DOCTOR_ID },
    isListed: true,
    verificationStatus: VerificationStatuses.APPROVED,
    coverageCities: ["Lahore"],
    specialties: ["Cardiologist"],
    primarySpecialty: "Cardiologist",
    consultationFee: 1500,
    ratingAvg: 4.5,
    ratingCount: 10,
    pmdcVerified: true,
    weeklyAvailability: ALL_DAY_AVAILABILITY,
    userId: { name: "Ali Raza", avatarUrl: undefined, isActive: true, deletedAt: null },
    ...overrides,
  };
}

beforeEach(() => {
  jest.resetModules();
  jest.clearAllMocks();
  mockConnectDatabase.mockResolvedValue(undefined);
  mockAppointmentFind.mockReturnValue(chain([]));
  mockAppointmentUpdateMany.mockResolvedValue({});
});

describe("Discovery — deactivated/deleted doctor exclusion (follow-up to APT-023)", () => {
  test("listConsultDoctors excludes a doctor whose linked User is deactivated (isActive=false), even though DoctorProfile.isListed=true", async () => {
    mockDoctorProfileFind.mockReturnValue(
      chain([doctorFixture({ userId: { name: "Ali Raza", isActive: false, deletedAt: null } })]),
    );

    const { GET } = await import("@/app/api/v1/consult/doctors/route");
    const res = await GET(new NextRequest("http://localhost/api/v1/consult/doctors?city=Lahore"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toEqual([]);
  });

  test("listConsultDoctors excludes a doctor whose linked User is soft-deleted (deletedAt set)", async () => {
    mockDoctorProfileFind.mockReturnValue(
      chain([doctorFixture({ userId: { name: "Ali Raza", isActive: true, deletedAt: new Date() } })]),
    );

    const { GET } = await import("@/app/api/v1/consult/doctors/route");
    const res = await GET(new NextRequest("http://localhost/api/v1/consult/doctors?city=Lahore"));
    const body = await res.json();

    expect(body.data).toEqual([]);
  });

  test("listConsultDoctors still returns a genuinely active doctor (fix does not regress the normal case)", async () => {
    mockDoctorProfileFind.mockReturnValue(chain([doctorFixture()]));

    const { GET } = await import("@/app/api/v1/consult/doctors/route");
    const res = await GET(new NextRequest("http://localhost/api/v1/consult/doctors?city=Lahore"));
    const body = await res.json();

    expect(body.data).toHaveLength(1);
    expect(body.data[0].doctorId).toBe(VALID_DOCTOR_ID);
  });

  test("getSlotsForDoctor (slots endpoint) returns 404 for a deactivated doctor instead of leaking their slots", async () => {
    mockDoctorProfileFindById.mockReturnValue(
      chain(doctorFixture({ userId: { isActive: false, deletedAt: null } })),
    );

    const { GET } = await import("@/app/api/v1/consult/slots/route");
    const res = await GET(
      new NextRequest(`http://localhost/api/v1/consult/slots?doctorId=${VALID_DOCTOR_ID}`),
    );
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error.message).toMatch(/Doctor not found/i);
  });

  test("getSlotsForDoctor (slots endpoint) returns 404 for a soft-deleted doctor", async () => {
    mockDoctorProfileFindById.mockReturnValue(
      chain(doctorFixture({ userId: { isActive: true, deletedAt: new Date() } })),
    );

    const { GET } = await import("@/app/api/v1/consult/slots/route");
    const res = await GET(
      new NextRequest(`http://localhost/api/v1/consult/slots?doctorId=${VALID_DOCTOR_ID}`),
    );
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error.message).toMatch(/Doctor not found/i);
  });

  test("getSlotsForDoctor (slots endpoint) still returns slots for a genuinely active doctor", async () => {
    mockDoctorProfileFindById.mockReturnValue(chain(doctorFixture()));

    const { GET } = await import("@/app/api/v1/consult/slots/route");
    const res = await GET(
      new NextRequest(`http://localhost/api/v1/consult/slots?doctorId=${VALID_DOCTOR_ID}`),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(Array.isArray(body.data.slots)).toBe(true);
    // Sanity check the fixture's availability actually yields future slots.
    expect(
      generateConsultSlots(ALL_DAY_AVAILABILITY, new Date(), 1, 20).length,
    ).toBeGreaterThan(0);
  });
});
