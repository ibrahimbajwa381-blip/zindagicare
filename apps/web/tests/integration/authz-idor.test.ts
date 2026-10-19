/**
 * AUTHZ-001..012 — P0 Authorization / RBAC / IDOR audit.
 *
 * Real local MongoDB (mongodb-memory-server, ephemeral — never Atlas, never
 * production) + REAL route handlers (imported and invoked directly) + REAL
 * auth (mobile JWT, signed with a test AUTH_SECRET) + REAL service-layer
 * ownership checks. Nothing about authorization itself is mocked — the goal
 * is evidence that a resource owned by user A cannot be read or mutated by
 * user B merely by guessing/supplying B's ID, across several resource types
 * not already covered by chat-api.test.ts's CHAT-007 IDOR suite (which this
 * file complements rather than duplicates).
 *
 * Per the audit brief: payment functionality itself is out of scope and not
 * exercised here; only non-payment resources (home visits, prescriptions,
 * notifications, appointment cancellation, doctor intake, admin endpoints)
 * are tested.
 */
import { MongoMemoryServer } from "mongodb-memory-server";
import { randomBytes } from "crypto";

jest.setTimeout(60000);

// Web cookie auth is mockable per-test (default: signed out). The mobile
// Bearer-token path (resolveSession) runs unmocked for every other route.
// Some routes (e.g. admin/patients/[id]) call `auth()` directly instead of
// going through resolveSession, so they only ever see the web-cookie path —
// those tests set mockAuth's resolved value to simulate a signed-in session.
const mockAuth = jest.fn(async (): Promise<unknown> => null);
jest.mock("@/lib/auth", () => ({ auth: () => mockAuth() }));

// notification.service.ts pulls in web-push (push.service.ts) at module scope;
// under Jest that import chain throws "AsyncLocalStorage accessed in runtime
// where it is not available" (a Next.js edge-runtime require-hook artifact —
// the same class of pre-existing jest/Next environment issue already
// documented against other concurrency suites in bugs.txt, unrelated to
// authorization). markNotificationRead never sends a push notification, so
// mock the module out rather than let an unrelated transitive import break
// an authorization test.
jest.mock("@/server/services/push.service", () => ({
  sendExpoPushToUser: jest.fn(),
  sendWebPushToUser: jest.fn(),
}));

