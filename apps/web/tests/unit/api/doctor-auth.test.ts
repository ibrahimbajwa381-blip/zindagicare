/**
 * BE-002: doctor bank-account, referral, and avatar-upload must accept
 * mobile Bearer auth (via resolveSession) the same way chat/events already
 * does, without breaking web cookie auth or doctor-to-doctor isolation.
 *
 * resolveSession itself is mocked here — its own web/mobile branching is
 * covered separately in resolve-session.test.ts. This file tests that the
 * three routes (a) call resolveSession, (b) 401 when it returns null,
 * (c) never let one doctor touch another doctor's data, and (d) don't
 * reintroduce a second, route-local auth mechanism. No DB/storage access:
 * every service call is mocked.
 */
import fs from "fs";
import path from "path";
import { Roles } from "@zindagi/shared";

const mockResolveSession = jest.fn();
jest.mock("@/server/api/resolve-session", () => ({
  resolveSession: (...args: unknown[]) => mockResolveSession(...args),
}));

const mockGetOwnDoctorBankAccount = jest.fn();
const mockUpdateOwnDoctorBankAccount = jest.fn();
jest.mock("@/server/services/admin-doctor-finance.service", () => ({
  getOwnDoctorBankAccount: (...args: unknown[]) => mockGetOwnDoctorBankAccount(...args),
  updateOwnDoctorBankAccount: (...args: unknown[]) => mockUpdateOwnDoctorBankAccount(...args),
}));

const mockDoctorProfileFindOne = jest.fn();
jest.mock("@zindagi/database", () => ({
  DoctorProfileModel: { findOne: (...args: unknown[]) => mockDoctorProfileFindOne(...args) },
}));

const mockGetDoctorReferralInfo = jest.fn();
const mockGetReferredPatientsSummary = jest.fn();
const mockRegenerateDoctorReferralCode = jest.fn();
jest.mock("@/server/services/doctor-referral.service", () => ({
  getDoctorReferralInfo: (...args: unknown[]) => mockGetDoctorReferralInfo(...args),
  getReferredPatientsSummary: (...args: unknown[]) => mockGetReferredPatientsSummary(...args),
  regenerateDoctorReferralCode: (...args: unknown[]) => mockRegenerateDoctorReferralCode(...args),
}));

const mockSaveDoctorAvatar = jest.fn();
jest.mock("@/server/services/doctor-avatar.storage", () => ({
  saveDoctorAvatar: (...args: unknown[]) => mockSaveDoctorAvatar(...args),
}));

const DOCTOR_A = { user: { id: "doctor-a-id", roles: [Roles.DOCTOR] } };
const DOCTOR_B = { user: { id: "doctor-b-id", roles: [Roles.DOCTOR] } };

function leanQuery(result: unknown) {
  return { select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(result) }) };
}

function req(url: string, init: RequestInit & { headers?: Record<string, string> } = {}) {
  return new Request(url, init);
}

const ROUTE_FILES = {
  bankAccount: path.join(__dirname, "../../../src/app/api/v1/doctor/bank-account/route.ts"),
  referral: path.join(__dirname, "../../../src/app/api/v1/doctor/referral/route.ts"),
  avatarUpload: path.join(__dirname, "../../../src/app/api/v1/doctor/avatar/upload/route.ts"),
};

beforeEach(() => {
  jest.resetModules();
  mockResolveSession.mockReset();
  mockGetOwnDoctorBankAccount.mockReset();
  mockUpdateOwnDoctorBankAccount.mockReset();
  mockDoctorProfileFindOne.mockReset();
  mockGetDoctorReferralInfo.mockReset();
  mockGetReferredPatientsSummary.mockReset();
  mockRegenerateDoctorReferralCode.mockReset();
  mockSaveDoctorAvatar.mockReset();
});

