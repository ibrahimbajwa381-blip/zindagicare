/**
 * QA-ANSWER-NOTIFY — telling a patient that a professional answered their
 * Health Forum question.
 *
 * Real local MongoDB (mongodb-memory-server, ephemeral — never Atlas, never
 * production) + REAL route handlers + REAL MedicalQaService and notifier.
 * Push providers (Expo, web push) are mocked: no real notification is sent.
 * The after-response scheduler is spied so route tests can assert when the
 * notifier is (and is not) triggered. Redis is never reached.
 */
import { MongoMemoryServer } from "mongodb-memory-server";
import { randomBytes, randomUUID } from "crypto";
import type { Role } from "@zindagi/shared";
import { resolveNotificationHref } from "@/lib/notifications/resolve-notification-href";

jest.setTimeout(120000);

delete process.env.UPSTASH_REDIS_REST_URL;
delete process.env.UPSTASH_REDIS_REST_TOKEN;
delete process.env.KV_REST_API_URL;
delete process.env.KV_REST_API_TOKEN;
delete process.env.REDIS_URL;

const expoPush = jest.fn();
const webPush = jest.fn();
jest.mock("@/server/services/push.service", () => ({
  sendExpoPushToUser: (...args: unknown[]) => expoPush(...args),
  sendWebPushToUser: (...args: unknown[]) => webPush(...args),
}));

const answerScheduleSpy = jest.fn();
jest.mock("@/server/lib/schedule-answer-notification", () => ({
  scheduleAnswerNotification: (...args: unknown[]) => answerScheduleSpy(...args),
}));

jest.mock("@/server/lib/schedule-question-alerts", () => ({
  scheduleQuestionAlerts: () => undefined,
}));

jest.mock("@/lib/realtime/medical-qa-emitter", () => {
  const actual = jest.requireActual("@/lib/realtime/medical-qa-emitter");
  return { ...actual, publishMedicalQaEvent: () => undefined };
});

jest.mock("@/lib/auth", () => ({ auth: async () => null }));

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- route payloads differ
type Json = { success: boolean; data: any; error: { code: string; message: string } | null };

/** 14:00 in Pakistan — outside quiet hours. */
const DAYTIME = new Date("2026-10-14T09:00:00Z");
/** 23:30 in Pakistan — inside quiet hours. */
const NIGHT = new Date("2026-10-14T18:30:00Z");

const ANSWER_TEXT = "Synthetic advice: paracetamol 500mg, fluids, and see a doctor if fever exceeds 102F.";
const QUESTION_BODY = "Synthetic private details: diabetic, takes metformin 500mg twice daily.";

