/**
 * VIDEO-REJOIN — a participant who leaves the video call can join again.
 *
 * Server side: real local MongoDB (mongodb-memory-server) + REAL
 * VideoSessionService; only the Zoom HTTP API is mocked.
 * Client side: the REAL inline script from public/zoom/meeting.html, run in a
 * vm against a fake window + fake ZoomMtg, to pin the leave/rejoin protocol
 * (a session that is never left in Zoom hangs the next join on "Joining Meeting…").
 */
import { MongoMemoryServer } from "mongodb-memory-server";
import { randomBytes } from "crypto";
import { readFileSync } from "fs";
import path from "path";
import vm from "vm";

jest.setTimeout(60000);

let createZoomMeetingCallCount = 0;

jest.mock("@/lib/zoom/api", () => ({
  createZoomMeeting: jest.fn(async () => {
    createZoomMeetingCallCount += 1;
    const id = 5000 + createZoomMeetingCallCount;
    return { id, password: "pw", join_url: `https://zoom.us/j/${id}`, start_url: `https://zoom.us/s/${id}` };
  }),
}));

jest.mock("@/lib/zoom/config", () => ({
  isZoomConfigured: jest.fn(() => true),
  getZoomConfig: jest.fn(() => ({ accountId: "acc", clientId: "id", clientSecret: "secret" })),
  getPublicZoomSdkKey: jest.fn(() => "public-key"),
  getZoomSdkSignatureCredentials: jest.fn(() => ({ sdkKey: "k", sdkSecret: "s" })),
}));

jest.mock("@/server/services/urgent-consult.service", () => ({
  UrgentConsultService: { tryCompleteByAppointmentId: jest.fn().mockResolvedValue(false) },
}));