describe("BE002-T14: routes use the shared resolveSession pattern, not a new one", () => {
  test("none of the three routes import auth() from @/lib/auth directly", () => {
    for (const file of Object.values(ROUTE_FILES)) {
      const source = fs.readFileSync(file, "utf8");
      expect(source).not.toMatch(/import\s*{\s*auth\s*}\s*from\s*["']@\/lib\/auth["']/);
      expect(source).toMatch(/resolveSession/);
    }
  });
});

describe("BE-002: doctor bank-account (/api/v1/doctor/bank-account)", () => {
  test("BE002-T01: valid session → GET returns the authenticated doctor's bank account", async () => {
    mockResolveSession.mockResolvedValue(DOCTOR_A);
    mockGetOwnDoctorBankAccount.mockResolvedValue({ accountTitle: "A's Account" });

    const { GET } = await import("@/app/api/v1/doctor/bank-account/route");
    const res = await GET(req("http://localhost/api/v1/doctor/bank-account", {
      headers: { authorization: "Bearer valid-mobile-token" },
    }));

    expect(res.status).toBe(200);
    expect(mockGetOwnDoctorBankAccount).toHaveBeenCalledWith("doctor-a-id");
    const body = await res.json();
    expect(body.data.bankAccount).toEqual({ accountTitle: "A's Account" });
  });

  test("BE002-T02: valid session → PATCH reaches the update logic without touching a real DB", async () => {
    mockResolveSession.mockResolvedValue(DOCTOR_A);
    mockUpdateOwnDoctorBankAccount.mockResolvedValue({ accountTitle: "Updated" });

    const { PATCH } = await import("@/app/api/v1/doctor/bank-account/route");
    const res = await PATCH(
      req("http://localhost/api/v1/doctor/bank-account", {
        method: "PATCH",
        headers: { authorization: "Bearer valid-mobile-token", "content-type": "application/json" },
        body: JSON.stringify({
          accountTitle: "Updated",
          accountNumber: "12345",
          bankName: "HBL",
        }),
      }),
    );

    expect(res.status).toBe(200);
    expect(mockUpdateOwnDoctorBankAccount).toHaveBeenCalledWith(
      "doctor-a-id",
      expect.objectContaining({ accountTitle: "Updated", bankName: "HBL" }),
    );
  });

  test("BE002-T03: no authentication → GET is rejected with 401", async () => {
    mockResolveSession.mockResolvedValue(null);
    const { GET } = await import("@/app/api/v1/doctor/bank-account/route");
    const res = await GET(req("http://localhost/api/v1/doctor/bank-account"));
    expect(res.status).toBe(401);
    expect(mockGetOwnDoctorBankAccount).not.toHaveBeenCalled();
  });

  test("BE002-T04: invalid Bearer token → GET is rejected with 401", async () => {
    mockResolveSession.mockResolvedValue(null); // resolveSession's own contract for a bad token
    const { GET } = await import("@/app/api/v1/doctor/bank-account/route");
    const res = await GET(
      req("http://localhost/api/v1/doctor/bank-account", {
        headers: { authorization: "Bearer garbage-token" },
      }),
    );
    expect(res.status).toBe(401);
    expect(mockGetOwnDoctorBankAccount).not.toHaveBeenCalled();
  });

  test("BE002-T12: Doctor A cannot read or write Doctor B's bank account", async () => {
    const { GET, PATCH } = await import("@/app/api/v1/doctor/bank-account/route");

    mockResolveSession.mockResolvedValue(DOCTOR_A);
    mockGetOwnDoctorBankAccount.mockResolvedValue({ accountTitle: "A" });
    await GET(req("http://localhost/api/v1/doctor/bank-account", {
      headers: { authorization: "Bearer a-token" },
    }));
    expect(mockGetOwnDoctorBankAccount).toHaveBeenLastCalledWith("doctor-a-id");

    mockResolveSession.mockResolvedValue(DOCTOR_B);
    mockGetOwnDoctorBankAccount.mockResolvedValue({ accountTitle: "B" });
    await GET(req("http://localhost/api/v1/doctor/bank-account", {
      headers: { authorization: "Bearer b-token" },
    }));
    expect(mockGetOwnDoctorBankAccount).toHaveBeenLastCalledWith("doctor-b-id");

    // A malicious "doctorId" in the PATCH body must never override the session owner.
    mockResolveSession.mockResolvedValue(DOCTOR_A);
    mockUpdateOwnDoctorBankAccount.mockResolvedValue({});
    await PATCH(
      req("http://localhost/api/v1/doctor/bank-account", {
        method: "PATCH",
        headers: { authorization: "Bearer a-token", "content-type": "application/json" },
        body: JSON.stringify({
          doctorId: "doctor-b-id",
          accountTitle: "Hijack",
          accountNumber: "999",
          bankName: "Evil Bank",
        }),
      }),
    );
    expect(mockUpdateOwnDoctorBankAccount).toHaveBeenCalledWith(
      "doctor-a-id",
      expect.anything(),
    );
  });
});

describe("BE-002: doctor referral (/api/v1/doctor/referral)", () => {
  beforeEach(() => {
    mockDoctorProfileFindOne.mockReturnValue(leanQuery({ _id: "profile-a-id" }));
  });

  test("BE002-T05: valid session → GET returns the authenticated doctor's referral data", async () => {
    mockResolveSession.mockResolvedValue(DOCTOR_A);
    mockGetDoctorReferralInfo.mockResolvedValue({ code: "REF-A" });
    mockGetReferredPatientsSummary.mockResolvedValue({ count: 3 });

    const { GET } = await import("@/app/api/v1/doctor/referral/route");
    const res = await GET(req("http://localhost/api/v1/doctor/referral", {
      headers: { authorization: "Bearer valid-mobile-token" },
    }));

    expect(res.status).toBe(200);
    expect(mockGetDoctorReferralInfo).toHaveBeenCalledWith("profile-a-id");
  });

  test("BE002-T06: valid session → POST reaches the regenerate logic without touching a real DB", async () => {
    mockResolveSession.mockResolvedValue(DOCTOR_A);
    mockRegenerateDoctorReferralCode.mockResolvedValue(undefined);
    mockGetDoctorReferralInfo.mockResolvedValue({ code: "REF-A-NEW" });

    const { POST } = await import("@/app/api/v1/doctor/referral/route");
    const res = await POST(req("http://localhost/api/v1/doctor/referral", {
      method: "POST",
      headers: { authorization: "Bearer valid-mobile-token" },
    }));

    expect(res.status).toBe(200);
    expect(mockRegenerateDoctorReferralCode).toHaveBeenCalledWith("profile-a-id");
  });

  test("BE002-T07: no authentication → referral request is rejected with 401", async () => {
    mockResolveSession.mockResolvedValue(null);
    const { GET } = await import("@/app/api/v1/doctor/referral/route");
    const res = await GET(req("http://localhost/api/v1/doctor/referral"));
    expect(res.status).toBe(401);
    expect(mockGetDoctorReferralInfo).not.toHaveBeenCalled();
  });

  test("BE002-T08: invalid Bearer token → referral request is rejected with 401", async () => {
    mockResolveSession.mockResolvedValue(null);
    const { POST } = await import("@/app/api/v1/doctor/referral/route");
    const res = await POST(req("http://localhost/api/v1/doctor/referral", {
      method: "POST",
      headers: { authorization: "Bearer garbage-token" },
    }));
    expect(res.status).toBe(401);
    expect(mockRegenerateDoctorReferralCode).not.toHaveBeenCalled();
  });

  test("BE002-T12: Doctor A cannot regenerate Doctor B's referral code", async () => {
    mockResolveSession.mockResolvedValue(DOCTOR_A);
    mockDoctorProfileFindOne.mockReturnValue(leanQuery({ _id: "profile-a-id" }));
    mockRegenerateDoctorReferralCode.mockResolvedValue(undefined);
    mockGetDoctorReferralInfo.mockResolvedValue({ code: "X" });

    const { POST } = await import("@/app/api/v1/doctor/referral/route");
    await POST(req("http://localhost/api/v1/doctor/referral", {
      method: "POST",
      headers: { authorization: "Bearer a-token" },
    }));

    // The profile id looked up is always the caller's own — resolved from
    // session.user.id, never from a client-supplied doctorId/profileId.
    expect(mockDoctorProfileFindOne).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "doctor-a-id" }),
    );
    expect(mockRegenerateDoctorReferralCode).toHaveBeenCalledWith("profile-a-id");
  });
});