describe("Medical Q&A answer notifications (real local MongoDB)", () => {
  let mongod: InstanceType<typeof MongoMemoryServer>;
  let db: typeof import("@zindagi/database");
  let Roles: typeof import("@zindagi/shared").Roles;
  let signMobileAccessToken: typeof import("@/server/api/mobile-jwt").signMobileAccessToken;
  let answersRoute: typeof import("@/app/api/v1/medical-questions/[id]/answers/route");
  let Notifications: typeof import("@/server/services/notification.service");
  let QaService: typeof import("@/server/services/medical-qa.service").MedicalQaService;
  let Notify: typeof import("@/server/services/medical-qa-answer-notify.service");

  let counter = 0;
  const uniq = () => `${Date.now()}-${counter++}`;

  async function makeUser(roles: Role[], extra: Record<string, unknown> = {}) {
    return db.UserModel.create({
      name: "Synthetic",
      email: `answer-notify-${uniq()}@test.local`,
      phone: `+92300${Math.floor(1000000 + Math.random() * 9000000)}`,
      roles,
      ...extra,
    });
  }

  async function makeDoctor(status: "approved" | "pending" = "approved") {
    const user = await makeUser([Roles.DOCTOR]);
    await db.DoctorProfileModel.create({
      userId: user._id,
      pmdcNumber: `PMDC-${uniq()}`,
      verificationStatus: status,
      isListed: true,
      specialties: ["General Physician"],
      consultationFee: 1500,
    });
    return user;
  }

  async function makeStaff(staffType: "nurse" | "physiotherapist") {
    const user = await makeUser([staffType as Role]);
    await db.StaffProfileModel.create({ userId: user._id, staffType, verificationStatus: "approved", isAvailable: true });
    return user;
  }

  async function question(title = "Fever and body ache for two days") {
    const author = await makeUser([Roles.PATIENT]);
    const q = await QaService.createQuestion(
      { id: String(author._id), roles: [Roles.PATIENT] },
      { category: "general", title, body: QUESTION_BODY },
    );
    return { id: q.id, author };
  }

  async function call(
    handler: (req: never) => Promise<Response>,
    method: string,
    path: string,
    user?: { _id: unknown } | null,
    body?: unknown,
  ): Promise<{ status: number; json: Json }> {
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (user) headers.authorization = `Bearer ${await signMobileAccessToken(String(user._id))}`;
    const res = await handler(
      new Request(`http://localhost${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      }) as never,
    );
    return { status: res.status, json: (await res.json()) as Json };
  }

  /** Posts an answer through the real API and returns its id. */
  async function answerVia(user: { _id: unknown }, questionId: string, extra: Record<string, unknown> = {}) {
    const r = await call(answersRoute.POST as never, "POST", `/api/v1/medical-questions/${questionId}/answers`, user, {
      body: ANSWER_TEXT,
      ...extra,
    });
    return r;
  }

  const answeredFor = (userId: import("mongoose").Types.ObjectId) =>
    db.NotificationModel.find({ userId, "payload.type": "medical_question_answered" }).lean();
  const pushedTo = () => [...expoPush.mock.calls, ...webPush.mock.calls].map(([uid]) => String(uid));

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongod.getUri("zindagi_answer_notify_test");
    process.env.FIELD_ENCRYPTION_KEY = randomBytes(32).toString("base64");
    process.env.AUTH_SECRET = "test-secret-at-least-32-chars-long-12345";

    const mongoose = (await import("mongoose")).default;
    db = await import("@zindagi/database");
    ({ Roles } = await import("@zindagi/shared"));
    await db.connectDatabase();
    expect(mongoose.connection.host).toMatch(/127\.0\.0\.1|localhost/);
    await Promise.all([db.MedicalQuestionModel.init(), db.MedicalAnswerModel.init(), db.NotificationModel.init()]);

    ({ signMobileAccessToken } = await import("@/server/api/mobile-jwt"));
    answersRoute = await import("@/app/api/v1/medical-questions/[id]/answers/route");
    // The /notifications routes only pass the session user's id into these
    // functions; importing the routes themselves trips a Next.js/Jest
    // AsyncLocalStorage issue (see authz-idor.test.ts), so test the boundary.
    Notifications = await import("@/server/services/notification.service");
    ({ MedicalQaService: QaService } = await import("@/server/services/medical-qa.service"));
    Notify = await import("@/server/services/medical-qa-answer-notify.service");
  });

  beforeEach(async () => {
    await Promise.all([
      db.UserModel.deleteMany({}),
      db.DoctorProfileModel.deleteMany({}),
      db.StaffProfileModel.deleteMany({}),
      db.MedicalQuestionModel.deleteMany({}),
      db.MedicalAnswerModel.deleteMany({}),
      db.NotificationModel.deleteMany({}),
    ]);
    expoPush.mockReset().mockResolvedValue({ sent: 1, failed: 0 });
    webPush.mockReset().mockResolvedValue({ sent: 0, failed: 0 });
    answerScheduleSpy.mockReset();
  });

  afterAll(async () => {
    const mongoose = (await import("mongoose")).default;
    await mongoose.disconnect();
    await mongod?.stop();
  });

  // ---------------------------------------------------------------------------
  describe("Notification creation", () => {
    test.each([
      ["doctor", "A doctor"],
      ["nurse", "A nurse"],
      ["physiotherapist", "A physiotherapist"],
    ])("a %s's answer through the real API notifies the question's author", async (role, label) => {
      const provider = role === "doctor" ? await makeDoctor() : await makeStaff(role as "nurse" | "physiotherapist");
      const { id, author } = await question();

      const r = await answerVia(provider, id);
      expect(r.status).toBe(200);
      expect(answerScheduleSpy).toHaveBeenCalledTimes(1);
      expect(answerScheduleSpy).toHaveBeenCalledWith(r.json.data.id);

      // Run the job the route scheduled for after the response.
      const result = await Notify.notifyQuestionAnswered(r.json.data.id, { now: DAYTIME });
      expect(result).toEqual({ notified: true, push: "sent" });

      const [n] = await answeredFor(author._id);
      expect(n).toBeDefined();
      expect(n.channel).toBe("in_app");
      expect(n.title).toBe("Your question has an answer");
      expect(n.body).toBe(`${label} answered "Fever and body ache for two days" — tap to read it.`);
      expect(n.payload).toEqual({
        type: "medical_question_answered",
        questionId: id,
        answerId: r.json.data.id,
        url: `/questions/${id}`,
      });
      expect(n.readAt ?? null).toBeNull();
    });

    test("the notification never contains the answer text or the private question body", async () => {
      const doctor = await makeDoctor();
      const { id, author } = await question();
      const r = await answerVia(doctor, id);
      await Notify.notifyQuestionAnswered(r.json.data.id, { now: DAYTIME });

      const [n] = await answeredFor(author._id);
      const stored = JSON.stringify(n);
      const pushed = JSON.stringify([...expoPush.mock.calls, ...webPush.mock.calls]);
      for (const text of [stored, pushed]) {
        expect(text).not.toContain("paracetamol");
        expect(text).not.toContain("metformin");
      }
    });

    test("identifiers in the question title are masked in the preview", async () => {
      const doctor = await makeDoctor();
      const { id, author } = await question("Call me on 0300 1234567 about my rash");
      const r = await answerVia(doctor, id);
      await Notify.notifyQuestionAnswered(r.json.data.id, { now: DAYTIME });
      const [n] = await answeredFor(author._id);
      expect(n.body).not.toMatch(/1234567/);
    });

    test("clicking the notification opens the answered question (bell link and push link agree)", async () => {
      const doctor = await makeDoctor();
      const { id, author } = await question();
      const r = await answerVia(doctor, id);
      await Notify.notifyQuestionAnswered(r.json.data.id, { now: DAYTIME });

      const [n] = await answeredFor(author._id);
      expect(resolveNotificationHref(n.payload as Record<string, unknown>, [Roles.PATIENT])).toBe(`/questions/${id}`);
      expect(webPush).toHaveBeenCalledWith(String(author._id), expect.objectContaining({ url: `/questions/${id}` }));
      expect(expoPush).toHaveBeenCalledWith(
        String(author._id),
        expect.objectContaining({ data: expect.objectContaining({ type: "medical_question_answered", questionId: id }) }),
      );
      // The linked question page shows the answer.
      const detail = await QaService.getQuestion(null, id);
      expect(JSON.stringify(detail)).toContain(r.json.data.id);
    });

    test("a malformed payload never resolves to a link", () => {
      expect(resolveNotificationHref({ type: "medical_question_answered", questionId: "../admin" }, [])).toBeNull();
      expect(resolveNotificationHref({ type: "medical_question_answered" }, [])).toBeNull();
    });

    test("hidden or deleted answers and questions produce no notification", async () => {
      const doctor = await makeDoctor();
      const hiddenAnswer = await question();
      const a1 = await answerVia(doctor, hiddenAnswer.id);
      await db.MedicalAnswerModel.updateOne({ _id: a1.json.data.id }, { $set: { moderationStatus: "hidden" } });

      const deletedQuestion = await question();
      const a2 = await answerVia(doctor, deletedQuestion.id);
      await db.MedicalQuestionModel.updateOne({ _id: deletedQuestion.id }, { $set: { deletedAt: new Date() } });

      expect(await Notify.notifyQuestionAnswered(a1.json.data.id, { now: DAYTIME })).toEqual({
        notified: false,
        reason: "answer_unavailable",
      });
      expect(await Notify.notifyQuestionAnswered(a2.json.data.id, { now: DAYTIME })).toEqual({
        notified: false,
        reason: "question_unavailable",
      });
      expect(await db.NotificationModel.countDocuments({})).toBe(0);
      expect(pushedTo()).toEqual([]);
    });

    test("a deactivated author is not notified", async () => {
      const doctor = await makeDoctor();
      const { id, author } = await question();
      const r = await answerVia(doctor, id);
      await db.UserModel.updateOne({ _id: author._id }, { $set: { isActive: false } });
      expect(await Notify.notifyQuestionAnswered(r.json.data.id, { now: DAYTIME })).toEqual({
        notified: false,
        reason: "author_unavailable",
      });
      expect(await db.NotificationModel.countDocuments({})).toBe(0);
    });

    test("malformed or unknown answer ids are ignored safely", async () => {
      expect(await Notify.notifyQuestionAnswered("not-an-id")).toEqual({ notified: false, reason: "invalid_id" });
      expect(await Notify.notifyQuestionAnswered("0123456789abcdef01234567")).toEqual({
        notified: false,
        reason: "answer_unavailable",
      });
    });
  });

  // ---------------------------------------------------------------------------
  describe("Authorization — only the question's owner", () => {
    test("only the author is notified: not the answerer, other patients or other professionals", async () => {
      const doctor = await makeDoctor();
      const otherDoctor = await makeDoctor();
      const nurse = await makeStaff("nurse");
      const otherPatient = await makeUser([Roles.PATIENT]);
      const { id, author } = await question();

      const r = await answerVia(doctor, id);
      await Notify.notifyQuestionAnswered(r.json.data.id, { now: DAYTIME });

      const recipients = (await db.NotificationModel.find({}).lean()).map((n) => String(n.userId));
      expect(recipients).toEqual([String(author._id)]);
      for (const u of [doctor, otherDoctor, nurse, otherPatient]) expect(await answeredFor(u._id)).toHaveLength(0);
      expect(new Set(pushedTo())).toEqual(new Set([String(author._id)]));
    });

    test("another patient cannot list or mark the author's notification (IDOR)", async () => {
      const doctor = await makeDoctor();
      const intruder = await makeUser([Roles.PATIENT]);
      const { id, author } = await question();
      const r = await answerVia(doctor, id);
      await Notify.notifyQuestionAnswered(r.json.data.id, { now: DAYTIME });
      const [n] = await answeredFor(author._id);
      const nid = String(n._id);

      expect(await Notifications.listUserNotifications(String(intruder._id))).toEqual([]);
      expect((await Notifications.getNotificationSummary(String(intruder._id))).unreadCount).toBe(0);
      await expect(Notifications.markNotificationRead(String(intruder._id), nid)).rejects.toMatchObject({ code: "NOT_FOUND", statusCode: 404 });
      await Notifications.markAllNotificationsRead(String(intruder._id));
      expect((await db.NotificationModel.findById(nid).lean())!.readAt ?? null).toBeNull();

      const own = await Notifications.listUserNotifications(String(author._id));
      expect(own.map((x) => x.id)).toEqual([nid]);
      expect(own[0]!.payload).toMatchObject({ type: "medical_question_answered", questionId: id });
      await Notifications.markNotificationRead(String(author._id), nid);
      expect((await db.NotificationModel.findById(nid).lean())!.readAt).toBeInstanceOf(Date);
    });

    test("the author's own follow-up never notifies them", async () => {
      const { id, author } = await question();
      const r = await answerVia(author, id);
      expect(r.status).toBe(200);
      expect(answerScheduleSpy).not.toHaveBeenCalled();
      // Even if a follow-up id reached the notifier, it is not an answer.
      expect(await Notify.notifyQuestionAnswered(r.json.data.id, { now: DAYTIME })).toEqual({
        notified: false,
        reason: "answer_unavailable",
      });
      expect(await db.NotificationModel.countDocuments({})).toBe(0);
    });

    test("a rejected answer attempt (unverified doctor) triggers no notification", async () => {
      const pending = await makeDoctor("pending");
      const { id } = await question();
      const r = await answerVia(pending, id);
      expect(r.status).toBe(403);
      expect(answerScheduleSpy).not.toHaveBeenCalled();
      expect(await db.NotificationModel.countDocuments({})).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  describe("Duplicate prevention", () => {
    test("re-running the notifier for the same answer creates one notification and one push", async () => {
      const doctor = await makeDoctor();
      const { id, author } = await question();
      const r = await answerVia(doctor, id);

      await Notify.notifyQuestionAnswered(r.json.data.id, { now: DAYTIME });
      expect(await Notify.notifyQuestionAnswered(r.json.data.id, { now: DAYTIME })).toEqual({
        notified: false,
        reason: "already_notified",
      });
      expect(await answeredFor(author._id)).toHaveLength(1);
      expect(expoPush).toHaveBeenCalledTimes(1);
      expect(webPush).toHaveBeenCalledTimes(1);
    });

    test("concurrent runs for the same answer produce exactly one notification and one push", async () => {
      const doctor = await makeDoctor();
      const { id, author } = await question();
      const r = await answerVia(doctor, id);

      const results = await Promise.all(
        Array.from({ length: 5 }, () => Notify.notifyQuestionAnswered(r.json.data.id, { now: DAYTIME })),
      );
      expect(results.filter((x) => x.notified)).toHaveLength(1);
      expect(await answeredFor(author._id)).toHaveLength(1);
      expect(expoPush).toHaveBeenCalledTimes(1);
    });

    test("a retried (idempotent) answer submission schedules the notification once", async () => {
      const doctor = await makeDoctor();
      const { id } = await question();
      const idempotencyKey = randomUUID();

      const first = await answerVia(doctor, id, { idempotencyKey });
      const retry = await answerVia(doctor, id, { idempotencyKey });
      expect(retry.status).toBe(200);
      expect(retry.json.data.id).toBe(first.json.data.id);
      expect(answerScheduleSpy).toHaveBeenCalledTimes(1);
      expect(await db.MedicalAnswerModel.countDocuments({ questionId: id })).toBe(1);
    });

    test("concurrent duplicate submissions schedule the notification once", async () => {
      const doctor = await makeDoctor();
      const { id } = await question();
      const idempotencyKey = randomUUID();
      const rs = await Promise.all(Array.from({ length: 4 }, () => answerVia(doctor, id, { idempotencyKey })));
      expect(new Set(rs.map((r) => r.json.data.id)).size).toBe(1);
      expect(answerScheduleSpy).toHaveBeenCalledTimes(1);
    });

    test("separate answers each get their own in-app notification", async () => {
      const doctor = await makeDoctor();
      const nurse = await makeStaff("nurse");
      const { id, author } = await question();
      const a = await answerVia(doctor, id);
      const b = await answerVia(nurse, id);
      await Notify.notifyQuestionAnswered(a.json.data.id, { now: DAYTIME });
      await Notify.notifyQuestionAnswered(b.json.data.id, { now: DAYTIME });
      const answerIds = (await answeredFor(author._id)).map((n) => (n.payload as { answerId: string }).answerId).sort();
      expect(answerIds).toEqual([a.json.data.id, b.json.data.id].sort());
    });
  });

  // ---------------------------------------------------------------------------
  describe("Push behavior", () => {
    test("a patient with no registered device still gets the in-app notification", async () => {
      expoPush.mockResolvedValue({ sent: 0, failed: 0 });
      const doctor = await makeDoctor();
      const { id, author } = await question();
      const r = await answerVia(doctor, id);
      expect(await Notify.notifyQuestionAnswered(r.json.data.id, { now: DAYTIME })).toEqual({
        notified: true,
        push: "no_device",
      });
      expect(await answeredFor(author._id)).toHaveLength(1);
    });

    test("a web-only device is reached when Expo has no token", async () => {
      expoPush.mockResolvedValue({ sent: 0, failed: 0 });
      webPush.mockResolvedValue({ sent: 1, failed: 0 });
      const doctor = await makeDoctor();
      const { id } = await question();
      const r = await answerVia(doctor, id);
      expect(await Notify.notifyQuestionAnswered(r.json.data.id, { now: DAYTIME })).toEqual({
        notified: true,
        push: "sent",
      });
      expect(webPush).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ tag: `mqa-answer-${id}`, url: `/questions/${id}` }),
      );
    });

    test("provider failures keep the in-app notification and never throw", async () => {
      expoPush.mockRejectedValue(new Error("expo down"));
      webPush.mockResolvedValue({ sent: 0, failed: 1 });
      const doctor = await makeDoctor();
      const { id, author } = await question();
      const r = await answerVia(doctor, id);
      expect(await Notify.notifyQuestionAnswered(r.json.data.id, { now: DAYTIME })).toEqual({
        notified: true,
        push: "failed",
      });
      expect(await answeredFor(author._id)).toHaveLength(1);
    });

    test("one provider failing does not block the other", async () => {
      expoPush.mockRejectedValue(new Error("expo down"));
      webPush.mockResolvedValue({ sent: 1, failed: 0 });
      const doctor = await makeDoctor();
      const { id } = await question();
      const r = await answerVia(doctor, id);
      expect(await Notify.notifyQuestionAnswered(r.json.data.id, { now: DAYTIME })).toEqual({
        notified: true,
        push: "sent",
      });
    });

    test("a hanging provider is cut off by the timeout", async () => {
      expoPush.mockImplementation(() => new Promise(() => undefined));
      const doctor = await makeDoctor();
      const { id, author } = await question();
      const r = await answerVia(doctor, id);
      const result = await Notify.notifyQuestionAnswered(r.json.data.id, { now: DAYTIME, pushTimeoutMs: 50 });
      expect(result).toEqual({ notified: true, push: "failed" });
      expect(await answeredFor(author._id)).toHaveLength(1);
    });

    test("quiet hours keep the in-app notification but skip the push", async () => {
      const doctor = await makeDoctor();
      const { id, author } = await question();
      const r = await answerVia(doctor, id);
      expect(await Notify.notifyQuestionAnswered(r.json.data.id, { now: NIGHT })).toEqual({
        notified: true,
        push: "skipped_quiet_hours",
      });
      expect(await answeredFor(author._id)).toHaveLength(1);
      expect(pushedTo()).toEqual([]);
    });

    test("several answers in a burst push once per question, but every answer is in the bell", async () => {
      const [d1, d2, d3] = [await makeDoctor(), await makeDoctor(), await makeDoctor()];
      const { id, author } = await question();
      const answers = [await answerVia(d1, id), await answerVia(d2, id), await answerVia(d3, id)];

      const results = [];
      for (const [i, a] of answers.entries()) {
        results.push(
          await Notify.notifyQuestionAnswered(a.json.data.id, { now: new Date(DAYTIME.getTime() + i * 60_000) }),
        );
      }
      expect(results.map((x) => (x.notified ? x.push : x.reason))).toEqual(["sent", "skipped_recent", "skipped_recent"]);
      expect(await answeredFor(author._id)).toHaveLength(3);
      expect(expoPush).toHaveBeenCalledTimes(1);

      // After the window, a new answer pushes again.
      const later = await answerVia(await makeDoctor(), id);
      const after = new Date(DAYTIME.getTime() + Notify.ANSWER_NOTIFY_CONFIG.pushPerQuestionWindowMs + 5 * 60_000);
      expect(await Notify.notifyQuestionAnswered(later.json.data.id, { now: after })).toEqual({
        notified: true,
        push: "sent",
      });
    });

    test("the push throttle is per question: answers on two different questions both push", async () => {
      const doctor = await makeDoctor();
      const author = await makeUser([Roles.PATIENT]);
      const viewer = { id: String(author._id), roles: [Roles.PATIENT] };
      const q1 = await QaService.createQuestion(viewer, { category: "general", title: "First synthetic question", body: QUESTION_BODY });
      const q2 = await QaService.createQuestion(viewer, { category: "general", title: "Second synthetic question", body: QUESTION_BODY });
      const a1 = await answerVia(doctor, q1.id);
      const a2 = await answerVia(doctor, q2.id);
      await Notify.notifyQuestionAnswered(a1.json.data.id, { now: DAYTIME });
      expect(await Notify.notifyQuestionAnswered(a2.json.data.id, { now: DAYTIME })).toEqual({
        notified: true,
        push: "sent",
      });
      expect(expoPush).toHaveBeenCalledTimes(2);
    });
  });

  // ---------------------------------------------------------------------------
  // Boundaries: exact edges of quiet hours, the push window and input limits.
  // ---------------------------------------------------------------------------
  describe("Boundaries", () => {
    /** Pakistan is UTC+5 all year (no DST). */
    const pk = (hh: number, mm: number, ss = 0) => new Date(Date.UTC(2026, 9, 14, hh - 5, mm, ss));

    test.each([
      ["21:59:59", pk(21, 59, 59), "sent"],
      ["22:00:00", pk(22, 0, 0), "skipped_quiet_hours"],
      ["00:00:00", pk(24, 0, 0), "skipped_quiet_hours"],
      ["07:59:59", pk(7, 59, 59), "skipped_quiet_hours"],
      ["08:00:00", pk(8, 0, 0), "sent"],
    ])("quiet hours edge at %s PKT → %s (bell always kept)", async (_label, now, expected) => {
      const doctor = await makeDoctor();
      const { id, author } = await question();
      const r = await answerVia(doctor, id);
      expect(await Notify.notifyQuestionAnswered(r.json.data.id, { now })).toEqual({ notified: true, push: expected });
      expect(await answeredFor(author._id)).toHaveLength(1);
    });

    test("push window edge: 1 ms before the window ends is throttled, exactly at the end pushes", async () => {
      const window = Notify.ANSWER_NOTIFY_CONFIG.pushPerQuestionWindowMs;
      const { id } = await question();
      const [a, b, c] = [
        await answerVia(await makeDoctor(), id),
        await answerVia(await makeDoctor(), id),
        await answerVia(await makeDoctor(), id),
      ];
      const t0 = DAYTIME.getTime();
      expect(await Notify.notifyQuestionAnswered(a.json.data.id, { now: new Date(t0) })).toEqual({ notified: true, push: "sent" });
      expect(await Notify.notifyQuestionAnswered(b.json.data.id, { now: new Date(t0 + window - 1) })).toEqual({
        notified: true,
        push: "skipped_recent",
      });
      // The window runs from the last push sent (a), not from b's skipped one.
      expect(await Notify.notifyQuestionAnswered(c.json.data.id, { now: new Date(t0 + window) })).toEqual({
        notified: true,
        push: "sent",
      });
      expect(expoPush).toHaveBeenCalledTimes(2);
    });

    test("a steady stream of answers keeps pushing about once per window (no starvation)", async () => {
      const window = Notify.ANSWER_NOTIFY_CONFIG.pushPerQuestionWindowMs;
      const { id, author } = await question();
      const step = window * 0.9; // a new answer every 9 minutes
      const outcomes: string[] = [];
      for (let i = 0; i < 6; i++) {
        const a = await answerVia(await makeDoctor(), id);
        const r = await Notify.notifyQuestionAnswered(a.json.data.id, { now: new Date(DAYTIME.getTime() + i * step) });
        outcomes.push(r.notified ? r.push : r.reason);
      }
      // 0, 9 (skip), 18 (push), 27 (skip), 36 (push), 45 (skip)
      expect(outcomes).toEqual(["sent", "skipped_recent", "sent", "skipped_recent", "sent", "skipped_recent"]);
      expect(await answeredFor(author._id)).toHaveLength(6);
    });

    test("a push that reaches no device frees the slot for the next answer", async () => {
      expoPush.mockResolvedValueOnce({ sent: 0, failed: 0 });
      const { id } = await question();
      const a = await answerVia(await makeDoctor(), id);
      const b = await answerVia(await makeDoctor(), id);
      expect(await Notify.notifyQuestionAnswered(a.json.data.id, { now: DAYTIME })).toEqual({ notified: true, push: "no_device" });
      expect(
        await Notify.notifyQuestionAnswered(b.json.data.id, { now: new Date(DAYTIME.getTime() + 60_000) }),
      ).toEqual({ notified: true, push: "sent" });
    });

    test("a failed push frees the slot; quiet hours never take it", async () => {
      expoPush.mockRejectedValueOnce(new Error("expo down"));
      const { id } = await question();
      const [a, b, c] = [
        await answerVia(await makeDoctor(), id),
        await answerVia(await makeDoctor(), id),
        await answerVia(await makeDoctor(), id),
      ];
      expect(await Notify.notifyQuestionAnswered(a.json.data.id, { now: DAYTIME })).toEqual({ notified: true, push: "failed" });
      expect(await Notify.notifyQuestionAnswered(b.json.data.id, { now: NIGHT })).toEqual({
        notified: true,
        push: "skipped_quiet_hours",
      });
      const morning = new Date("2026-10-15T03:00:00Z"); // 08:00 PKT
      expect(await Notify.notifyQuestionAnswered(c.json.data.id, { now: morning })).toEqual({ notified: true, push: "sent" });
      expect((await db.MedicalQuestionModel.findById(id).lean())!.answerPushAt).toEqual(morning);
    });

    test.each([
      ["minimum (2 chars)", "ok", 200],
      ["below minimum (1 char)", "k", 400],
      ["whitespace only", "     ", 400],
      ["maximum (3000 chars)", "a".repeat(3000), 200],
      ["above maximum (3001 chars)", "a".repeat(3001), 400],
    ])("answer body %s → %i, and only a saved answer schedules a notification", async (_label, body, status) => {
      const doctor = await makeDoctor();
      const { id } = await question();
      const r = await call(answersRoute.POST as never, "POST", `/api/v1/medical-questions/${id}/answers`, doctor, { body });
      expect(r.status).toBe(status);
      expect(answerScheduleSpy).toHaveBeenCalledTimes(status === 200 ? 1 : 0);
    });

    test("an answer to a nonexistent or malformed question id schedules nothing", async () => {
      const doctor = await makeDoctor();
      const missing = await answerVia(doctor, "0123456789abcdef01234567");
      const malformed = await answerVia(doctor, "not-an-id");
      expect(missing.status).toBe(404);
      expect([400, 404]).toContain(malformed.status);
      expect(answerScheduleSpy).not.toHaveBeenCalled();
    });

    test("a title at the maximum length (150) is previewed within 80 characters", async () => {
      const doctor = await makeDoctor();
      const { id, author } = await question("Q".repeat(150));
      const r = await answerVia(doctor, id);
      await Notify.notifyQuestionAnswered(r.json.data.id, { now: DAYTIME });
      const [n] = await answeredFor(author._id);
      const preview = n.body.match(/answered "(.*)" — tap/)![1];
      expect(Array.from(preview)).toHaveLength(80);
      expect(preview.endsWith("…")).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Edge cases: state changes between answering and notifying, unusual users.
  // ---------------------------------------------------------------------------
  describe("Edge cases", () => {
    async function rawAnswer(questionId: string, authorId: import("mongoose").Types.ObjectId, extra: Record<string, unknown> = {}) {
      return db.MedicalAnswerModel.create({
        questionId,
        authorId,
        authorRole: "doctor",
        kind: "answer",
        body: ANSWER_TEXT,
        ...extra,
      });
    }

    test("an answer deleted before the notifier runs sends nothing", async () => {
      const doctor = await makeDoctor();
      const { id } = await question();
      const r = await answerVia(doctor, id);
      await db.MedicalAnswerModel.updateOne({ _id: r.json.data.id }, { $set: { deletedAt: new Date() } });
      expect(await Notify.notifyQuestionAnswered(r.json.data.id, { now: DAYTIME })).toEqual({
        notified: false,
        reason: "answer_unavailable",
      });
      expect(pushedTo()).toEqual([]);
    });

    test("a question hidden by moderation after answering sends nothing", async () => {
      const doctor = await makeDoctor();
      const { id } = await question();
      const r = await answerVia(doctor, id);
      await db.MedicalQuestionModel.updateOne({ _id: id }, { $set: { moderationStatus: "hidden" } });
      expect(await Notify.notifyQuestionAnswered(r.json.data.id, { now: DAYTIME })).toEqual({
        notified: false,
        reason: "question_unavailable",
      });
    });

    test("a deleted author account is not notified", async () => {
      const doctor = await makeDoctor();
      const { id, author } = await question();
      const r = await answerVia(doctor, id);
      await db.UserModel.updateOne({ _id: author._id }, { $set: { deletedAt: new Date() } });
      expect(await Notify.notifyQuestionAnswered(r.json.data.id, { now: DAYTIME })).toEqual({
        notified: false,
        reason: "author_unavailable",
      });
    });

    test("a doctor who asked a question is notified when another professional answers", async () => {
      const askingDoctor = await makeDoctor();
      const nurse = await makeStaff("nurse");
      const q = await QaService.createQuestion(
        { id: String(askingDoctor._id), roles: [Roles.DOCTOR] },
        { category: "general", title: "Synthetic question from a doctor", body: QUESTION_BODY },
      );
      const r = await answerVia(nurse, q.id);
      expect(await Notify.notifyQuestionAnswered(r.json.data.id, { now: DAYTIME })).toEqual({ notified: true, push: "sent" });
      expect(await answeredFor(askingDoctor._id)).toHaveLength(1);
    });

    test("a verified doctor answering their own question posts a follow-up and is not notified", async () => {
      const doctor = await makeDoctor();
      const q = await QaService.createQuestion(
        { id: String(doctor._id), roles: [Roles.DOCTOR] },
        { category: "general", title: "Synthetic question from a doctor", body: QUESTION_BODY },
      );
      const r = await answerVia(doctor, q.id);
      expect(r.status).toBe(200);
      expect(answerScheduleSpy).not.toHaveBeenCalled();
      expect(await db.NotificationModel.countDocuments({})).toBe(0);
    });

    test("an answer row authored by the question owner is never notified, even if mislabelled", async () => {
      const { id, author } = await question();
      const a = await rawAnswer(id, author._id);
      expect(await Notify.notifyQuestionAnswered(String(a._id), { now: DAYTIME })).toEqual({
        notified: false,
        reason: "own_question",
      });
    });

    test("an unexpected stored role still produces a safe, neutral notification", async () => {
      const doctor = await makeDoctor();
      const { id, author } = await question();
      const a = await rawAnswer(id, doctor._id);
      await db.MedicalAnswerModel.collection.updateOne({ _id: a._id }, { $set: { authorRole: "constructor" } });
      await Notify.notifyQuestionAnswered(String(a._id), { now: DAYTIME });
      const [n] = await answeredFor(author._id);
      expect(n.body).toMatch(/^A professional answered/);
    });

    test.each([
      ["null", null],
      ["undefined", undefined],
      ["a number", 12345],
      ["an object", { $gt: "" }],
      ["__proto__", "__proto__"],
      ["empty string", ""],
      ["24 non-hex chars", "zzzzzzzzzzzzzzzzzzzzzzzz"],
      ["NoSQL operator text", '{"$ne":null}'],
    ])("the notifier rejects %s as an answer id without touching the database", async (_label, input) => {
      const result = await Notify.notifyQuestionAnswered(input as never, { now: DAYTIME });
      expect(result).toEqual({ notified: false, reason: "invalid_id" });
      expect(await db.NotificationModel.countDocuments({})).toBe(0);
    });

    test("an uppercase answer id is accepted and stored in canonical form", async () => {
      const doctor = await makeDoctor();
      const { id, author } = await question();
      const r = await answerVia(doctor, id);
      await Notify.notifyQuestionAnswered(String(r.json.data.id).toUpperCase(), { now: DAYTIME });
      const [n] = await answeredFor(author._id);
      expect((n.payload as { answerId: string }).answerId).toBe(r.json.data.id);
      expect(String(n._id)).toBe(r.json.data.id);
    });

    test("a question id passed as an answer id notifies nobody", async () => {
      const doctor = await makeDoctor();
      const { id } = await question();
      await answerVia(doctor, id);
      expect(await Notify.notifyQuestionAnswered(id, { now: DAYTIME })).toEqual({
        notified: false,
        reason: "answer_unavailable",
      });
    });
  });

  // ---------------------------------------------------------------------------
  // Robustness: concurrency, partial failures, recovery and volume.
  // ---------------------------------------------------------------------------
  describe("Robustness", () => {
    test("simultaneous answers from different professionals push exactly once", async () => {
      const { id, author } = await question();
      const answers = [];
      for (let i = 0; i < 4; i++) answers.push(await answerVia(await makeDoctor(), id));

      const results = await Promise.all(
        answers.map((a) => Notify.notifyQuestionAnswered(a.json.data.id, { now: DAYTIME })),
      );
      expect(results.every((r) => r.notified)).toBe(true);
      expect(await answeredFor(author._id)).toHaveLength(4);
      // Exactly one push: the slot claim is atomic.
      expect(expoPush).toHaveBeenCalledTimes(1);
      expect(results.filter((r) => r.notified && r.push === "sent")).toHaveLength(1);
    });

    test("a transient database error on create propagates (no push), and a later retry recovers once", async () => {
      const doctor = await makeDoctor();
      const { id, author } = await question();
      const r = await answerVia(doctor, id);

      const create = jest
        .spyOn(db.NotificationModel, "create")
        .mockRejectedValueOnce(Object.assign(new Error("write conflict"), { code: 112 }) as never);
      await expect(Notify.notifyQuestionAnswered(r.json.data.id, { now: DAYTIME })).rejects.toThrow("write conflict");
      expect(pushedTo()).toEqual([]);
      create.mockRestore();

      expect(await Notify.notifyQuestionAnswered(r.json.data.id, { now: DAYTIME })).toEqual({ notified: true, push: "sent" });
      expect(await Notify.notifyQuestionAnswered(r.json.data.id, { now: DAYTIME })).toEqual({
        notified: false,
        reason: "already_notified",
      });
      expect(await answeredFor(author._id)).toHaveLength(1);
      expect(expoPush).toHaveBeenCalledTimes(1);
    });

    test("partial provider results: any delivered device counts as sent", async () => {
      expoPush.mockResolvedValue({ sent: 0, failed: 2 });
      webPush.mockResolvedValue({ sent: 1, failed: 1 });
      const doctor = await makeDoctor();
      const { id } = await question();
      const r = await answerVia(doctor, id);
      expect(await Notify.notifyQuestionAnswered(r.json.data.id, { now: DAYTIME })).toEqual({ notified: true, push: "sent" });
    });

    test("both providers hanging: the notifier still finishes within its timeout budget", async () => {
      expoPush.mockImplementation(() => new Promise(() => undefined));
      webPush.mockImplementation(() => new Promise(() => undefined));
      const doctor = await makeDoctor();
      const { id, author } = await question();
      const r = await answerVia(doctor, id);
      const started = Date.now();
      expect(await Notify.notifyQuestionAnswered(r.json.data.id, { now: DAYTIME, pushTimeoutMs: 100 })).toEqual({
        notified: true,
        push: "failed",
      });
      expect(Date.now() - started).toBeLessThan(2000);
      expect(await answeredFor(author._id)).toHaveLength(1);
    });

    test("a provider throwing synchronously does not lose the bell notification", async () => {
      expoPush.mockImplementation(() => {
        throw new Error("sync boom");
      });
      const doctor = await makeDoctor();
      const { id, author } = await question();
      const r = await answerVia(doctor, id);
      const result = await Notify.notifyQuestionAnswered(r.json.data.id, { now: DAYTIME }).catch((e: Error) => e);
      expect(await answeredFor(author._id)).toHaveLength(1);
      expect(result).toEqual({ notified: true, push: "failed" });
    });

    test("volume: 30 answers × 3 concurrent retries → exactly 30 bell entries, all for the author", async () => {
      const { id, author } = await question();
      const doctor = await makeDoctor();
      const answerIds: string[] = [];
      for (let i = 0; i < 30; i++) {
        const a = await db.MedicalAnswerModel.create({
          questionId: id,
          authorId: doctor._id,
          authorRole: "doctor",
          kind: "answer",
          body: `${ANSWER_TEXT} #${i}`,
        });
        answerIds.push(String(a._id));
      }
      await Promise.all(
        answerIds.flatMap((aid) => [0, 1, 2].map(() => Notify.notifyQuestionAnswered(aid, { now: DAYTIME }))),
      );
      const notes = await db.NotificationModel.find({}).lean();
      expect(notes).toHaveLength(30);
      expect(new Set(notes.map((n) => String(n.userId)))).toEqual(new Set([String(author._id)]));
      expect(new Set(notes.map((n) => String(n._id)))).toEqual(new Set(answerIds));
      expect(expoPush).toHaveBeenCalledTimes(1);
    });

    test("volume: 20 patients answered at once each get exactly their own question's notification", async () => {
      const doctor = await makeDoctor();
      const qs: Awaited<ReturnType<typeof question>>[] = [];
      for (let i = 0; i < 20; i++) qs.push(await question(`Synthetic question number ${i}`));
      const answers: Awaited<ReturnType<typeof answerVia>>[] = [];
      for (const q of qs) answers.push(await answerVia(doctor, q.id));
      await Promise.all(answers.map((a) => Notify.notifyQuestionAnswered(a.json.data.id, { now: DAYTIME })));

      for (const [i, q] of qs.entries()) {
        const mine = await answeredFor(q.author._id);
        expect(mine).toHaveLength(1);
        expect(mine[0]!.payload).toMatchObject({ questionId: q.id, answerId: answers[i]!.json.data.id });
        expect(mine[0]!.body).toContain(`Synthetic question number ${i}"`);
      }
      expect(new Set(expoPush.mock.calls.map(([uid]) => String(uid)))).toEqual(
        new Set(qs.map((q) => String(q.author._id))),
      );
    });
  });
});
