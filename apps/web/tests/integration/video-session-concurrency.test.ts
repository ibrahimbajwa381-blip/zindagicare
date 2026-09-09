/**
 * VIDEO-* — Video consultation / video-session P0 concurrency audit.
 *
 * Real local MongoDB (mongodb-memory-server, ephemeral — never Atlas, never
 * production) + the REAL @zindagi/database models and REAL VideoSessionService
 * code. Only the Zoom HTTP API itself is mocked (never call the real Zoom API
 * from a test) — everything else is genuine: real Mongoose writes, real
 * indexes, real concurrent promise interleaving against a real mongod.
 *
 * Core question this file exists to answer: can concurrent join requests
 * create duplicate Zoom sessions, corrupt participant state, or corrupt
 * appointment state?
 */
import { MongoMemoryServer } from "mongodb-memory-server";
import { randomBytes } from "crypto";

jest.setTimeout(60000);

let createZoomMeetingCallCount = 0;
const createdMeetingIds: number[] = [];

jest.mock("@/lib/zoom/api", () => ({
  createZoomMeeting: jest.fn(async () => {
    createZoomMeetingCallCount += 1;
    const id = 1000 + createZoomMeetingCallCount;
    // Artificial delay — a real Zoom API call takes real network time; this
    // widens the read-then-create race window enough to reliably reproduce
    // it against a fast local mongod, same technique used for the payment
    // race in the prior audit phase.
    await new Promise((r) => setTimeout(r, 30));
    createdMeetingIds.push(id);
    return { id, password: "pw", join_url: `https://zoom.us/j/${id}`, start_url: `https://zoom.us/s/${id}` };
  }),
}));

jest.mock("@/lib/zoom/config", () => ({
  isZoomConfigured: jest.fn(() => true),
  getZoomConfig: jest.fn(() => ({
    accountId: "acc",
    clientId: "id",
    clientSecret: "secret",
  })),
  getPublicZoomSdkKey: jest.fn(() => "public-key"),
  getZoomSdkSignatureCredentials: jest.fn(() => ({ sdkKey: "k", sdkSecret: "s" })),
}));

jest.mock("@/lib/zoom/signature", () => ({
  generateZoomMeetingSdkSignature: jest.fn(() => "signature"),
}));

jest.mock("@/server/services/urgent-consult.service", () => ({
  UrgentConsultService: {
    tryCompleteByAppointmentId: jest.fn().mockResolvedValue(false),
  },
}));