describe("BE-002: doctor avatar upload (/api/v1/doctor/avatar/upload)", () => {
  function formDataRequest(headers: Record<string, string>, includeFile = true) {
    const fd = new FormData();
    if (includeFile) {
      fd.set("file", new File(["fake-image-bytes"], "avatar.png", { type: "image/png" }));
    }
    return new Request("http://localhost/api/v1/doctor/avatar/upload", {
      method: "POST",
      headers,
      body: fd,
    });
  }

  test("BE002-T09: valid session → upload reaches the storage logic (mocked, no real storage write)", async () => {
    mockResolveSession.mockResolvedValue(DOCTOR_A);
    mockSaveDoctorAvatar.mockResolvedValue({ avatarUrl: "/avatars/doctor-a.png" });

    const { POST } = await import("@/app/api/v1/doctor/avatar/upload/route");
    const res = await POST(formDataRequest({ authorization: "Bearer valid-mobile-token" }));

    expect(res.status).toBe(200);
    expect(mockSaveDoctorAvatar).toHaveBeenCalledWith("doctor-a-id", expect.any(File));
  });

  test("BE002-T10: no authentication → upload is rejected with 401", async () => {
    mockResolveSession.mockResolvedValue(null);
    const { POST } = await import("@/app/api/v1/doctor/avatar/upload/route");
    const res = await POST(formDataRequest({}));
    expect(res.status).toBe(401);
    expect(mockSaveDoctorAvatar).not.toHaveBeenCalled();
  });

  test("BE002-T11: invalid Bearer token → upload is rejected with 401", async () => {
    mockResolveSession.mockResolvedValue(null);
    const { POST } = await import("@/app/api/v1/doctor/avatar/upload/route");
    const res = await POST(formDataRequest({ authorization: "Bearer garbage-token" }));
    expect(res.status).toBe(401);
    expect(mockSaveDoctorAvatar).not.toHaveBeenCalled();
  });

  test("BE002-T12: Doctor A's upload is always saved under Doctor A's own id", async () => {
    mockResolveSession.mockResolvedValue(DOCTOR_B);
    mockSaveDoctorAvatar.mockResolvedValue({ avatarUrl: "/avatars/doctor-b.png" });

    const { POST } = await import("@/app/api/v1/doctor/avatar/upload/route");
    await POST(formDataRequest({ authorization: "Bearer b-token" }));

    expect(mockSaveDoctorAvatar).toHaveBeenCalledWith("doctor-b-id", expect.any(File));
  });
});

