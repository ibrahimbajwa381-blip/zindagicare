/**
 * Ring-to-join for video consults: either participant rings the other, the
 * callee's devices get call-style pushes until it is answered, declined,
 * cancelled or times out.
 *
 * Real local MongoDB (mongodb-memory-server, ephemeral) + real route handlers,
 * real mobile-JWT auth and real services. Only push delivery is mocked.
 */
import { MongoMemoryServer } from "mongodb-memory-server";
import { NextRequest } from "next/server";
import { randomBytes } from "crypto";

jest.setTimeout(60000);

jest.mock("@/lib/auth", () => ({ auth: async () => null }));
jest.mock("@/server/services/push.service", () => ({
  sendWebPushToUser: jest.fn().mockResolvedValue({ sent: 1, failed: 0 }),
  sendExpoPushToUser: jest.fn().mockResolvedValue({ sent: 1, failed: 0 }),
}));

describe("Video call ring (real local MongoDB)", () => {
  let mongod: InstanceType<typeof MongoMemoryServer>;
  let mongooseMod: typeof import("mongoose");
  let db: typeof import("@zindagi/database");
  let shared: typeof import("@zindagi/shared");
  let ringRoute: typeof import("@/app/api/v1/video/sessions/[appointmentId]/ring/route");
  let incomingRoute: typeof import("@/app/api/v1/video/ring/incoming/route");
  let push: { sendWebPushToUser: jest.Mock; sendExpoPushToUser: jest.Mock };
  let callRing: typeof import("@/lib/realtime/call-ring-emitter");
  let signMobileAccessToken: typeof import("@/server/api/mobile-jwt").signMobileAccessToken;

  let counter = 0;
  const HOUR = 3_600_000;
  const slotBase = Date.now();
  let slot = 0;
  const nextEmail = () => `ring-${Date.now()}-${counter++}@test.local`;
  const nextPhone = () => `+92304${Math.floor(1000000 + Math.random() * 9000000)}`;

  async function createPatient(name = "Ring Patient") {
    const user = await db.UserModel.create({
      name,
      email: nextEmail(),
      phone: nextPhone(),
      roles: [shared.Roles.PATIENT],
    });
    return user._id.toString();
  }

  async function createDoctor() {
    const user = await db.UserModel.create({
      name: "Ring Doctor",
      email: nextEmail(),
      phone: nextPhone(),
      roles: [shared.Roles.DOCTOR],
    });
    const profile = await db.DoctorProfileModel.create({
      userId: user._id,
      pmdcNumber: `PMDC-${Date.now()}-${counter++}`,
      verificationStatus: shared.VerificationStatuses.APPROVED,
      isListed: true,
      specialties: ["General Physician"],
      consultationFee: 1500,
    });
    return { userId: user._id.toString(), profileId: profile._id.toString() };
  }

  /** A live consult whose Zoom meeting already exists (someone is in the call). */
  async function liveConsult(options: { withMeeting?: boolean } = {}) {
    const patientId = await createPatient();
    const doctor = await createDoctor();
    const appointment = await db.AppointmentModel.create({
      patientId,
      doctorId: doctor.profileId,
      type: shared.AppointmentTypes.ONLINE,
      status: shared.AppointmentStatuses.IN_PROGRESS,
      scheduledStart: new Date(slotBase - 10 * 60_000 - ++slot),
      scheduledEnd: new Date(slotBase + HOUR),
    });
    const appointmentId = appointment._id.toString();
    if (options.withMeeting !== false) {
      await db.VideoSessionModel.create({
        appointmentId,
        channelName: `ch-${counter++}`,
        provider: "zoom",
        status: shared.VideoSessionStatuses.ACTIVE,
        metadata: { meetingId: 900000 + counter, passcode: "x", joinUrl: "https://zoom.test" },
      });
    }
    return { appointmentId, patientId, doctor };
  }

  async function ringApi(appointmentId: string, userId: string, body: object) {
    const res = await ringRoute.POST(
      new NextRequest(`http://localhost/api/v1/video/sessions/${appointmentId}/ring`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${await signMobileAccessToken(userId)}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(body),
      }),
    );
    return { status: res.status, json: await res.json() };
  }

  async function incomingFor(userId: string) {
    const res = await incomingRoute.GET(
      new NextRequest("http://localhost/api/v1/video/ring/incoming", {
        headers: { authorization: `Bearer ${await signMobileAccessToken(userId)}` },
      }),
    );
    const json = await res.json();
    return json.data as null | {
      ringId: string;
      appointmentId: string;
      fromName: string;
      fromRole: string;
    };
  }

  /** Moves the stored ring back in time, as if `ms` had passed. */
  async function ageRing(appointmentId: string, ms: number, fields: ("startedAt" | "lastAt")[]) {
    const session = await db.VideoSessionModel.findOne({ appointmentId }).lean();
    const ring = (session!.metadata as { ring: Record<string, Date> }).ring;
    const set: Record<string, Date> = {};
    for (const field of fields) set[`metadata.ring.${field}`] = new Date(ring[field].getTime() - ms);
    await db.VideoSessionModel.updateOne({ appointmentId }, { $set: set });
  }

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongod.getUri("video_call_ring");
    process.env.FIELD_ENCRYPTION_KEY = randomBytes(32).toString("base64");
    process.env.AUTH_SECRET = "test-secret-at-least-32-chars-long-12345";

    db = await import("@zindagi/database");
    shared = await import("@zindagi/shared");
    mongooseMod = (await import("mongoose")).default;
    await db.connectDatabase();
    await db.AppointmentModel.init();

    ({ signMobileAccessToken } = await import("@/server/api/mobile-jwt"));
    ringRoute = await import("@/app/api/v1/video/sessions/[appointmentId]/ring/route");
    incomingRoute = await import("@/app/api/v1/video/ring/incoming/route");
    callRing = await import("@/lib/realtime/call-ring-emitter");
    push = (await import("@/server/services/push.service")) as unknown as typeof push;
  });

  beforeEach(() => {
    push.sendWebPushToUser.mockClear();
    push.sendExpoPushToUser.mockClear();
  });

  afterAll(async () => {
    await mongooseMod.disconnect();
    await mongod.stop();
  });

  test("doctor rings patient: call push to the patient, ring shows as incoming", async () => {
    const { appointmentId, patientId, doctor } = await liveConsult();
    const events: unknown[] = [];
    const listener = (event: unknown) => events.push(event);
    callRing.callRingEmitter.on(callRing.callRingUserRoom(patientId), listener);

    const res = await ringApi(appointmentId, doctor.userId, { action: "ring" });

    callRing.callRingEmitter.off(callRing.callRingUserRoom(patientId), listener);
    expect(res.status).toBe(200);
    expect(res.json.data).toEqual({ ringId: expect.any(String), status: "ringing" });

    expect(push.sendWebPushToUser).toHaveBeenCalledTimes(1);
    expect(push.sendWebPushToUser).toHaveBeenCalledWith(patientId, {
      title: "Dr. Ring Doctor is calling",
      body: expect.any(String),
      url: `/consult/video/${appointmentId}`,
      tag: `call-${appointmentId}`,
      kind: "call",
      appointmentId,
      ringId: res.json.data.ringId,
    });
    expect(push.sendExpoPushToUser).toHaveBeenCalledWith(
      patientId,
      expect.objectContaining({
        data: expect.objectContaining({ type: "video_call_ring", appointmentId }),
      }),
    );
    expect(events).toEqual([{ type: "ring_updated", appointmentId }]);

    expect(await incomingFor(patientId)).toEqual({
      ringId: res.json.data.ringId,
      appointmentId,
      fromName: "Dr. Ring Doctor",
      fromRole: "doctor",
      fromAvatarUrl: null,
      startedAt: expect.any(String),
    });
    // The caller is not being rung.
    expect(await incomingFor(doctor.userId)).toBeNull();
  });

  test("patient can ring the doctor too", async () => {
    const { appointmentId, patientId, doctor } = await liveConsult();

    const res = await ringApi(appointmentId, patientId, { action: "ring" });

    expect(res.json.data.status).toBe("ringing");
    expect(push.sendWebPushToUser).toHaveBeenCalledWith(
      doctor.userId,
      expect.objectContaining({ title: "Ring Patient is calling", kind: "call" }),
    );
    expect((await incomingFor(doctor.userId))?.fromRole).toBe("patient");
  });

  test("re-rings keep pushing (web only), but never faster than every 5s", async () => {
    const { appointmentId, doctor } = await liveConsult();
    const { ringId } = (await ringApi(appointmentId, doctor.userId, { action: "ring" })).json.data;
    push.sendWebPushToUser.mockClear();
    push.sendExpoPushToUser.mockClear();

    // Immediately again: throttled, still ringing.
    const fast = await ringApi(appointmentId, doctor.userId, { action: "ring", ringId });
    expect(fast.json.data).toEqual({ ringId, status: "ringing" });
    expect(push.sendWebPushToUser).not.toHaveBeenCalled();

    await ageRing(appointmentId, 7_000, ["lastAt"]);
    const later = await ringApi(appointmentId, doctor.userId, { action: "ring", ringId });
    expect(later.json.data).toEqual({ ringId, status: "ringing" });
    expect(push.sendWebPushToUser).toHaveBeenCalledTimes(1);
    // Mobile gets one push per ring, not one per re-ring.
    expect(push.sendExpoPushToUser).not.toHaveBeenCalled();
  });

  test("double tap joins the ring in progress instead of starting a second one", async () => {
    const { appointmentId, doctor } = await liveConsult();
    const first = await ringApi(appointmentId, doctor.userId, { action: "ring" });
    const second = await ringApi(appointmentId, doctor.userId, { action: "ring" });

    expect(second.json.data.ringId).toBe(first.json.data.ringId);
    expect(push.sendWebPushToUser).toHaveBeenCalledTimes(1);
  });

  test("patient declines: caller's next re-ring sees 'declined', ring no longer incoming", async () => {
    const { appointmentId, patientId, doctor } = await liveConsult();
    const { ringId } = (await ringApi(appointmentId, doctor.userId, { action: "ring" })).json.data;

    const decline = await ringApi(appointmentId, patientId, { action: "decline", ringId });
    expect(decline.status).toBe(200);

    await ageRing(appointmentId, 7_000, ["lastAt"]);
    push.sendWebPushToUser.mockClear();
    const next = await ringApi(appointmentId, doctor.userId, { action: "ring", ringId });
    expect(next.json.data).toEqual({ ringId, status: "declined" });
    expect(push.sendWebPushToUser).not.toHaveBeenCalled();
    expect(await incomingFor(patientId)).toBeNull();
  });

  test("patient joins the call: ring is answered", async () => {
    const { appointmentId, patientId, doctor } = await liveConsult();
    const { ringId } = (await ringApi(appointmentId, doctor.userId, { action: "ring" })).json.data;

    expect((await ringApi(appointmentId, patientId, { action: "answer" })).status).toBe(200);

    const next = await ringApi(appointmentId, doctor.userId, { action: "ring", ringId });
    expect(next.json.data.status).toBe("answered");
    expect(await incomingFor(patientId)).toBeNull();
  });

  test("answer with no ring active is a harmless no-op (every join calls it)", async () => {
    const { appointmentId, patientId } = await liveConsult();
    const res = await ringApi(appointmentId, patientId, { action: "answer" });
    expect(res.status).toBe(200);
    expect(res.json.data).toEqual({ ok: true });
  });

  test("caller cancels: ring stops; the callee cannot cancel and the caller cannot decline", async () => {
    const { appointmentId, patientId, doctor } = await liveConsult();
    const { ringId } = (await ringApi(appointmentId, doctor.userId, { action: "ring" })).json.data;

    expect((await ringApi(appointmentId, patientId, { action: "cancel", ringId })).status).toBe(403);
    expect((await ringApi(appointmentId, doctor.userId, { action: "decline", ringId })).status).toBe(403);
    expect(await incomingFor(patientId)).not.toBeNull();

    expect((await ringApi(appointmentId, doctor.userId, { action: "cancel", ringId })).status).toBe(200);
    expect(await incomingFor(patientId)).toBeNull();
    const next = await ringApi(appointmentId, doctor.userId, { action: "ring", ringId });
    expect(next.json.data.status).toBe("cancelled");
  });

  test("unanswered ring times out after 45s as 'missed'", async () => {
    const { appointmentId, patientId, doctor } = await liveConsult();
    const { ringId } = (await ringApi(appointmentId, doctor.userId, { action: "ring" })).json.data;

    await ageRing(appointmentId, 50_000, ["startedAt", "lastAt"]);
    push.sendWebPushToUser.mockClear();

    const next = await ringApi(appointmentId, doctor.userId, { action: "ring", ringId });
    expect(next.json.data.status).toBe("missed");
    expect(push.sendWebPushToUser).not.toHaveBeenCalled();
    expect(await incomingFor(patientId)).toBeNull();

    // A fresh ring after a missed one starts ringing again.
    const again = await ringApi(appointmentId, doctor.userId, { action: "ring" });
    expect(again.json.data.status).toBe("ringing");
    expect(again.json.data.ringId).not.toBe(ringId);
  });

  test("someone outside the consult cannot ring", async () => {
    const { appointmentId } = await liveConsult();
    const outsider = await createPatient("Outsider");

    const res = await ringApi(appointmentId, outsider, { action: "ring" });
    expect(res.status).toBe(403);
    expect(push.sendWebPushToUser).not.toHaveBeenCalled();
  });

  test("ringing before anyone opened the call is refused", async () => {
    const { appointmentId, doctor } = await liveConsult({ withMeeting: false });

    const res = await ringApi(appointmentId, doctor.userId, { action: "ring" });
    expect(res.status).toBe(400);
    expect(res.json.error.message).toMatch(/join the video call first/i);
  });

  test("finished consult cannot ring", async () => {
    const { appointmentId, doctor } = await liveConsult();
    await db.AppointmentModel.updateOne(
      { _id: appointmentId },
      { $set: { status: shared.AppointmentStatuses.COMPLETED } },
    );

    const res = await ringApi(appointmentId, doctor.userId, { action: "ring" });
    expect(res.status).toBe(400);
  });

  test("malformed body is rejected", async () => {
    const { appointmentId, doctor } = await liveConsult();
    const res = await ringApi(appointmentId, doctor.userId, { action: "decline", ringId: "nope" });
    expect(res.status).toBe(400);
  });
});