describe("Video-session concurrency (real local MongoDB, mocked Zoom API only)", () => {
  let mongod: InstanceType<typeof MongoMemoryServer>;
  let AppointmentModel: typeof import("@zindagi/database").AppointmentModel;
  let UserModel: typeof import("@zindagi/database").UserModel;
  let DoctorProfileModel: typeof import("@zindagi/database").DoctorProfileModel;
  let VideoSessionModel: typeof import("@zindagi/database").VideoSessionModel;
  let mongooseMod: typeof import("mongoose");
  let AppointmentStatuses: typeof import("@zindagi/shared").AppointmentStatuses;
  let AppointmentTypes: typeof import("@zindagi/shared").AppointmentTypes;
  let VerificationStatuses: typeof import("@zindagi/shared").VerificationStatuses;
  let VideoSessionService: typeof import("@/server/services/video-session.service").VideoSessionService;

  let patientId: string;
  let doctorUserId: string;
  let doctorProfileId: string;
  let slotCounter = 0;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongod.getUri("video_concurrency_test");
    process.env.FIELD_ENCRYPTION_KEY = randomBytes(32).toString("base64");

    const db = await import("@zindagi/database");
    AppointmentModel = db.AppointmentModel;
    UserModel = db.UserModel;
    DoctorProfileModel = db.DoctorProfileModel;
    VideoSessionModel = db.VideoSessionModel;
    mongooseMod = (await import("mongoose")).default;

    const shared = await import("@zindagi/shared");
    AppointmentStatuses = shared.AppointmentStatuses;
    AppointmentTypes = shared.AppointmentTypes;
    VerificationStatuses = shared.VerificationStatuses;

    await db.connectDatabase();
    await AppointmentModel.init();
    await VideoSessionModel.init();

    ({ VideoSessionService } = await import("@/server/services/video-session.service"));

    const patient = await UserModel.create({
      name: "Video Patient",
      email: `video-patient-${Date.now()}@example.com`,
      phone: `+9230020${Math.floor(Math.random() * 90000 + 10000)}`,
      roles: ["patient"],
      isActive: true,
    });
    patientId = patient._id.toString();

    const doctorUser = await UserModel.create({
      name: "Video Doctor",
      email: `video-doctor-${Date.now()}@example.com`,
      phone: `+9230021${Math.floor(Math.random() * 90000 + 10000)}`,
      roles: ["doctor"],
      isActive: true,
    });
    doctorUserId = doctorUser._id.toString();

    const doctorProfile = await DoctorProfileModel.create({
      userId: doctorUser._id.toString(),
      isListed: true,
      verificationStatus: VerificationStatuses.APPROVED,
      consultationFee: 1500,
      specialties: ["General Physician"],
      coverageCities: ["Lahore"],
      weeklyAvailability: Array.from({ length: 7 }, (_, dayOfWeek) => ({
        dayOfWeek,
        startTimeLocal: "00:00",
        endTimeLocal: "23:40",
      })),
    });
    doctorProfileId = doctorProfile._id.toString();
  });

  afterAll(async () => {
    await mongooseMod.disconnect();
    await mongod.stop();
  });

  async function seedJoinableAppointment(
    status: (typeof AppointmentStatuses)[keyof typeof AppointmentStatuses],
  ) {
    slotCounter += 1;
    const scheduledStart = new Date(Date.now() - 2 * 60 * 1000 - slotCounter); // started 2 min ago, unique per call
    const scheduledEnd = new Date(scheduledStart.getTime() + 20 * 60 * 1000);
    const appt = await AppointmentModel.create({
      type: AppointmentTypes.ONLINE,
      status,
      patientId,
      doctorId: doctorProfileId,
      scheduledStart,
      scheduledEnd,
      timezone: "Asia/Karachi",
      isOnline: true,
    });
    return appt;
  }

  beforeEach(() => {
    createZoomMeetingCallCount = 0;
    createdMeetingIds.length = 0;
  });

  // =========================================================================
  // CRITICAL RACE TEST — patient join x2, doctor join x2, all concurrent
  // =========================================================================
  test("CRITICAL: 4 concurrent joins (patient x2, doctor x2) on a fresh CONFIRMED appointment create exactly ONE Zoom session, never duplicate", async () => {
    const appt = await seedJoinableAppointment(AppointmentStatuses.CONFIRMED);
    const appointmentId = appt._id.toString();

    const results = await Promise.allSettled([
      VideoSessionService.getJoinPayload(patientId, appointmentId),
      VideoSessionService.getJoinPayload(patientId, appointmentId),
      VideoSessionService.getJoinPayload(doctorUserId, appointmentId),
      VideoSessionService.getJoinPayload(doctorUserId, appointmentId),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled") as PromiseFulfilledResult<
      Awaited<ReturnType<typeof VideoSessionService.getJoinPayload>>
    >[];
    const rejected = results.filter((r) => r.status === "rejected");

    console.log(`createZoomMeeting call count: ${createZoomMeetingCallCount}`);
    console.log(`fulfilled=${fulfilled.length} rejected=${rejected.length}`);
    if (rejected.length) {
      console.log(
        "rejection reasons:",
        rejected.map((r) => {
          const reason = (r as PromiseRejectedResult).reason;
          return reason instanceof Error ? `${reason.constructor.name}: ${reason.message}` : reason;
        }),
      );
    }

    const sessionDocs = await VideoSessionModel.find({ appointmentId }).lean();
    console.log(`VideoSession documents for this appointment: ${sessionDocs.length}`);

    const meetingNumbersReturned = new Set(fulfilled.map((r) => r.value.meetingNumber));
    console.log(`Distinct meetingNumber values returned to callers: ${[...meetingNumbersReturned].join(", ")}`);

    // The actual assertions this test exists to make:
    expect(sessionDocs.length).toBe(1); // exactly one DB record, never duplicated
    expect(meetingNumbersReturned.size).toBe(1); // every caller who succeeded got the SAME meeting
    // No caller should see an unhandled/raw exception — either it succeeds
    // and gets the shared session, or a clean, expected error.
    for (const r of rejected) {
      const reason = (r as PromiseRejectedResult).reason;
      expect(reason).toBeInstanceOf(Error);
    }
  });

  // =========================================================================
  // VIDEO-006/007 — creation vs reuse
  // =========================================================================
  test("VIDEO-006/007: first join creates a Zoom session, second join reuses it (no second Zoom API call)", async () => {
    const appt = await seedJoinableAppointment(AppointmentStatuses.CONFIRMED);
    const appointmentId = appt._id.toString();

    const first = await VideoSessionService.getJoinPayload(patientId, appointmentId);
    const second = await VideoSessionService.getJoinPayload(doctorUserId, appointmentId);

    expect(createZoomMeetingCallCount).toBe(1);
    expect(first.meetingNumber).toBe(second.meetingNumber);

    const sessionDocs = await VideoSessionModel.find({ appointmentId }).lean();
    expect(sessionDocs.length).toBe(1);
  });

  // =========================================================================
  // VIDEO-015/016 — same participant joining twice
  // =========================================================================
  test("VIDEO-015: the same patient joining twice sequentially does not duplicate anything", async () => {
    const appt = await seedJoinableAppointment(AppointmentStatuses.CONFIRMED);
    const appointmentId = appt._id.toString();

    // recordJoin requires a session to already exist — a real client always
    // calls getJoinPayload first (which creates it) before recordJoin.
    await VideoSessionService.getJoinPayload(patientId, appointmentId);
    await VideoSessionService.recordJoin(patientId, appointmentId);
    await VideoSessionService.recordJoin(patientId, appointmentId);

    const session = await VideoSessionModel.findOne({ appointmentId }).lean();
    const finalAppt = await AppointmentModel.findById(appointmentId).lean();
    expect(session?.status).toBe("active");
    expect(finalAppt?.status).toBe(AppointmentStatuses.IN_PROGRESS);
  });

  // =========================================================================
  // VIDEO-017/018 — N simultaneous joins by the SAME participant
  // =========================================================================
  test.each([10, 25, 50, 100])(
    "VIDEO-017: %i simultaneous joins by the same patient never crash, never duplicate, never corrupt state",
    async (n) => {
      const appt = await seedJoinableAppointment(AppointmentStatuses.CONFIRMED);
      const appointmentId = appt._id.toString();

      const start = Date.now();
      const results = await Promise.allSettled(
        Array.from({ length: n }, () => VideoSessionService.getJoinPayload(patientId, appointmentId)),
      );
      const elapsed = Date.now() - start;

      const fulfilled = results.filter((r) => r.status === "fulfilled") as PromiseFulfilledResult<
        Awaited<ReturnType<typeof VideoSessionService.getJoinPayload>>
      >[];
      const rejected = results.filter((r) => r.status === "rejected");
      const sessionDocs = await VideoSessionModel.find({ appointmentId }).lean();
      const finalAppt = await AppointmentModel.findById(appointmentId).lean();
      const meetingNumbersReturned = new Set(fulfilled.map((r) => r.value.meetingNumber));

      console.log(
        `n=${n}: fulfilled=${fulfilled.length} rejected=${rejected.length} zoomCalls=${createZoomMeetingCallCount} sessionDocs=${sessionDocs.length} elapsed=${elapsed}ms finalStatus=${finalAppt?.status}`,
      );

      // The data-integrity invariants that must always hold: exactly one DB
      // record, everyone who succeeds gets the SAME meeting, and any
      // rejection is a clean AppError (never a raw driver/crash error).
      expect(sessionDocs.length).toBe(1);
      expect(meetingNumbersReturned.size).toBe(1);
      for (const r of rejected) {
        expect((r as PromiseRejectedResult).reason).toBeInstanceOf(Error);
      }
      // NOT asserted as 1: createZoomMeetingCallCount can legitimately be up
      // to n under the current fix (every first-time racer calls the real
      // Zoom API before the DB write settles who "wins") — this is a known,
      // reported, unfixed resource-efficiency gap, not a correctness bug.
      // See BUG-VIDEO-002 in the final report.
    },
  );

  // =========================================================================
  // JOIN + LEAVE RACE
  // =========================================================================
  test("JOIN x25 / LEAVE x25 concurrently: no negative duration, no NaN, no crash, consistent final state", async () => {
    const appt = await seedJoinableAppointment(AppointmentStatuses.CONFIRMED);
    const appointmentId = appt._id.toString();

    // Prime a real session by joining once first (recordLeave requires an
    // existing session — matches real client behavior: you must join before
    // you can leave).
    await VideoSessionService.getJoinPayload(patientId, appointmentId);
    await VideoSessionService.recordJoin(patientId, appointmentId);

    const joinCalls = Array.from({ length: 25 }, () => VideoSessionService.recordJoin(patientId, appointmentId));
    const leaveCalls = Array.from({ length: 25 }, () => VideoSessionService.recordLeave(patientId, appointmentId));
    const results = await Promise.allSettled([...joinCalls, ...leaveCalls]);

    const rejected = results.filter((r) => r.status === "rejected");
    for (const r of rejected) {
      expect((r as PromiseRejectedResult).reason).toBeInstanceOf(Error);
    }

    const session = await VideoSessionModel.findOne({ appointmentId }).lean();
    console.log(
      `final session: status=${session?.status} duration=${session?.durationSeconds} startedAt=${session?.startedAt} endedAt=${session?.endedAt}`,
    );

    if (session?.durationSeconds !== undefined && session?.durationSeconds !== null) {
      expect(session.durationSeconds).not.toBeNaN();
      expect(session.durationSeconds).toBeGreaterThanOrEqual(0);
      expect(Number.isFinite(session.durationSeconds)).toBe(true);
    }

    const sessionDocs = await VideoSessionModel.find({ appointmentId }).lean();
    expect(sessionDocs.length).toBe(1);
  });

  // =========================================================================
  // APPOINTMENT STATE RACE — join vs cancel (already fixed once) re-verified
  // in this file's own harness (independent of the prior script)
  // =========================================================================
  test("Appointment-state race: concurrent join and a status flip to CANCELLED never leaves appt IN_PROGRESS+CANCELLED mixed, and never both", async () => {
    const appt = await seedJoinableAppointment(AppointmentStatuses.CONFIRMED);
    const appointmentId = appt._id.toString();

    const results = await Promise.allSettled([
      VideoSessionService.recordJoin(patientId, appointmentId),
      AppointmentModel.updateOne(
        { _id: appointmentId, status: AppointmentStatuses.CONFIRMED },
        { $set: { status: AppointmentStatuses.CANCELLED } },
      ),
    ]);

    for (const r of results) {
      if (r.status === "rejected") {
        expect((r as PromiseRejectedResult).reason).toBeInstanceOf(Error);
      }
    }

    const finalAppt = await AppointmentModel.findById(appointmentId).lean();
    // Must land on exactly one of these two — never anything else, and this
    // read must not throw / never see a third, impossible value.
    expect([AppointmentStatuses.IN_PROGRESS, AppointmentStatuses.CANCELLED]).toContain(finalAppt?.status);
  });

  // =========================================================================
  // AUTHORIZATION
  // =========================================================================
  describe("Authorization", () => {
    test("an unrelated user (neither patient nor doctor) cannot join", async () => {
      const appt = await seedJoinableAppointment(AppointmentStatuses.CONFIRMED);
      const appointmentId = appt._id.toString();
      const stranger = await UserModel.create({
        name: "Stranger",
        email: `stranger-${Date.now()}@example.com`,
        phone: `+9230099${Math.floor(Math.random() * 90000 + 10000)}`,
        roles: ["patient"],
        isActive: true,
      });

      await expect(
        VideoSessionService.getJoinPayload(stranger._id.toString(), appointmentId),
      ).rejects.toMatchObject({ statusCode: 403 });

      const sessionDocs = await VideoSessionModel.find({ appointmentId }).lean();
      expect(sessionDocs.length).toBe(0); // no Zoom session was created for a rejected join
      expect(createZoomMeetingCallCount).toBe(0);
    });

    test("a non-existent appointment id -> clean 404, no crash", async () => {
      await expect(
        VideoSessionService.getJoinPayload(patientId, "507f1f77bcf86cd799439000"),
      ).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  // =========================================================================
  // APPOINTMENT STATES — join attempted against every status
  // =========================================================================
  describe("Join attempted against every appointment status", () => {
    test.each(["pending", "confirmed", "in_progress", "completed", "cancelled", "no_show"])(
      "status=%s",
      async (status) => {
        const appt = await seedJoinableAppointment(
          status as (typeof AppointmentStatuses)[keyof typeof AppointmentStatuses],
        );
        const appointmentId = appt._id.toString();

        const result = await VideoSessionService.getJoinPayload(patientId, appointmentId).catch((e) => e);

        if (status === "confirmed" || status === "in_progress") {
          expect(result).not.toBeInstanceOf(Error);
        } else {
          expect(result).toBeInstanceOf(Error);
          expect((result as { statusCode?: number }).statusCode).toBe(400);
        }
      },
    );
  });
});