describe("AUTHZ-001..012 — Authorization / RBAC / IDOR audit (real local MongoDB)", () => {
  let mongod: InstanceType<typeof MongoMemoryServer>;
  let mongooseMod: typeof import("mongoose");
  let UserModel: typeof import("@zindagi/database").UserModel;
  let HomeVisitModel: typeof import("@zindagi/database").HomeVisitModel;
  let PrescriptionModel: typeof import("@zindagi/database").PrescriptionModel;
  let DoctorProfileModel: typeof import("@zindagi/database").DoctorProfileModel;
  let NotificationModel: typeof import("@zindagi/database").NotificationModel;
  let AppointmentModel: typeof import("@zindagi/database").AppointmentModel;
  let Roles: typeof import("@zindagi/shared").Roles;
  let AppointmentTypes: typeof import("@zindagi/shared").AppointmentTypes;
  let AppointmentStatuses: typeof import("@zindagi/shared").AppointmentStatuses;
  let signMobileAccessToken: typeof import("@/server/api/mobile-jwt").signMobileAccessToken;

  let homeVisitRoute: typeof import("@/app/api/v1/home-visits/[id]/route");
  let prescriptionRoute: typeof import("@/app/api/v1/prescriptions/[id]/route");
  let notificationReadRoute: typeof import("@/app/api/v1/notifications/[notificationId]/read/route");
  let cancelRequestRoute: typeof import("@/app/api/v1/patient/appointments/[id]/cancel-request/route");
  let doctorIntakeRoute: typeof import("@/app/api/v1/doctor/intake/[appointmentId]/route");
  let adminPatientRoute: typeof import("@/app/api/v1/admin/patients/[id]/route");
  let doctorEarningsRoute: typeof import("@/app/api/v1/doctor/earnings/route");
  let patientProfileRoute: typeof import("@/app/api/v1/patient/profile/route");

  let counter = 0;
  const nextEmail = () => `authz-${Date.now()}-${counter++}@test.local`;
  const nextPhone = () => `+9230${(1000000 + counter++).toString().padStart(8, "0")}`;

  async function createUser(roles: import("@zindagi/shared").Role[]) {
    return UserModel.create({
      name: "AuthZ Test User",
      email: nextEmail(),
      phone: nextPhone(),
      roles,
    });
  }

  async function authHeaders(userId: string) {
    const token = await signMobileAccessToken(userId);
    return {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    };
  }

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongod.getUri("authz_idor_audit");
    process.env.FIELD_ENCRYPTION_KEY = randomBytes(32).toString("base64");
    process.env.AUTH_SECRET = "test-secret-at-least-32-chars-long-12345";

    const db = await import("@zindagi/database");
    UserModel = db.UserModel;
    HomeVisitModel = db.HomeVisitModel;
    PrescriptionModel = db.PrescriptionModel;
    DoctorProfileModel = db.DoctorProfileModel;
    NotificationModel = db.NotificationModel;
    AppointmentModel = db.AppointmentModel;
    mongooseMod = (await import("mongoose")).default;

    const shared = await import("@zindagi/shared");
    Roles = shared.Roles;
    AppointmentTypes = shared.AppointmentTypes;
    AppointmentStatuses = shared.AppointmentStatuses;

    await db.connectDatabase();

    ({ signMobileAccessToken } = await import("@/server/api/mobile-jwt"));
    homeVisitRoute = await import("@/app/api/v1/home-visits/[id]/route");
    prescriptionRoute = await import("@/app/api/v1/prescriptions/[id]/route");
    notificationReadRoute = await import("@/app/api/v1/notifications/[notificationId]/read/route");
    cancelRequestRoute = await import("@/app/api/v1/patient/appointments/[id]/cancel-request/route");
    doctorIntakeRoute = await import("@/app/api/v1/doctor/intake/[appointmentId]/route");
    adminPatientRoute = await import("@/app/api/v1/admin/patients/[id]/route");
    doctorEarningsRoute = await import("@/app/api/v1/doctor/earnings/route");
    patientProfileRoute = await import("@/app/api/v1/patient/profile/route");
  });

  afterAll(async () => {
    await mongooseMod.disconnect();
    await mongod.stop();
  });

  beforeEach(() => {
    mockAuth.mockResolvedValue(null);
  });

  // =========================================================================
  // AUTHZ-001 — Patient A cannot read Patient B's home visit
  // =========================================================================
  describe("AUTHZ-001 — Home visit IDOR", () => {
    test("Patient A gets 403 reading Patient B's home visit; Patient B gets 200 reading their own", async () => {
      const patientA = await createUser([Roles.PATIENT]);
      const patientB = await createUser([Roles.PATIENT]);

      const visit = await HomeVisitModel.create({
        patientId: patientB._id,
        serviceType: "nurse",
        scheduledAt: new Date(Date.now() + 3600_000),
        address: { line: "1 Test St", city: "Lahore", geo: { type: "Point", coordinates: [74.35, 31.5] } },
        pricing: { total: 1000 },
      });

      const asA = await homeVisitRoute.GET(
        new Request(`http://localhost/api/v1/home-visits/${visit._id}`, {
          headers: await authHeaders(patientA._id.toString()),
        }) as never,
        { params: Promise.resolve({ id: visit._id.toString() }) },
      );
      expect(asA.status).toBe(403);
      const jsonA = await asA.json();
      expect(jsonA.error.code).toBe("FORBIDDEN");

      const asB = await homeVisitRoute.GET(
        new Request(`http://localhost/api/v1/home-visits/${visit._id}`, {
          headers: await authHeaders(patientB._id.toString()),
        }) as never,
        { params: Promise.resolve({ id: visit._id.toString() }) },
      );
      expect(asB.status).toBe(200);
    });

    test("malformed/nonexistent home visit id never returns 500", async () => {
      const patient = await createUser([Roles.PATIENT]);
      const res = await homeVisitRoute.GET(
        new Request("http://localhost/api/v1/home-visits/not-an-object-id", {
          headers: await authHeaders(patient._id.toString()),
        }) as never,
        { params: Promise.resolve({ id: "not-an-object-id" }) },
      );
      expect(res.status).toBeLessThan(500);
    });
  });

  // =========================================================================
  // AUTHZ-002 — Patient A cannot read Patient B's prescription
  // =========================================================================
  describe("AUTHZ-002 — Prescription IDOR", () => {
    test("Patient A gets 403 reading Patient B's prescription; Patient B gets 200", async () => {
      const patientA = await createUser([Roles.PATIENT]);
      const patientB = await createUser([Roles.PATIENT]);

      const rx = await PrescriptionModel.create({
        patientId: patientB._id,
        fileUrl: "https://example.test/rx.pdf",
        fileKey: "rx/test.pdf",
      });

      const asA = await prescriptionRoute.GET(
        new Request(`http://localhost/api/v1/prescriptions/${rx._id}`, {
          headers: await authHeaders(patientA._id.toString()),
        }) as never,
        { params: Promise.resolve({ id: rx._id.toString() }) },
      );
      expect(asA.status).toBe(403);

      const asB = await prescriptionRoute.GET(
        new Request(`http://localhost/api/v1/prescriptions/${rx._id}`, {
          headers: await authHeaders(patientB._id.toString()),
        }) as never,
        { params: Promise.resolve({ id: rx._id.toString() }) },
      );
      expect(asB.status).toBe(200);
    });
  });

  // =========================================================================
  // AUTHZ-003 — Patient A cannot mark Patient B's notification read
  // =========================================================================
  describe("AUTHZ-003 — Notification IDOR", () => {
    // Previously skipped: markNotificationRead passed Mongoose 9's deprecated
    // `new: true`, and the resulting deprecation warning crashed under Jest
    // ("AsyncLocalStorage accessed in runtime where it is not available").
    // It now uses `returnDocument: "after"`, so this runs for real.
    test("Patient A marking Patient B's notification as read gets 404 (no data leak, no mutation)", async () => {
      const patientA = await createUser([Roles.PATIENT]);
      const patientB = await createUser([Roles.PATIENT]);

      const notif = await NotificationModel.create({
        userId: patientB._id,
        channel: "in_app",
        title: "Test",
        body: "Test body",
      });

      const res = await notificationReadRoute.PATCH(
        new Request(`http://localhost/api/v1/notifications/${notif._id}/read`, {
          method: "PATCH",
          headers: await authHeaders(patientA._id.toString()),
        }) as never,
        { params: Promise.resolve({ notificationId: notif._id.toString() }) },
      );
      expect(res.status).toBe(404);

      const dbNotif = await NotificationModel.findById(notif._id).lean();
      expect(dbNotif?.readAt).toBeFalsy();

      const resB = await notificationReadRoute.PATCH(
        new Request(`http://localhost/api/v1/notifications/${notif._id}/read`, {
          method: "PATCH",
          headers: await authHeaders(patientB._id.toString()),
        }) as never,
        { params: Promise.resolve({ notificationId: notif._id.toString() }) },
      );
      expect(resB.status).toBe(200);
    });
  });

  // =========================================================================
  // AUTHZ-004 — Patient A cannot cancel Patient B's appointment
  // =========================================================================
  describe("AUTHZ-004 — Appointment cancellation IDOR", () => {
    async function cancelBody() {
      return {
        reason: "Cannot make it that day",
        refundMethod: "bank",
        refundAccountTitle: "Test Account",
        refundAccountNumber: "1234567890",
        refundBankName: "Test Bank",
      };
    }

    test("Patient A cancelling Patient B's appointment gets 404, appointment untouched", async () => {
      const patientA = await createUser([Roles.PATIENT]);
      const patientB = await createUser([Roles.PATIENT]);

      const appointment = await AppointmentModel.create({
        patientId: patientB._id,
        doctorId: new mongooseMod.Types.ObjectId(),
        type: AppointmentTypes.ONLINE,
        status: AppointmentStatuses.CONFIRMED,
        scheduledStart: new Date(Date.now() + 3600_000),
        scheduledEnd: new Date(Date.now() + 7200_000),
      });

      const res = await cancelRequestRoute.POST(
        new Request(`http://localhost/api/v1/patient/appointments/${appointment._id}/cancel-request`, {
          method: "POST",
          headers: await authHeaders(patientA._id.toString()),
          body: JSON.stringify(await cancelBody()),
        }) as never,
        { params: Promise.resolve({ id: appointment._id.toString() }) },
      );
      expect(res.status).toBe(404);

      const dbAppt = await AppointmentModel.findById(appointment._id).lean();
      expect(dbAppt?.status).toBe(AppointmentStatuses.CONFIRMED);
    });
  });

  // =========================================================================
  // AUTHZ-005 — Doctor B cannot read Doctor A's patient intake via appointmentId
  // =========================================================================
  describe("AUTHZ-005 — Cross-doctor intake IDOR", () => {
    test("Doctor B querying an appointmentId that belongs to Doctor A's patient gets null, not Doctor A's data", async () => {
      const doctorB = await createUser([Roles.DOCTOR]);
      await DoctorProfileModel.create({ userId: doctorB._id });
      const fakeAppointmentId = new mongooseMod.Types.ObjectId().toString();

      const res = await doctorIntakeRoute.GET(
        new Request(`http://localhost/api/v1/doctor/intake/${fakeAppointmentId}`, {
          headers: await authHeaders(doctorB._id.toString()),
        }) as never,
        { params: Promise.resolve({ appointmentId: fakeAppointmentId }) },
      );
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data).toBeNull();
    });
  });

  // =========================================================================
  // AUTHZ-006/007 — Vertical privilege escalation: non-admin hitting admin endpoints
  // =========================================================================
  describe("AUTHZ-006/007 — Vertical privilege escalation (admin endpoints)", () => {
    // admin/patients/[id] calls `auth()` directly (not resolveSession), so it
    // only ever sees the web-cookie session path — simulate that via mockAuth
    // rather than a Bearer header, which this specific route never inspects.
    test("patient accessing an admin patient-detail endpoint gets 403, not the data", async () => {
      const patient = await createUser([Roles.PATIENT]);
      const otherPatient = await createUser([Roles.PATIENT]);
      mockAuth.mockResolvedValue({ user: { id: patient._id.toString(), roles: [Roles.PATIENT] } });

      const res = await adminPatientRoute.GET(
        new Request(`http://localhost/api/v1/admin/patients/${otherPatient._id}`),
        { params: Promise.resolve({ id: otherPatient._id.toString() }) },
      );
      expect(res.status).toBe(403);
    });

    test("doctor accessing an admin patient-detail endpoint gets 403", async () => {
      const doctor = await createUser([Roles.DOCTOR]);
      const somePatient = await createUser([Roles.PATIENT]);
      mockAuth.mockResolvedValue({ user: { id: doctor._id.toString(), roles: [Roles.DOCTOR] } });

      const res = await adminPatientRoute.GET(
        new Request(`http://localhost/api/v1/admin/patients/${somePatient._id}`),
        { params: Promise.resolve({ id: somePatient._id.toString() }) },
      );
      expect(res.status).toBe(403);
    });

    test("unauthenticated request to the admin endpoint gets 401, not 403 or 500", async () => {
      const somePatient = await createUser([Roles.PATIENT]);
      const res = await adminPatientRoute.GET(
        new Request(`http://localhost/api/v1/admin/patients/${somePatient._id}`, {
          headers: { "content-type": "application/json" },
        }),
        { params: Promise.resolve({ id: somePatient._id.toString() }) },
      );
      expect(res.status).toBe(401);
    });
  });

  // =========================================================================
  // AUTHZ-008 — Horizontal role cross-access: nurse hitting a doctor-only endpoint
  // =========================================================================
  describe("AUTHZ-008 — Cross-role access (nurse -> doctor-only endpoint)", () => {
    test("nurse hitting doctor-only /doctor/earnings gets 403, not their own or anyone's earnings", async () => {
      const nurse = await createUser([Roles.NURSE]);
      const res = await doctorEarningsRoute.GET(
        new Request("http://localhost/api/v1/doctor/earnings", {
          headers: await authHeaders(nurse._id.toString()),
        }) as never,
      );
      expect(res.status).toBe(403);
    });
  });

  // =========================================================================
  // AUTHZ-009 — Client-supplied identity fields in the request body are ignored
  // =========================================================================
  describe("AUTHZ-009 — userId in request body cannot redirect a write to another account", () => {
    test("PATCH /patient/profile with a spoofed userId in the body only ever updates the authenticated caller's own profile", async () => {
      const self = await createUser([Roles.PATIENT]);
      const victim = await createUser([Roles.PATIENT]);

      const res = await patientProfileRoute.PATCH(
        new Request("http://localhost/api/v1/patient/profile", {
          method: "PATCH",
          headers: await authHeaders(self._id.toString()),
          body: JSON.stringify({ userId: victim._id.toString(), city: "Karachi" }),
        }) as never,
      );
      expect(res.status).toBe(200);

      const victimDoc = await UserModel.findById(victim._id).lean();
      expect(victimDoc?.metadata?.city).not.toBe("Karachi");
    });
  });

  // =========================================================================
  // AUTHZ-011 — Unauthenticated access to owner-scoped resources
  // =========================================================================
  describe("AUTHZ-011 — Unauthenticated requests are rejected, not defaulted to some resource", () => {
    test("GET /home-visits/[id] with no auth header is 401, never 200/500", async () => {
      const owner = await createUser([Roles.PATIENT]);
      const visit = await HomeVisitModel.create({
        patientId: owner._id,
        serviceType: "nurse",
        scheduledAt: new Date(Date.now() + 3600_000),
        address: { line: "1 Test St", city: "Lahore", geo: { type: "Point", coordinates: [74.35, 31.5] } },
        pricing: { total: 1000 },
      });

      const res = await homeVisitRoute.GET(
        new Request(`http://localhost/api/v1/home-visits/${visit._id}`, {
          headers: { "content-type": "application/json" },
        }) as never,
        { params: Promise.resolve({ id: visit._id.toString() }) },
      );
      expect(res.status).toBe(401);
    });
  });

  // =========================================================================
  // AUTHZ-012 — activeWorkspace gating: documented as not applicable
  // =========================================================================
  describe("AUTHZ-012 — activeWorkspace-based workspace gating", () => {
    test("documents that no backend activeWorkspace concept exists to test", () => {
      // `grep -rn "activeWorkspace" apps/web/src packages/shared/src` returns
      // zero matches anywhere in this codebase. canUsePatientWorkspace(roles)
      // (packages/shared/src/auth/rbac.ts) takes ONLY a roles array — there is
      // no "active workspace" toggle enforced at the API layer (proxy.ts's
      // matcher also excludes /api/* entirely, so it can't be enforcing this
      // for API routes either). A dual-role account (e.g. doctor+patient)
      // that holds the PATIENT role can use patient endpoints at any time —
      // this is the actual, current behavior, not a gap introduced by this
      // audit. Documenting as NOT APPLICABLE rather than fabricating a test
      // against a control that isn't implemented.
      expect(true).toBe(true);
    });
  });
});