describe("edge cases: role/authorization bypass attempts fail closed", () => {
  const NON_DOCTOR = { user: { id: "patient-x-id", roles: [Roles.PATIENT] } };
  const NO_ROLES = { user: { id: "no-roles-id" } };
  const EMPTY_ROLES = { user: { id: "empty-roles-id", roles: [] } };
  const WRONG_CASE_ROLE = { user: { id: "wrong-case-id", roles: ["Doctor"] } };

  test("a non-doctor role (e.g. patient) is forbidden from the bank account, not just unauthenticated", async () => {
    mockResolveSession.mockResolvedValue(NON_DOCTOR);
    const { GET } = await import("@/app/api/v1/doctor/bank-account/route");
    const res = await GET(req("http://localhost/api/v1/doctor/bank-account", {
      headers: { authorization: "Bearer patient-token" },
    }));
    expect(res.status).toBe(403);
    expect(mockGetOwnDoctorBankAccount).not.toHaveBeenCalled();
  });

  test("a session with no roles field at all is forbidden, not treated as doctor", async () => {
    mockResolveSession.mockResolvedValue(NO_ROLES);
    const { GET } = await import("@/app/api/v1/doctor/bank-account/route");
    const res = await GET(req("http://localhost/api/v1/doctor/bank-account"));
    expect(res.status).toBe(403);
    expect(mockGetOwnDoctorBankAccount).not.toHaveBeenCalled();
  });

  test("a session with an empty roles array is forbidden", async () => {
    mockResolveSession.mockResolvedValue(EMPTY_ROLES);
    const { POST } = await import("@/app/api/v1/doctor/referral/route");
    const res = await POST(req("http://localhost/api/v1/doctor/referral", { method: "POST" }));
    expect(res.status).toBe(403);
    expect(mockRegenerateDoctorReferralCode).not.toHaveBeenCalled();
  });

  test("role matching is case-sensitive — 'Doctor' does not satisfy the 'doctor' requirement", async () => {
    mockResolveSession.mockResolvedValue(WRONG_CASE_ROLE);
    const { POST } = await import("@/app/api/v1/doctor/avatar/upload/route");
    const fd = new FormData();
    fd.set("file", new File(["x"], "a.png", { type: "image/png" }));
    const res = await POST(new Request("http://localhost/api/v1/doctor/avatar/upload", {
      method: "POST",
      body: fd,
    }));
    expect(res.status).toBe(403);
    expect(mockSaveDoctorAvatar).not.toHaveBeenCalled();
  });

  test("a session user.id of empty string is treated as unauthenticated, not a valid doctor", async () => {
    mockResolveSession.mockResolvedValue({ user: { id: "", roles: [Roles.DOCTOR] } });
    const { GET } = await import("@/app/api/v1/doctor/bank-account/route");
    const res = await GET(req("http://localhost/api/v1/doctor/bank-account"));
    expect(res.status).toBe(401);
    expect(mockGetOwnDoctorBankAccount).not.toHaveBeenCalled();
  });
});