describe("Video rejoin after leaving (real local MongoDB, mocked Zoom API only)", () => {
  let mongod: InstanceType<typeof MongoMemoryServer>;
  let db: typeof import("@zindagi/database");
  let mongooseMod: typeof import("mongoose");
  let shared: typeof import("@zindagi/shared");
  let VideoSessionService: typeof import("@/server/services/video-session.service").VideoSessionService;
  let patientId: string;
  let doctorUserId: string;
  let doctorProfileId: string;
  let slotCounter = 0;
  const seedBase = Date.now();

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongod.getUri("video_rejoin_test");
    process.env.FIELD_ENCRYPTION_KEY = randomBytes(32).toString("base64");

    db = await import("@zindagi/database");
    mongooseMod = (await import("mongoose")).default;
    shared = await import("@zindagi/shared");
    await db.connectDatabase();
    await db.AppointmentModel.init();
    await db.VideoSessionModel.init();
    ({ VideoSessionService } = await import("@/server/services/video-session.service"));

    const patient = await db.UserModel.create({
      name: "Rejoin Patient",
      email: `rejoin-patient-${Date.now()}@example.com`,
      phone: `+9230030${Math.floor(Math.random() * 90000 + 10000)}`,
      roles: ["patient"],
      isActive: true,
    });
    patientId = patient._id.toString();

    const doctorUser = await db.UserModel.create({
      name: "Rejoin Doctor",
      email: `rejoin-doctor-${Date.now()}@example.com`,
      phone: `+9230031${Math.floor(Math.random() * 90000 + 10000)}`,
      roles: ["doctor"],
      isActive: true,
    });
    doctorUserId = doctorUser._id.toString();

    const doctorProfile = await db.DoctorProfileModel.create({
      userId: doctorUserId,
      isListed: true,
      verificationStatus: shared.VerificationStatuses.APPROVED,
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

  beforeEach(() => {
    createZoomMeetingCallCount = 0;
  });

  async function seedConfirmedAppointment() {
    slotCounter += 1;
    const scheduledStart = new Date(seedBase - 2 * 60 * 1000 - slotCounter);
    const appt = await db.AppointmentModel.create({
      type: shared.AppointmentTypes.ONLINE,
      status: shared.AppointmentStatuses.CONFIRMED,
      patientId,
      doctorId: doctorProfileId,
      scheduledStart,
      scheduledEnd: new Date(scheduledStart.getTime() + 20 * 60 * 1000),
      timezone: "Asia/Karachi",
      isOnline: true,
    });
    return appt._id.toString();
  }

  test.each(["patient", "doctor"] as const)(
    "%s: join → joined → leave → join again returns the same meeting with a valid signature",
    async (who) => {
      const userId = who === "patient" ? patientId : doctorUserId;
      const appointmentId = await seedConfirmedAppointment();

      const first = await VideoSessionService.getJoinPayload(userId, appointmentId);
      await VideoSessionService.recordJoin(userId, appointmentId);
      await VideoSessionService.recordLeave(userId, appointmentId);

      const status = await VideoSessionService.getSessionStatus(userId, appointmentId);
      expect(status.canJoin).toBe(true);
      expect(status.appointmentStatus).toBe(shared.AppointmentStatuses.IN_PROGRESS);

      const second = await VideoSessionService.getJoinPayload(userId, appointmentId);
      expect(second.meetingNumber).toBe(first.meetingNumber);
      expect(second.role).toBe(who);
      expect(second.signature.split(".")).toHaveLength(3);
      expect(createZoomMeetingCallCount).toBe(1);
      expect(await db.VideoSessionModel.countDocuments({ appointmentId })).toBe(1);
    },
  );

  test("repeated leave/rejoin cycles by both sides stay on one meeting", async () => {
    const appointmentId = await seedConfirmedAppointment();
    const meetings = new Set<string>();

    for (let i = 0; i < 5; i += 1) {
      for (const userId of [patientId, doctorUserId]) {
        const payload = await VideoSessionService.getJoinPayload(userId, appointmentId);
        meetings.add(payload.meetingNumber);
        await VideoSessionService.recordJoin(userId, appointmentId);
        await VideoSessionService.recordLeave(userId, appointmentId);
      }
    }

    expect(meetings.size).toBe(1);
    expect(createZoomMeetingCallCount).toBe(1);
  });

  test("rejoin works even if the leave request never reached the server (tab closed)", async () => {
    const appointmentId = await seedConfirmedAppointment();
    const first = await VideoSessionService.getJoinPayload(patientId, appointmentId);
    await VideoSessionService.recordJoin(patientId, appointmentId);

    const second = await VideoSessionService.getJoinPayload(patientId, appointmentId);
    expect(second.meetingNumber).toBe(first.meetingNumber);
  });
});

// ---------------------------------------------------------------------------
// meeting.html leave/rejoin protocol
// ---------------------------------------------------------------------------

type Posted = { type: string; message?: string };

const meetingHtml = readFileSync(path.join(__dirname, "../../public/zoom/meeting.html"), "utf8");
const inlineScript = [...meetingHtml.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]).join("\n");

function loadMeetingFrame({ search = "", leaveFails = false } = {}) {
  const origin = "https://zindagicare.test";
  const posted: Posted[] = [];
  const listeners: Record<string, ((event: unknown) => void)[]> = {};
  const fakeEl = () => ({ style: {} as Record<string, string>, textContent: "", children: [] });
  const elements: Record<string, ReturnType<typeof fakeEl>> = {};

  const ZoomMtg = {
    setZoomJSLib: jest.fn(),
    preLoadWasm: jest.fn(),
    prepareWebSDK: jest.fn(),
    i18n: { load: jest.fn(() => Promise.resolve()) },
    init: jest.fn((opts: { success: () => void }) => opts.success()),
    join: jest.fn((opts: { success: () => void }) => opts.success()),
    leaveMeeting: jest.fn((opts: { error?: (e: unknown) => void }) => {
      if (leaveFails) opts.error?.({ reason: "not in meeting" });
    }),
  };

  const window = {
    location: { origin, search },
    parent: { postMessage: (data: Posted) => posted.push(data) },
    crossOriginIsolated: false,
    addEventListener: (type: string, fn: (event: unknown) => void) => {
      (listeners[type] ??= []).push(fn);
    },
  };

  const document = {
    title: "",
    body: {},
    getElementById: (id: string) => (elements[id] ??= fakeEl()),
    querySelectorAll: () => [],
  };

  vm.runInNewContext(inlineScript, {
    window,
    document,
    ZoomMtg,
    URLSearchParams,
    setTimeout,
    clearTimeout,
    MutationObserver: class {
      observe() {}
    },
  });

  const dispatch = (type: string, event: unknown) => listeners[type]?.forEach((fn) => fn(event));
  const send = (data: unknown, from = origin) => dispatch("message", { origin: from, data });
  const flush = () => new Promise((r) => setImmediate(r));

  return { posted, ZoomMtg, send, dispatch, flush, origin };
}

const joinPayload = {
  signature: "a.b.c",
  meetingNumber: "123",
  userName: "Patient",
  sdkKey: "k",
  passcode: "pw",
  leaveUrl: "https://zindagicare.test/zoom/meeting.html?left=1",
};

describe("meeting.html leave/rejoin protocol", () => {
  test("announces ready, joins, and reports joined", async () => {
    const frame = loadMeetingFrame();
    expect(frame.posted.map((p) => p.type)).toEqual(["zindagi-zoom-ready"]);

    frame.send({ type: "zindagi-zoom-join", payload: joinPayload });
    await frame.flush();

    expect(frame.ZoomMtg.join).toHaveBeenCalledTimes(1);
    expect(frame.ZoomMtg.init.mock.calls[0][0].leaveUrl).toBe(joinPayload.leaveUrl);
    expect(frame.posted.map((p) => p.type)).toContain("zindagi-zoom-joined");
  });

  test("leave request after joining calls ZoomMtg.leaveMeeting so Zoom drops the participant", async () => {
    const frame = loadMeetingFrame();
    frame.send({ type: "zindagi-zoom-join", payload: joinPayload });
    await frame.flush();

    frame.send({ type: "zindagi-zoom-leave" });
    expect(frame.ZoomMtg.leaveMeeting).toHaveBeenCalledTimes(1);
  });

  test("leave request before joining reports left immediately without touching Zoom", () => {
    const frame = loadMeetingFrame();
    frame.send({ type: "zindagi-zoom-leave" });
    expect(frame.ZoomMtg.leaveMeeting).not.toHaveBeenCalled();
    expect(frame.posted.map((p) => p.type)).toContain("zindagi-zoom-left");
  });

  test("if Zoom fails to leave, the parent is still told the call is over", async () => {
    const frame = loadMeetingFrame({ leaveFails: true });
    frame.send({ type: "zindagi-zoom-join", payload: joinPayload });
    await frame.flush();

    frame.send({ type: "zindagi-zoom-leave" });
    expect(frame.posted.map((p) => p.type)).toContain("zindagi-zoom-left");
  });

  test("Zoom's redirect to leaveUrl (?left=1) hands control back instead of loading the app inside the iframe", () => {
    const frame = loadMeetingFrame({ search: "?left=1" });
    expect(frame.posted.map((p) => p.type)).toEqual(["zindagi-zoom-left"]);
  });

  test("closing the tab / removing the iframe mid-call still leaves the Zoom meeting", async () => {
    const frame = loadMeetingFrame();
    frame.send({ type: "zindagi-zoom-join", payload: joinPayload });
    await frame.flush();

    frame.dispatch("pagehide", {});
    expect(frame.ZoomMtg.leaveMeeting).toHaveBeenCalledTimes(1);
  });

  test("pagehide before any join does not call Zoom", () => {
    const frame = loadMeetingFrame();
    frame.dispatch("pagehide", {});
    expect(frame.ZoomMtg.leaveMeeting).not.toHaveBeenCalled();
  });

  test("messages from another origin are ignored", async () => {
    const frame = loadMeetingFrame();
    frame.send({ type: "zindagi-zoom-join", payload: joinPayload }, "https://evil.test");
    frame.send({ type: "zindagi-zoom-leave" }, "https://evil.test");
    await frame.flush();
    expect(frame.ZoomMtg.join).not.toHaveBeenCalled();
    expect(frame.ZoomMtg.leaveMeeting).not.toHaveBeenCalled();
  });
});
