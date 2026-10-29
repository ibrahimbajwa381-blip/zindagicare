/**
 * One way to end an online consult (paid, urgent, Sunday free): the provider
 * presses Finish, or the daily sweep completes an attended consult left open
 * past the 72h grace period. Leaving the call never completes it.
 *
 * Real local MongoDB (mongodb-memory-server, ephemeral) + real route handler,
 * real mobile-JWT auth and real services. Only notification delivery is mocked.
 */
import { MongoMemoryServer } from "mongodb-memory-server";
import { NextRequest } from "next/server";
import { randomBytes } from "crypto";

jest.setTimeout(60000);

jest.mock("@/lib/auth", () => ({ auth: async () => null }));
jest.mock("@/lib/notifications/deliver-notification", () => ({
  deliverUserNotification: jest.fn().mockResolvedValue(undefined),
}));

describe("Consultation lifecycle (real local MongoDB)", () => {
  let mongod: InstanceType<typeof MongoMemoryServer>;
  let mongooseMod: typeof import("mongoose");
  let db: typeof import("@zindagi/database");
  let shared: typeof import("@zindagi/shared");
  let finishRoute: typeof import("@/app/api/v1/appointments/[appointmentId]/finish/route");
  let ConsultationLifecycleService: typeof import("@/server/services/consultation/consultation-lifecycle.service").ConsultationLifecycleService;
  let VideoSessionService: typeof import("@/server/services/video-session.service").VideoSessionService;
  let ChatService: typeof import("@/server/services/chat.service").ChatService;
  let signMobileAccessToken: typeof import("@/server/api/mobile-jwt").signMobileAccessToken;

  let counter = 0;
  const HOUR = 3_600_000;
  // Fixed base + per-call offset: (doctorId, scheduledStart) is unique.
  const slotBase = Date.now();
  let slot = 0;
  const nextEmail = () => `lifecycle-${Date.now()}-${counter++}@test.local`;
  const nextPhone = () => `+92303${Math.floor(1000000 + Math.random() * 9000000)}`;

  async function createPatient() {
    const user = await db.UserModel.create({
      name: "Lifecycle Patient",
      email: nextEmail(),
      phone: nextPhone(),
      roles: [shared.Roles.PATIENT],
    });
    return user._id.toString();
  }

  async function createDoctor() {
    const user = await db.UserModel.create({
      name: "Lifecycle Doctor",
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

  async function book(patientId: string, profileId: string, overrides: Record<string, unknown> = {}) {
    const appointment = await db.AppointmentModel.create({
      patientId,
      doctorId: profileId,
      type: shared.AppointmentTypes.ONLINE,
      status: shared.AppointmentStatuses.IN_PROGRESS,
      scheduledStart: new Date(slotBase - HOUR - ++slot),
      scheduledEnd: new Date(slotBase + HOUR),
      ...overrides,
    });
    const payment = await db.PaymentModel.create({
      userId: patientId,
      appointmentId: appointment._id,
      amount: 1500,
      status: shared.PaymentStatuses.PAID,
      provider: "jazzcash",
      externalTransactionId: `lifecycle-txn-${counter++}`,
    });
    await db.AppointmentModel.updateOne({ _id: appointment._id }, { $set: { paymentId: payment._id } });
    return appointment._id.toString();
  }

  async function finishViaApi(appointmentId: string, userId: string, body: object = {}) {
    const res = await finishRoute.POST(
      new NextRequest(`http://localhost/api/v1/appointments/${appointmentId}/finish`, {
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

  const statusOf = async (appointmentId: string) =>
    (await db.AppointmentModel.findById(appointmentId).lean())?.status;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongod.getUri("consultation_lifecycle");
    process.env.FIELD_ENCRYPTION_KEY = randomBytes(32).toString("base64");
    process.env.AUTH_SECRET = "test-secret-at-least-32-chars-long-12345";

    db = await import("@zindagi/database");
    shared = await import("@zindagi/shared");
    mongooseMod = (await import("mongoose")).default;
    await db.connectDatabase();
    // Build unique indexes now so fixture collisions fail every run, not by timing.
    await db.AppointmentModel.init();

    ({ signMobileAccessToken } = await import("@/server/api/mobile-jwt"));
    finishRoute = await import("@/app/api/v1/appointments/[appointmentId]/finish/route");
    ({ ConsultationLifecycleService } = await import(
      "@/server/services/consultation/consultation-lifecycle.service"
    ));
    ({ VideoSessionService } = await import("@/server/services/video-session.service"));
    ({ ChatService } = await import("@/server/services/chat.service"));
  });

  afterAll(async () => {
    await mongooseMod.disconnect();
    await mongod.stop();
  });

  test("provider finishes a paid consult: completed, video ended, chat read-only", async () => {
    const patientId = await createPatient();
    const doctor = await createDoctor();
    const appointmentId = await book(patientId, doctor.profileId);
    const thread = await ChatService.getOrCreateDirectThread(patientId, doctor.userId);
    await db.VideoSessionModel.create({
      appointmentId,
      channelName: `ch-${counter++}`,
      provider: "zoom",
      status: shared.VideoSessionStatuses.ACTIVE,
      patientJoinedAt: new Date(),
      startedAt: new Date(),
    });

    const res = await finishViaApi(appointmentId, doctor.userId);

    expect(res.status).toBe(200);
    expect(res.json.data).toEqual({ status: shared.AppointmentStatuses.COMPLETED });
    expect(await statusOf(appointmentId)).toBe(shared.AppointmentStatuses.COMPLETED);
    const session = await db.VideoSessionModel.findOne({ appointmentId }).lean();
    expect(session?.status).toBe(shared.VideoSessionStatuses.COMPLETED);
    await expect(ChatService.sendMessage(thread.id, patientId, "after")).rejects.toMatchObject({
      statusCode: 403,
    });
    const { deliverUserNotification } = await import("@/lib/notifications/deliver-notification");
    expect(deliverUserNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: patientId,
        payload: { type: "consult_completed", appointmentId },
      }),
    );
  });

  test("leaving the call keeps the consult open", async () => {
    const patientId = await createPatient();
    const doctor = await createDoctor();
    const appointmentId = await book(patientId, doctor.profileId);
    await db.VideoSessionModel.create({
      appointmentId,
      channelName: `ch-${counter++}`,
      provider: "zoom",
      status: shared.VideoSessionStatuses.ACTIVE,
      patientJoinedAt: new Date(),
      startedAt: new Date(),
    });

    await VideoSessionService.recordLeave(patientId, appointmentId);
    await VideoSessionService.recordLeave(doctor.userId, appointmentId);

    expect(await statusOf(appointmentId)).toBe(shared.AppointmentStatuses.IN_PROGRESS);
    const session = await db.VideoSessionModel.findOne({ appointmentId }).lean();
    expect(session?.status).toBe(shared.VideoSessionStatuses.ACTIVE);
  });

  test("only the consult's own provider can finish it", async () => {
    const patientId = await createPatient();
    const doctor = await createDoctor();
    const otherDoctor = await createDoctor();
    const appointmentId = await book(patientId, doctor.profileId);

    expect((await finishViaApi(appointmentId, otherDoctor.userId)).status).toBe(404);
    expect((await finishViaApi(appointmentId, patientId)).status).toBe(403);
    expect((await finishViaApi("not-an-id", doctor.userId)).status).toBe(404);
    expect(await statusOf(appointmentId)).toBe(shared.AppointmentStatuses.IN_PROGRESS);
  });

  test("cannot finish before the consult starts, or twice", async () => {
    const patientId = await createPatient();
    const doctor = await createDoctor();
    const future = await book(patientId, doctor.profileId, {
      status: shared.AppointmentStatuses.CONFIRMED,
      scheduledStart: new Date(Date.now() + 24 * HOUR),
      scheduledEnd: new Date(Date.now() + 25 * HOUR),
    });
    expect((await finishViaApi(future, doctor.userId)).status).toBe(400);

    const current = await book(patientId, doctor.profileId);
    expect((await finishViaApi(current, doctor.userId)).status).toBe(200);
    expect((await finishViaApi(current, doctor.userId)).status).toBe(400);
  });

  test("concurrent finishes close the consult exactly once", async () => {
    const patientId = await createPatient();
    const doctor = await createDoctor();
    const appointmentId = await book(patientId, doctor.profileId);

    const results = await Promise.allSettled(
      Array.from({ length: 10 }, () =>
        ConsultationLifecycleService.finish(appointmentId, doctor.userId, "completed"),
      ),
    );

    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await statusOf(appointmentId)).toBe(shared.AppointmentStatuses.COMPLETED);
  });

  test("Sunday free no-show uses the same finish and runs the Sunday follow-up", async () => {
    const patientId = await createPatient();
    const doctor = await createDoctor();
    const appointment = await db.AppointmentModel.create({
      patientId,
      doctorId: doctor.profileId,
      type: shared.AppointmentTypes.SUNDAY_FREE,
      status: shared.AppointmentStatuses.CONFIRMED,
      scheduledStart: new Date(slotBase - HOUR - ++slot),
      scheduledEnd: new Date(slotBase + HOUR),
    });
    const appointmentId = appointment._id.toString();

    const res = await finishViaApi(appointmentId, doctor.userId, { outcome: "no_show" });

    expect(res.status).toBe(200);
    const stored = await db.AppointmentModel.findById(appointmentId).lean();
    expect(stored).toMatchObject({ status: shared.AppointmentStatuses.NO_SHOW, missedBy: "patient" });
    expect((await db.UserModel.findById(patientId).lean())?.noShowCount).toBe(1);
  });

  test("daily sweep completes attended consults 72h past the slot and leaves the rest", async () => {
    const patientId = await createPatient();
    const doctor = await createDoctor();
    // Distinct slots: (doctorId, scheduledStart) is unique.
    const endedHoursAgo = (hours: number) => ({
      scheduledStart: new Date(Date.now() - (hours + 1) * HOUR),
      scheduledEnd: new Date(Date.now() - hours * HOUR),
    });
    const attended = await book(patientId, doctor.profileId, endedHoursAgo(79));
    const neverJoined = await book(patientId, doctor.profileId, endedHoursAgo(82));
    const recent = await book(patientId, doctor.profileId, {
      scheduledStart: new Date(Date.now() - 3 * HOUR),
      scheduledEnd: new Date(Date.now() - 2 * HOUR),
    });
    for (const appointmentId of [attended, recent]) {
      await db.VideoSessionModel.create({
        appointmentId,
        channelName: `ch-${counter++}`,
        provider: "zoom",
        status: shared.VideoSessionStatuses.ACTIVE,
        doctorJoinedAt: new Date(),
      });
    }

    await ConsultationLifecycleService.finalizeStale();

    expect(await statusOf(attended)).toBe(shared.AppointmentStatuses.COMPLETED);
    expect(await statusOf(neverJoined)).toBe(shared.AppointmentStatuses.IN_PROGRESS);
    expect(await statusOf(recent)).toBe(shared.AppointmentStatuses.IN_PROGRESS);
  });
});