describe("edge cases: malicious payloads cannot redirect writes to another doctor", () => {
  test("a __proto__/prototype-pollution style body on bank-account PATCH doesn't crash or leak beyond the doctor's own id", async () => {
    mockResolveSession.mockResolvedValue(DOCTOR_A);
    mockUpdateOwnDoctorBankAccount.mockResolvedValue({});

    const { PATCH } = await import("@/app/api/v1/doctor/bank-account/route");
    const res = await PATCH(
      req("http://localhost/api/v1/doctor/bank-account", {
        method: "PATCH",
        headers: { authorization: "Bearer a-token", "content-type": "application/json" },
        body: JSON.stringify({
          __proto__: { polluted: true },
          constructor: { prototype: { polluted: true } },
          accountTitle: "A",
          accountNumber: "1",
          bankName: "HBL",
        }),
      }),
    );

    expect(res.status).toBe(200);
    expect(mockUpdateOwnDoctorBankAccount).toHaveBeenCalledWith("doctor-a-id", expect.anything());
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  test("non-string field types in the PATCH body are rejected as validation errors, not coerced", async () => {
    mockResolveSession.mockResolvedValue(DOCTOR_A);

    const { PATCH } = await import("@/app/api/v1/doctor/bank-account/route");
    const res = await PATCH(
      req("http://localhost/api/v1/doctor/bank-account", {
        method: "PATCH",
        headers: { authorization: "Bearer a-token", "content-type": "application/json" },
        body: JSON.stringify({ accountTitle: ["array", "not", "string"], accountNumber: 12345, bankName: { x: 1 } }),
      }),
    );

    expect(res.status).toBe(400);
    expect(mockUpdateOwnDoctorBankAccount).not.toHaveBeenCalled();
  });

  test("avatar upload with no file field is rejected without reaching storage", async () => {
    mockResolveSession.mockResolvedValue(DOCTOR_A);
    const { POST } = await import("@/app/api/v1/doctor/avatar/upload/route");
    const res = await POST(new Request("http://localhost/api/v1/doctor/avatar/upload", {
      method: "POST",
      headers: { authorization: "Bearer a-token" },
      body: new FormData(),
    }));
    expect(res.status).toBe(400);
    expect(mockSaveDoctorAvatar).not.toHaveBeenCalled();
  });
});

describe("stress: repeated/interleaved requests never cross-contaminate doctors or bypass auth", () => {
  test("50 unauthenticated attempts across all three routes never call any underlying service", async () => {
    mockResolveSession.mockResolvedValue(null);
    const { GET: bankGet, PATCH: bankPatch } = await import("@/app/api/v1/doctor/bank-account/route");
    const { GET: refGet, POST: refPost } = await import("@/app/api/v1/doctor/referral/route");
    const { POST: avatarPost } = await import("@/app/api/v1/doctor/avatar/upload/route");

    for (let i = 0; i < 50; i++) {
      const results = await Promise.all([
        bankGet(req("http://localhost/api/v1/doctor/bank-account")),
        bankPatch(req("http://localhost/api/v1/doctor/bank-account", { method: "PATCH", body: "{}" })),
        refGet(req("http://localhost/api/v1/doctor/referral")),
        refPost(req("http://localhost/api/v1/doctor/referral", { method: "POST" })),
        avatarPost(new Request("http://localhost/api/v1/doctor/avatar/upload", { method: "POST", body: new FormData() })),
      ]);
      for (const res of results) expect(res.status).toBe(401);
    }

    expect(mockGetOwnDoctorBankAccount).not.toHaveBeenCalled();
    expect(mockUpdateOwnDoctorBankAccount).not.toHaveBeenCalled();
    expect(mockGetDoctorReferralInfo).not.toHaveBeenCalled();
    expect(mockRegenerateDoctorReferralCode).not.toHaveBeenCalled();
    expect(mockSaveDoctorAvatar).not.toHaveBeenCalled();
  });

  test("50 interleaved Doctor A / Doctor B bank-account reads never cross the wires", async () => {
    const { GET } = await import("@/app/api/v1/doctor/bank-account/route");

    for (let i = 0; i < 50; i++) {
      const doctor = i % 2 === 0 ? DOCTOR_A : DOCTOR_B;
      const expectedId = doctor.user.id;
      mockResolveSession.mockResolvedValueOnce(doctor);
      mockGetOwnDoctorBankAccount.mockResolvedValueOnce({ accountTitle: `owner-${expectedId}` });

      await GET(req("http://localhost/api/v1/doctor/bank-account", {
        headers: { authorization: `Bearer token-${expectedId}` },
      }));

      expect(mockGetOwnDoctorBankAccount).toHaveBeenLastCalledWith(expectedId);
    }
  });
});

describe("BE002-T13: web cookie authentication keeps working through resolveSession", () => {
  test("a resolveSession result sourced from a cookie session is accepted identically", async () => {
    // From the route's point of view, resolveSession already normalizes web
    // cookie sessions and mobile Bearer sessions to the same shape — this
    // just proves the route doesn't special-case or reject that shape.
    mockResolveSession.mockResolvedValue(DOCTOR_A);
    mockGetOwnDoctorBankAccount.mockResolvedValue({ accountTitle: "Web session" });

    const { GET } = await import("@/app/api/v1/doctor/bank-account/route");
    const res = await GET(req("http://localhost/api/v1/doctor/bank-account"));

    expect(res.status).toBe(200);
    expect(mockGetOwnDoctorBankAccount).toHaveBeenCalledWith("doctor-a-id");
  });
});
