/**
 * QA-STATE — state-based tests for the public Medical Q&A feature.
 *
 * Covers the state machines the code actually implements (see the map below),
 * which actions are allowed in each state, and the invariants that must hold
 * after every transition, including repeated, concurrent and failed ones.
 *
 * Real local MongoDB (mongodb-memory-server, ephemeral — never Atlas, never
 * production) + REAL route handlers + REAL auth (mobile Bearer JWT signed with
 * a test secret) + REAL MedicalQaService. Replaced: object storage (double),
 * realtime publisher (spy), push providers (mocks — nothing leaves the
 * process), and the two background schedulers (spies; a test runs the real
 * notifier explicitly when it needs to). Global fetch throws, as a backstop.
 *
 * State map (confirmed in medical-qa.model.ts / medical-qa.service.ts):
 *   MedicalQuestion  moderationStatus: visible ⇄ hidden   (admin, via a report)
 *                    deletedAt:        unset → set        (author or admin; terminal)
 *                    alertStatus:      pending → processing → done | failed (alerts service)
 *   MedicalAnswer    kind: answer (verified provider) | follow_up (question author)
 *                    moderationStatus: visible ⇄ hidden   (admin, via a report)
 *                    no edit or delete endpoint exists
 *   MedicalQaReport  status: open → actioned | dismissed  (admin)
 */
import { MongoMemoryServer } from "mongodb-memory-server";
import { randomBytes, randomUUID } from "crypto";
import { buildObjectStorageDouble } from "../helpers/object-storage-double";
import { makeValidJpeg, toFile } from "../helpers/synthetic-files";
import type { Role } from "@zindagi/shared";

jest.setTimeout(120000);

delete process.env.UPSTASH_REDIS_REST_URL;
delete process.env.UPSTASH_REDIS_REST_TOKEN;
delete process.env.KV_REST_API_URL;
delete process.env.KV_REST_API_TOKEN;
delete process.env.REDIS_URL;

const objectStorageDouble = buildObjectStorageDouble();
jest.mock("@/server/lib/object-storage", () => {
  const actual = jest.requireActual("@/server/lib/object-storage");
  return {
    ...actual,
    isObjectStorageConfigured: () => true,
    putObject: (...args: Parameters<typeof objectStorageDouble.putObject>) => objectStorageDouble.putObject(...args),
    getObject: (...args: Parameters<typeof objectStorageDouble.getObject>) => objectStorageDouble.getObject(...args),
    deleteObject: (...args: Parameters<typeof objectStorageDouble.deleteObject>) =>
      objectStorageDouble.deleteObject(...args),
  };
});

const publishSpy = jest.fn();
jest.mock("@/lib/realtime/medical-qa-emitter", () => {
  const actual = jest.requireActual("@/lib/realtime/medical-qa-emitter");
  return { ...actual, publishMedicalQaEvent: (...args: unknown[]) => publishSpy(...args) };
});

const sendExpoPush = jest.fn();
const sendWebPush = jest.fn();
jest.mock("@/server/services/push.service", () => ({
  sendExpoPushToUser: (...args: unknown[]) => sendExpoPush(...args),
  sendWebPushToUser: (...args: unknown[]) => sendWebPush(...args),
}));

const scheduleQuestionAlerts = jest.fn();
jest.mock("@/server/lib/schedule-question-alerts", () => ({
  scheduleQuestionAlerts: (...args: unknown[]) => scheduleQuestionAlerts(...args),
}));

const scheduleAnswerNotification = jest.fn();
jest.mock("@/server/lib/schedule-answer-notification", () => ({
  scheduleAnswerNotification: (...args: unknown[]) => scheduleAnswerNotification(...args),
}));

jest.mock("@/lib/auth", () => ({ auth: async () => null }));

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- each route returns a different payload shape
type Json = { success: boolean; data: any; error: { code: string; message: string } | null };
type Handler = (req: never) => Promise<Response>;
type Actor = { _id: unknown } | null;

describe("Medical Q&A state transitions (real local MongoDB)", () => {
  let mongod: InstanceType<typeof MongoMemoryServer>;
  let mongooseMod: typeof import("mongoose");
  let db: typeof import("@zindagi/database");
  let Roles: typeof import("@zindagi/shared").Roles;
  let signMobileAccessToken: typeof import("@/server/api/mobile-jwt").signMobileAccessToken;
  let notifyQuestionAnswered: typeof import("@/server/services/medical-qa-answer-notify.service").notifyQuestionAnswered;
  let sweepMissedAnswerNotifications: typeof import("@/server/services/medical-qa-answer-notify.service").sweepMissedAnswerNotifications;
  let MedicalQaAlerts: typeof import("@/server/services/medical-qa-alerts.service").MedicalQaAlerts;
  let isQuietHours: typeof import("@/server/lib/medical-qa-alert-rules").isQuietHours;

  let questionsRoute: typeof import("@/app/api/v1/medical-questions/route");
  let questionRoute: typeof import("@/app/api/v1/medical-questions/[id]/route");
  let answersRoute: typeof import("@/app/api/v1/medical-questions/[id]/answers/route");
  let attachmentsRoute: typeof import("@/app/api/v1/medical-questions/[id]/attachments/route");
  let attachmentRoute: typeof import("@/app/api/v1/medical-questions/[id]/attachments/[attachmentId]/route");
  let reportsRoute: typeof import("@/app/api/v1/medical-questions/[id]/reports/route");
  let adminReportsRoute: typeof import("@/app/api/v1/admin/medical-questions/reports/route");

  const realFetch = global.fetch;
  let counter = 0;
  const uniq = () => `${Date.now()}-${counter++}`;

  // ---------------------------------------------------------------- fixtures
  async function makeUser(roles: Role[], extra: Record<string, unknown> = {}) {
    return db.UserModel.create({
      name: "Synthetic User",
      email: `qa-state-${uniq()}@test.local`,
      phone: `+92300${Math.floor(1000000 + Math.random() * 9000000)}`,
      roles,
      ...extra,
    });
  }
  const makePatient = (extra: Record<string, unknown> = {}) => makeUser([Roles.PATIENT], extra);
  const makeAdmin = () => makeUser([Roles.ADMIN]);

  async function makeDoctor(status: "approved" | "pending" = "approved") {
    const user = await makeUser([Roles.DOCTOR, Roles.PATIENT]);
    await db.DoctorProfileModel.create({
      userId: user._id,
      pmdcNumber: `PMDC-${uniq()}`,
      verificationStatus: status,
      isListed: status === "approved",
      specialties: ["General Physician"],
      consultationFee: 1500,
    });
    return user;
  }

  // ---------------------------------------------------------------- HTTP
  async function call(handler: unknown, method: string, path: string, user?: Actor, body?: unknown) {
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (user) headers.authorization = `Bearer ${await signMobileAccessToken(String(user._id))}`;
    const req = new Request(`http://localhost${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
    });
    const res = await (handler as Handler)(req as never);
    let json: Json;
    try {
      json = JSON.parse(await res.text());
    } catch {
      json = { success: false, data: null, error: null };
    }
    return { status: res.status, json };
  }

  const validQuestion = () => ({
    category: "physiotherapy",
    title: `Lower back pain after lifting ${uniq()}`,
    body: "Synthetic test question: lower back pain for two weeks after lifting a heavy box at work.",
  });

  const ask = async (user: Actor, overrides: Record<string, unknown> = {}) => {
    const r = await call(questionsRoute.POST, "POST", "/api/v1/medical-questions", user, {
      ...validQuestion(),
      ...overrides,
    });
    expect(r.status).toBe(200);
    return r.json.data.id as string;
  };
  const getQ = (id: string, user?: Actor) => call(questionRoute.GET, "GET", `/api/v1/medical-questions/${id}`, user);
  const del = (id: string, user: Actor) => call(questionRoute.DELETE, "DELETE", `/api/v1/medical-questions/${id}`, user);
  const reply = (id: string, user: Actor, body: Record<string, unknown> = { body: "Please rest and use a warm compress." }) =>
    call(answersRoute.POST, "POST", `/api/v1/medical-questions/${id}/answers`, user, body);
  const report = (id: string, user: Actor, targetType: "question" | "answer", targetId: string) =>
    call(reportsRoute.POST, "POST", `/api/v1/medical-questions/${id}/reports`, user, { targetType, targetId, reason: "misleading" });
  const moderate = (admin: Actor, reportId: string, action: "hide" | "restore" | "dismiss") =>
    call(adminReportsRoute.PATCH, "PATCH", "/api/v1/admin/medical-questions/reports", admin, { reportId, action });
  const list = (query: string, user?: Actor) => call(questionsRoute.GET, "GET", `/api/v1/medical-questions?${query}`, user);
  const listedIds = async (query: string, user?: Actor) =>
    ((await list(query, user)).json.data.items as Array<{ id: string }>).map((q) => q.id);

  async function upload(questionId: string, user: Actor) {
    const fd = new FormData();
    fd.set("file", toFile(await makeValidJpeg(), "photo.jpg", "image/jpeg"));
    const headers: Record<string, string> = {};
    if (user) headers.authorization = `Bearer ${await signMobileAccessToken(String(user._id))}`;
    const req = new Request(`http://localhost/api/v1/medical-questions/${questionId}/attachments`, {
      method: "POST",
      headers,
      body: fd,
    });
    const res = await attachmentsRoute.POST(req as never);
    return { status: res.status, json: (await res.json()) as Json };
  }

  async function readPhoto(questionId: string, attachmentId: string, user: Actor) {
    const headers: Record<string, string> = {};
    if (user) headers.authorization = `Bearer ${await signMobileAccessToken(String(user._id))}`;
    const req = new Request(`http://localhost/api/v1/medical-questions/${questionId}/attachments/${attachmentId}`, { headers });
    return (await attachmentRoute.GET(req as never)).status;
  }

  /** Files a report and returns its id, so an admin can act on the target. */
  async function reportId(questionId: string, targetType: "question" | "answer", targetId: string) {
    const r = await report(questionId, await makePatient(), targetType, targetId);
    expect(r.status).toBe(200);
    const row = await db.MedicalQaReportModel.findOne({ targetId, status: "open" }).sort({ createdAt: -1 }).lean();
    return String(row!._id);
  }

  const questionDoc = (id: string) => db.MedicalQuestionModel.findById(id).lean();
  /** Pushes are skipped in quiet hours (22:00–08:00 PKT), so push counts depend on the clock. */
  const pushesExpected = (n: number, at: Date = new Date()) => (isQuietHours(at) ? 0 : n);
  /** Noon in Pakistan: a fixed daytime clock for notifier calls that must attempt a push. */
  const DAYTIME = new Date("2026-10-15T07:00:00Z");
  const counts = async () => ({
    questions: await db.MedicalQuestionModel.countDocuments({}),
    answers: await db.MedicalAnswerModel.countDocuments({}),
    reports: await db.MedicalQaReportModel.countDocuments({}),
    notifications: await db.NotificationModel.countDocuments({}),
  });

  /**
   * Invariants that must hold for a question after any sequence of operations:
   *  - answerCount equals the number of visible, non-deleted provider answers;
   *  - every answer/follow-up points at this existing question;
   *  - follow-ups are authored by the question's author, answers never are.
   */
  async function expectQuestionInvariants(id: string) {
    const q = await questionDoc(id);
    expect(q).toBeTruthy();
    const rows = await db.MedicalAnswerModel.find({ questionId: q!._id }).lean();
    const visibleAnswers = rows.filter((a) => a.kind === "answer" && a.moderationStatus === "visible" && !a.deletedAt);
    expect(q!.answerCount).toBe(visibleAnswers.length);
    expect(q!.answerCount).toBeGreaterThanOrEqual(0);
    for (const a of rows) {
      expect(String(a.questionId)).toBe(id);
      if (a.kind === "follow_up") expect(String(a.authorId)).toBe(String(q!.authorId));
      else expect(String(a.authorId)).not.toBe(String(q!.authorId));
    }
  }

  // ---------------------------------------------------------------- lifecycle
  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongod.getUri("medical_qa_state");
    process.env.FIELD_ENCRYPTION_KEY = randomBytes(32).toString("base64");
    process.env.AUTH_SECRET = "test-secret-at-least-32-chars-long-12345";
    // Backstop: nothing in these tests may reach the network.
    global.fetch = (() => Promise.reject(new Error("network access is blocked in tests"))) as typeof fetch;

    db = await import("@zindagi/database");
    mongooseMod = (await import("mongoose")).default;
    Roles = (await import("@zindagi/shared")).Roles;
    await db.connectDatabase();
    // Guard: refuse to run against anything but the in-memory server.
    expect(mongooseMod.connection.host).toMatch(/127\.0\.0\.1|localhost/);
    await Promise.all([
      db.MedicalQuestionModel.init(),
      db.MedicalAnswerModel.init(),
      db.MedicalQaReportModel.init(),
      db.NotificationModel.init(),
    ]);

    ({ signMobileAccessToken } = await import("@/server/api/mobile-jwt"));
    ({ notifyQuestionAnswered, sweepMissedAnswerNotifications } = await import(
      "@/server/services/medical-qa-answer-notify.service"
    ));
    ({ MedicalQaAlerts } = await import("@/server/services/medical-qa-alerts.service"));
    ({ isQuietHours } = await import("@/server/lib/medical-qa-alert-rules"));
    questionsRoute = await import("@/app/api/v1/medical-questions/route");
    questionRoute = await import("@/app/api/v1/medical-questions/[id]/route");
    answersRoute = await import("@/app/api/v1/medical-questions/[id]/answers/route");
    attachmentsRoute = await import("@/app/api/v1/medical-questions/[id]/attachments/route");
    attachmentRoute = await import("@/app/api/v1/medical-questions/[id]/attachments/[attachmentId]/route");
    reportsRoute = await import("@/app/api/v1/medical-questions/[id]/reports/route");
    adminReportsRoute = await import("@/app/api/v1/admin/medical-questions/reports/route");
  });

  beforeEach(() => {
    sendExpoPush.mockResolvedValue({ sent: 0, failed: 0 });
    sendWebPush.mockResolvedValue({ sent: 0, failed: 0 });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    publishSpy.mockReset();
    sendExpoPush.mockReset();
    sendWebPush.mockReset();
    scheduleQuestionAlerts.mockReset();
    scheduleAnswerNotification.mockReset();
    objectStorageDouble.setFailNextPut(null);
  });

  afterAll(async () => {
    global.fetch = realFetch;
    await mongooseMod.disconnect();
    await mongod.stop();
  });

  // ===========================================================================
  describe("A. Question creation: none → visible", () => {
    test("a valid submission creates exactly one question in its initial state, owned by the session user", async () => {
      const patient = await makePatient();
      const before = await counts();
      const id = await ask(patient);

      const q = await questionDoc(id);
      expect(String(q!.authorId)).toBe(String(patient._id));
      expect(q!).toMatchObject({
        category: "physiotherapy",
        moderationStatus: "visible",
        answerCount: 0,
        attachmentCount: 0,
        alertStatus: "pending",
        alertAttempts: 0,
      });
      expect(q!.deletedAt).toBeUndefined();
      expect((await counts()).questions).toBe(before.questions + 1);

      // Side effect: new-question alerts are scheduled once, for this question only.
      expect(scheduleQuestionAlerts).toHaveBeenCalledTimes(1);
      expect(scheduleQuestionAlerts).toHaveBeenCalledWith(id);

      // Retrievable everywhere it should appear.
      expect((await getQ(id)).json.data.question.id).toBe(id);
      expect(await listedIds("")).toContain(id);
      expect(await listedIds("filter=unanswered")).toContain(id);
      expect(await listedIds("filter=mine", patient)).toContain(id);
      expect(await listedIds("filter=mine", await makePatient())).not.toContain(id);
    });

    test("API default topic: an omitted category is stored as general (the ask form now requires a topic)", async () => {
      const patient = await makePatient();
      const payload: Partial<ReturnType<typeof validQuestion>> = validQuestion();
      delete payload.category;
      const r = await call(questionsRoute.POST, "POST", "/api/v1/medical-questions", patient, payload);
      expect(r.status).toBe(200);
      expect((await questionDoc(r.json.data.id))!.category).toBe("general");
    });

    test.each([
      ["empty object", {}],
      ["missing title", { title: undefined }],
      ["missing body", { body: undefined }],
      ["title shorter than 10 after trimming", { title: "  short   " }],
      ["body of whitespace only", { body: " ".repeat(40) }],
      ["title over 150", { title: "t".repeat(151) }],
      ["unknown category", { category: "astrology" }],
      ["numeric category", { category: 7 }],
      ["array body", { body: ["a", "b"] }],
      ["malformed idempotency key", { idempotencyKey: "not-a-uuid" }],
      ["client-set alertStatus", { alertStatus: "done" }],
      ["client-set answerCount", { answerCount: 9 }],
      ["client-set deletedAt", { deletedAt: null }],
      ["client-set authorId", { authorId: "507f1f77bcf86cd799439011" }],
    ])("rejects %s with 400 and leaves no records or side effects", async (_label, overrides) => {
      const patient = await makePatient();
      const payload = { ...validQuestion(), ...overrides } as Record<string, unknown>;
      for (const k of Object.keys(payload)) if (payload[k] === undefined) delete payload[k];
      const payloadFor = _label === "empty object" ? {} : payload;

      const before = await counts();
      const r = await call(questionsRoute.POST, "POST", "/api/v1/medical-questions", patient, payloadFor);
      expect(r.status).toBe(400);
      expect(r.json.success).toBe(false);
      expect(await counts()).toEqual(before);
      expect(scheduleQuestionAlerts).not.toHaveBeenCalled();
    });

    test.each([
      ["no credentials", async () => null],
      ["a garbage bearer token", async () => "garbage"],
      ["a deactivated account", async () => makePatient({ isActive: false })],
      ["a soft-deleted account", async () => makePatient({ deletedAt: new Date() })],
      ["a currently banned account", async () => makePatient({ bannedUntil: new Date(Date.now() + 3600e3) })],
    ])("rejects submission from %s with 401 and creates nothing", async (_label, actor) => {
      const who = await actor();
      const before = await counts();
      let status: number;
      if (who === "garbage") {
        const req = new Request("http://localhost/api/v1/medical-questions", {
          method: "POST",
          headers: { "content-type": "application/json", authorization: "Bearer garbage" },
          body: JSON.stringify(validQuestion()),
        });
        status = (await questionsRoute.POST(req as never)).status;
      } else {
        status = (await call(questionsRoute.POST, "POST", "/api/v1/medical-questions", who as Actor, validQuestion())).status;
      }
      expect(status).toBe(401);
      expect(await counts()).toEqual(before);
      expect(scheduleQuestionAlerts).not.toHaveBeenCalled();
    });

    test("replaying an idempotency key with different content returns the original question unchanged", async () => {
      const patient = await makePatient();
      const idempotencyKey = randomUUID();
      const first = await ask(patient, { idempotencyKey });
      const original = await questionDoc(first);

      const replay = await call(questionsRoute.POST, "POST", "/api/v1/medical-questions", patient, {
        ...validQuestion(),
        title: "A completely different title here",
        category: "skin",
        idempotencyKey,
      });
      expect(replay.status).toBe(200);
      expect(replay.json.data.id).toBe(first);
      expect(await db.MedicalQuestionModel.countDocuments({ authorId: patient._id })).toBe(1);
      const after = await questionDoc(first);
      expect(after!.title).toBe(original!.title);
      expect(after!.category).toBe("physiotherapy");
    });

    test("the same idempotency key used by two different users creates two independent questions", async () => {
      const idempotencyKey = randomUUID();
      const a = await ask(await makePatient(), { idempotencyKey });
      const b = await ask(await makePatient(), { idempotencyKey });
      expect(a).not.toBe(b);
      expect(await db.MedicalQuestionModel.countDocuments({ idempotencyKey })).toBe(2);
    });
  });

  // ===========================================================================
  describe("B. Question lifecycle: visible ⇄ hidden, → deleted", () => {
    type QState = "visible" | "hidden" | "deleted";

    /** A question with one provider answer, driven into the requested state through the real API. */
    async function questionIn(state: QState) {
      const owner = await makePatient();
      const id = await ask(owner);
      const doctor = await makeDoctor();
      expect((await reply(id, doctor)).status).toBe(200);
      if (state === "hidden") {
        expect((await moderate(await makeAdmin(), await reportId(id, "question", id), "hide")).status).toBe(200);
      }
      if (state === "deleted") expect((await del(id, owner)).status).toBe(200);
      return { id, owner, doctor };
    }

    test.each<[QState, number, boolean]>([
      ["visible", 200, true],
      ["hidden", 404, false],
      ["deleted", 404, false],
    ])("in state %s: every read and write action behaves consistently", async (state, expected, listed) => {
      const { id, owner, doctor } = await questionIn(state);
      const otherDoctor = await makeDoctor();
      const before = await questionDoc(id);

      expect((await getQ(id)).status).toBe(expected);
      expect((await getQ(id, owner)).status).toBe(expected);
      expect((await reply(id, otherDoctor)).status).toBe(expected);
      expect((await reply(id, owner, { body: "Update: still hurts at night." })).status).toBe(expected);
      expect((await report(id, await makePatient(), "question", id)).status).toBe(expected);
      expect((await upload(id, owner)).status).toBe(expected);
      expect((await listedIds("")).includes(id)).toBe(listed);
      expect((await listedIds("filter=mine", owner)).includes(id)).toBe(listed);

      if (state !== "visible") {
        // Rejected actions left the stored question untouched.
        const after = await questionDoc(id);
        expect(after!.answerCount).toBe(before!.answerCount);
        expect(after!.attachmentCount).toBe(before!.attachmentCount);
        expect(await db.MedicalAnswerModel.countDocuments({ questionId: id })).toBe(1);
        expect(scheduleAnswerNotification).toHaveBeenCalledTimes(1); // only the setup answer
      }
      void doctor;
      await expectQuestionInvariants(id);
    });

    test("visible → deleted by the author: soft delete, photos become unreachable, realtime update published", async () => {
      const owner = await makePatient();
      const id = await ask(owner);
      const photo = await upload(id, owner);
      expect(photo.status).toBe(200);
      const doctor = await makeDoctor();
      expect(await readPhoto(id, photo.json.data.id, doctor)).toBe(200);
      publishSpy.mockClear();

      expect((await del(id, owner)).status).toBe(200);
      const q = await questionDoc(id);
      expect(q!.deletedAt).toBeInstanceOf(Date);
      expect(await db.MedicalQuestionModel.exists({ _id: id })).toBeTruthy(); // soft, not hard
      const att = await db.MedicalQuestionAttachmentModel.findById(photo.json.data.id).lean();
      expect(att!.deletedAt).toBeInstanceOf(Date);
      expect(await readPhoto(id, photo.json.data.id, owner)).toBe(404);
      expect(await readPhoto(id, photo.json.data.id, doctor)).toBe(404);
      await new Promise((r) => setImmediate(r));
      expect(publishSpy).toHaveBeenCalledWith({ type: "question_updated", questionId: id });
    });

    test("deleted is terminal: a second delete is 404 and the original timestamp is kept", async () => {
      const owner = await makePatient();
      const id = await ask(owner);
      expect((await del(id, owner)).status).toBe(200);
      const firstDeletedAt = (await questionDoc(id))!.deletedAt;
      expect((await del(id, owner)).status).toBe(404);
      expect((await del(id, await makeAdmin())).status).toBe(404);
      expect((await questionDoc(id))!.deletedAt).toEqual(firstDeletedAt);
    });

    test("delete permissions: stranger, verified provider and anonymous are refused without changing state; admin may delete", async () => {
      const owner = await makePatient();
      const id = await ask(owner);
      for (const actor of [await makePatient(), await makeDoctor()]) {
        expect((await del(id, actor)).status).toBe(403);
      }
      expect((await del(id, null)).status).toBe(401);
      expect((await questionDoc(id))!.deletedAt).toBeUndefined();
      expect((await del(id, await makeAdmin())).status).toBe(200);
      expect((await questionDoc(id))!.deletedAt).toBeInstanceOf(Date);
    });

    test("hidden → deleted: the author can still delete a question an admin has hidden", async () => {
      const { id, owner } = await questionIn("hidden");
      expect((await del(id, owner)).status).toBe(200);
      expect((await questionDoc(id))!).toMatchObject({ moderationStatus: "hidden" });
      expect((await questionDoc(id))!.deletedAt).toBeInstanceOf(Date);
    });

    test("moderation restore never resurrects a deleted question", async () => {
      const owner = await makePatient();
      const id = await ask(owner);
      const admin = await makeAdmin();
      const rid = await reportId(id, "question", id);
      expect((await moderate(admin, rid, "hide")).status).toBe(200);
      expect((await del(id, owner)).status).toBe(200);
      expect((await moderate(admin, rid, "restore")).status).toBe(200);

      const q = await questionDoc(id);
      expect(q!.moderationStatus).toBe("visible");
      expect(q!.deletedAt).toBeInstanceOf(Date);
      expect((await getQ(id)).status).toBe(404);
      expect(await listedIds("")).not.toContain(id);
    });

    test("visible → hidden → visible, with repeated hide/restore being no-ops", async () => {
      const owner = await makePatient();
      const id = await ask(owner);
      const admin = await makeAdmin();
      const rid = await reportId(id, "question", id);

      expect((await moderate(admin, rid, "restore")).status).toBe(200); // visible → visible: no-op
      expect((await questionDoc(id))!.moderationStatus).toBe("visible");

      expect((await moderate(admin, rid, "hide")).status).toBe(200);
      expect((await questionDoc(id))!.moderationStatus).toBe("hidden");
      expect((await moderate(admin, rid, "hide")).status).toBe(200); // hidden → hidden: no-op
      expect((await questionDoc(id))!.moderationStatus).toBe("hidden");
      expect((await getQ(id, owner)).status).toBe(404);

      expect((await moderate(admin, rid, "restore")).status).toBe(200);
      expect((await questionDoc(id))!.moderationStatus).toBe("visible");
      expect((await getQ(id)).status).toBe(200);
      expect(await listedIds("")).toContain(id);
    });

    test("concurrent deletes by the author end in one deleted question, never an error", async () => {
      const owner = await makePatient();
      const id = await ask(owner);
      const results = await Promise.all(Array.from({ length: 4 }, () => del(id, owner)));
      for (const r of results) expect([200, 404]).toContain(r.status);
      expect(results.some((r) => r.status === 200)).toBe(true);
      expect((await questionDoc(id))!.deletedAt).toBeInstanceOf(Date);
    });

    test("viewer capability flags match the server's real permissions for each kind of viewer", async () => {
      const owner = await makePatient();
      const id = await ask(owner);
      const cases: Array<[string, Actor, Record<string, boolean>]> = [
        ["anonymous", null, { isOwner: false, canAnswer: false, canFollowUp: false, canDelete: false, canReport: false }],
        ["author", owner, { isOwner: true, canAnswer: false, canFollowUp: true, canDelete: true, canReport: false }],
        ["other patient", await makePatient(), { isOwner: false, canAnswer: false, canFollowUp: false, canDelete: false, canReport: true }],
        ["verified doctor", await makeDoctor(), { isOwner: false, canAnswer: true, canFollowUp: false, canDelete: false, canReport: true }],
        ["pending doctor", await makeDoctor("pending"), { isOwner: false, canAnswer: false, canFollowUp: false, canDelete: false, canReport: true }],
        ["admin", await makeAdmin(), { isOwner: false, canAnswer: false, canFollowUp: false, canDelete: true, canReport: true }],
      ];
      for (const [label, actor, flags] of cases) {
        const r = await getQ(id, actor);
        expect({ label, ...r.json.data.viewer }).toMatchObject({ label, ...flags });
      }
      // And the server agrees with canAnswer: only the verified doctor's answer is accepted.
      expect((await reply(id, cases[3][1])).status).toBe(200);
      expect((await reply(id, cases[4][1])).status).toBe(403);
      expect((await reply(id, cases[5][1])).status).toBe(403);
      expect((await reply(id, cases[2][1])).status).toBe(403);
      await expectQuestionInvariants(id);
    });
  });

  // ===========================================================================
  describe("C. Answers and follow-ups", () => {
    test("a verified provider's answer: linked to the question, counted, notification scheduled once", async () => {
      const owner = await makePatient();
      const id = await ask(owner);
      const before = (await questionDoc(id))!.lastActivityAt!;
      const doctor = await makeDoctor();

      const r = await reply(id, doctor);
      expect(r.status).toBe(200);
      const a = await db.MedicalAnswerModel.findById(r.json.data.id).lean();
      expect(a).toMatchObject({ kind: "answer", authorRole: "doctor", moderationStatus: "visible" });
      expect(String(a!.questionId)).toBe(id);
      const q = await questionDoc(id);
      expect(q!.answerCount).toBe(1);
      expect(q!.lastActivityAt!.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(scheduleAnswerNotification).toHaveBeenCalledTimes(1);
      expect(scheduleAnswerNotification).toHaveBeenCalledWith(r.json.data.id);
      expect(await listedIds("filter=unanswered")).not.toContain(id);
      await expectQuestionInvariants(id);
    });

    test("the author's follow-up: stored as follow_up/patient, not counted, no notification, stays 'unanswered'", async () => {
      const owner = await makePatient();
      const id = await ask(owner);
      const r = await reply(id, owner, { body: "Update: the pain now goes down my left leg." });
      expect(r.status).toBe(200);
      expect(await db.MedicalAnswerModel.findById(r.json.data.id).lean()).toMatchObject({
        kind: "follow_up",
        authorRole: "patient",
      });
      expect((await questionDoc(id))!.answerCount).toBe(0);
      expect(scheduleAnswerNotification).not.toHaveBeenCalled();
      expect(await listedIds("filter=unanswered")).toContain(id);
      await expectQuestionInvariants(id);
    });

    test.each([
      ["empty body", { body: "" }],
      ["1 character", { body: "a" }],
      ["whitespace only", { body: "     " }],
      ["over 3000 characters", { body: "x".repeat(3001) }],
      ["client-set kind", { body: "Rest well.", kind: "answer" }],
      ["client-set authorRole", { body: "Rest well.", authorRole: "doctor" }],
      ["client-set questionId", { body: "Rest well.", questionId: "507f1f77bcf86cd799439011" }],
      ["client-set moderationStatus", { body: "Rest well.", moderationStatus: "visible" }],
      ["non-string body", { body: { $ne: null } }],
    ])("rejects an answer with %s (400): nothing stored, count and notifications unchanged", async (_l, payload) => {
      const id = await ask(await makePatient());
      const doctor = await makeDoctor();
      const before = await counts();
      const r = await reply(id, doctor, payload);
      expect(r.status).toBe(400);
      expect(await counts()).toEqual(before);
      expect((await questionDoc(id))!.answerCount).toBe(0);
      expect(scheduleAnswerNotification).not.toHaveBeenCalled();
    });

    test("only verified providers answer and only the author follows up; refusals leave no trace", async () => {
      const owner = await makePatient();
      const id = await ask(owner);
      const before = await counts();
      for (const actor of [await makePatient(), await makeAdmin(), await makeDoctor("pending"), await makeUser([Roles.DOCTOR])]) {
        expect((await reply(id, actor)).status).toBe(403);
      }
      expect((await reply(id, null)).status).toBe(401);
      expect(await counts()).toEqual(before);
      expect(scheduleAnswerNotification).not.toHaveBeenCalled();
    });

    test("a provider whose approval is withdrawn can no longer answer; their earlier answer stays linked", async () => {
      const id = await ask(await makePatient());
      const doctor = await makeDoctor();
      expect((await reply(id, doctor)).status).toBe(200);
      await db.DoctorProfileModel.updateOne({ userId: doctor._id }, { $set: { verificationStatus: "restricted" } });
      expect((await reply(id, doctor, { body: "Second answer." })).status).toBe(403);
      expect((await questionDoc(id))!.answerCount).toBe(1);
      await expectQuestionInvariants(id);
    });

    test("answers cannot be edited or deleted: the answers route exposes POST only", () => {
      const exported = Object.keys(answersRoute).filter((k) => /^[A-Z]+$/.test(k));
      expect(exported).toEqual(["POST"]);
    });

    test("an idempotent answer replay is stored, counted and notified once", async () => {
      const id = await ask(await makePatient());
      const doctor = await makeDoctor();
      const idempotencyKey = randomUUID();
      const results = await Promise.all(Array.from({ length: 4 }, () => reply(id, doctor, { body: "Rest it.", idempotencyKey })));
      expect(results.every((r) => r.status === 200)).toBe(true);
      expect(new Set(results.map((r) => r.json.data.id)).size).toBe(1);
      expect(await db.MedicalAnswerModel.countDocuments({ questionId: id })).toBe(1);
      expect((await questionDoc(id))!.answerCount).toBe(1);
      expect(scheduleAnswerNotification).toHaveBeenCalledTimes(1);
      await expectQuestionInvariants(id);
    });

    test("an idempotency key already used on one question is refused (409) on another, with no side effects", async () => {
      const q1 = await ask(await makePatient());
      const q2 = await ask(await makePatient());
      const doctor = await makeDoctor();
      const idempotencyKey = randomUUID();
      expect((await reply(q1, doctor, { body: "Rest it.", idempotencyKey })).status).toBe(200);
      scheduleAnswerNotification.mockClear();

      const r = await reply(q2, doctor, { body: "Rest it.", idempotencyKey });
      expect(r.status).toBe(409);
      expect(await db.MedicalAnswerModel.countDocuments({ questionId: q2 })).toBe(0);
      expect((await questionDoc(q2))!.answerCount).toBe(0);
      expect(scheduleAnswerNotification).not.toHaveBeenCalled();
      await expectQuestionInvariants(q1);
      await expectQuestionInvariants(q2);
    });

    test("concurrent answers from several providers are all kept and counted exactly", async () => {
      const id = await ask(await makePatient());
      const doctors = await Promise.all(Array.from({ length: 6 }, () => makeDoctor()));
      const results = await Promise.all(doctors.map((d, i) => reply(id, d, { body: `Advice number ${i}` })));
      expect(results.every((r) => r.status === 200)).toBe(true);
      expect((await questionDoc(id))!.answerCount).toBe(6);
      expect(scheduleAnswerNotification).toHaveBeenCalledTimes(6);
      await expectQuestionInvariants(id);
    });
  });

  // ===========================================================================
  describe("D. Moderation of answers and report states: open → actioned | dismissed", () => {
    async function answeredQuestion() {
      const owner = await makePatient();
      const id = await ask(owner);
      const r = await reply(id, await makeDoctor());
      return { id, owner, answerId: r.json.data.id as string };
    }

    test("hide: answer hidden, count decremented, every open report on that answer actioned, others untouched", async () => {
      const { id, answerId } = await answeredQuestion();
      const r1 = await reportId(id, "answer", answerId);
      const r2 = await reportId(id, "answer", answerId);
      const unrelated = await reportId(id, "question", id);
      const admin = await makeAdmin();

      expect((await moderate(admin, r1, "hide")).status).toBe(200);
      expect((await db.MedicalAnswerModel.findById(answerId).lean())!.moderationStatus).toBe("hidden");
      expect((await questionDoc(id))!.answerCount).toBe(0);
      for (const rid of [r1, r2]) {
        const row = await db.MedicalQaReportModel.findById(rid).lean();
        expect(row).toMatchObject({ status: "actioned" });
        expect(String(row!.resolvedBy)).toBe(String(admin._id));
        expect(row!.resolvedAt).toBeInstanceOf(Date);
      }
      expect((await db.MedicalQaReportModel.findById(unrelated).lean())!.status).toBe("open");
      expect((await getQ(id)).json.data.answers).toHaveLength(0);
      expect(await listedIds("filter=unanswered")).toContain(id);
      await expectQuestionInvariants(id);
    });

    test("repeated hide/restore never double-counts; restore puts the answer back exactly once", async () => {
      const { id, answerId } = await answeredQuestion();
      const rid = await reportId(id, "answer", answerId);
      const admin = await makeAdmin();

      expect((await reply(id, await makeDoctor(), { body: "Also try gentle stretching." })).status).toBe(200);

      await moderate(admin, rid, "hide");
      await moderate(admin, rid, "hide");
      expect((await questionDoc(id))!.answerCount).toBe(1);
      await expectQuestionInvariants(id);

      await moderate(admin, rid, "restore");
      await moderate(admin, rid, "restore");
      expect((await questionDoc(id))!.answerCount).toBe(2);
      expect((await getQ(id)).json.data.answers).toHaveLength(2);
      expect(await listedIds("filter=unanswered")).not.toContain(id);
      await expectQuestionInvariants(id);
    });

    test("concurrent hides of the same answer decrement the count once", async () => {
      const { id, answerId } = await answeredQuestion();
      // A second answer, so a double decrement shows as 0 instead of hiding behind the >= 0 floor.
      expect((await reply(id, await makeDoctor(), { body: "Also try gentle stretching." })).status).toBe(200);
      const admin = await makeAdmin();
      const rids = [await reportId(id, "answer", answerId), await reportId(id, "answer", answerId)];
      const results = await Promise.all([...rids, ...rids].map((rid) => moderate(admin, rid, "hide")));
      expect(results.every((r) => r.status === 200)).toBe(true);
      expect((await questionDoc(id))!.answerCount).toBe(1);
      await expectQuestionInvariants(id);
    });

    test("hiding a follow-up leaves the answer count alone", async () => {
      const { id, owner } = await answeredQuestion();
      const fu = await reply(id, owner, { body: "Update: better after rest." });
      const rid = await reportId(id, "answer", fu.json.data.id);
      await moderate(await makeAdmin(), rid, "hide");
      expect((await questionDoc(id))!.answerCount).toBe(1);
      await expectQuestionInvariants(id);
    });

    test("dismiss: report dismissed, content and count unchanged", async () => {
      const { id, answerId } = await answeredQuestion();
      const rid = await reportId(id, "answer", answerId);
      expect((await moderate(await makeAdmin(), rid, "dismiss")).status).toBe(200);
      expect((await db.MedicalQaReportModel.findById(rid).lean())!.status).toBe("dismissed");
      expect((await db.MedicalAnswerModel.findById(answerId).lean())!.moderationStatus).toBe("visible");
      expect((await questionDoc(id))!.answerCount).toBe(1);
      await expectQuestionInvariants(id);
    });

    test("the count never goes negative even if it was already out of step", async () => {
      const { id, answerId } = await answeredQuestion();
      await db.MedicalQuestionModel.updateOne({ _id: id }, { $set: { answerCount: 0 } });
      await moderate(await makeAdmin(), await reportId(id, "answer", answerId), "hide");
      expect((await questionDoc(id))!.answerCount).toBe(0);
    });

    test("every moderation action is audited, and unknown/malformed report ids are rejected without changes", async () => {
      const { id, answerId } = await answeredQuestion();
      const rid = await reportId(id, "answer", answerId);
      const admin = await makeAdmin();
      for (const action of ["hide", "restore", "dismiss"] as const) {
        expect((await moderate(admin, rid, action)).status).toBe(200);
      }
      expect(await db.AuditLogModel.countDocuments({ entityId: answerId, action: /^medical_qa\./ })).toBe(3);

      expect((await moderate(admin, "507f1f77bcf86cd799439011", "hide")).status).toBe(404);
      expect((await moderate(admin, "not-an-id", "hide")).status).toBe(400);
      const bad = await call(adminReportsRoute.PATCH, "PATCH", "/api/v1/admin/medical-questions/reports", admin, {
        reportId: rid,
        action: "delete",
      });
      expect(bad.status).toBe(400);
      expect((await db.MedicalAnswerModel.findById(answerId).lean())!.moderationStatus).toBe("visible");
    });

    test("non-admins cannot drive any moderation transition", async () => {
      const { id, answerId } = await answeredQuestion();
      const rid = await reportId(id, "answer", answerId);
      for (const actor of [await makePatient(), await makeDoctor()]) {
        expect((await moderate(actor, rid, "hide")).status).toBe(403);
      }
      expect((await moderate(null, rid, "hide")).status).toBe(401);
      expect((await db.MedicalQaReportModel.findById(rid).lean())!.status).toBe("open");
      expect((await db.MedicalAnswerModel.findById(answerId).lean())!.moderationStatus).toBe("visible");
    });
  });

  // ===========================================================================
  describe("E. Notifications driven by state", () => {
    test("end to end: an answer notifies only the question's author, exactly once, and never for the follow-up", async () => {
      const owner = await makePatient();
      const bystander = await makePatient();
      const id = await ask(owner);
      const doctor = await makeDoctor();
      const idempotencyKey = randomUUID();

      const ans = await reply(id, doctor, { body: "Rest it.", idempotencyKey });
      await reply(id, doctor, { body: "Rest it.", idempotencyKey }); // replay
      await reply(id, owner, { body: "Thanks, will do." }); // follow-up
      expect(scheduleAnswerNotification.mock.calls).toEqual([[ans.json.data.id]]);

      // Run the real notifier for what was scheduled, twice (retry), with push mocked.
      for (const [answerId] of scheduleAnswerNotification.mock.calls) {
        await notifyQuestionAnswered(answerId as string);
        await notifyQuestionAnswered(answerId as string);
      }
      const forOwner = await db.NotificationModel.find({ userId: owner._id, "payload.type": "medical_question_answered" }).lean();
      expect(forOwner).toHaveLength(1);
      expect(forOwner[0].payload).toMatchObject({ questionId: id, answerId: ans.json.data.id });
      for (const other of [bystander, doctor]) {
        expect(await db.NotificationModel.countDocuments({ userId: other._id, "payload.type": "medical_question_answered" })).toBe(0);
      }
    });

    test("an answer hidden before the notifier runs produces no notification", async () => {
      const owner = await makePatient();
      const id = await ask(owner);
      const ans = await reply(id, await makeDoctor());
      await moderate(await makeAdmin(), await reportId(id, "answer", ans.json.data.id), "hide");
      expect(await notifyQuestionAnswered(ans.json.data.id)).toEqual({ notified: false, reason: "answer_unavailable" });
      expect(await db.NotificationModel.countDocuments({ userId: owner._id })).toBe(0);
    });

    test("push provider failures never change the stored question or answer", async () => {
      sendExpoPush.mockRejectedValue(new Error("expo down"));
      sendWebPush.mockRejectedValue(new Error("web push down"));
      const owner = await makePatient();
      const id = await ask(owner);
      const ans = await reply(id, await makeDoctor());
      const result = await notifyQuestionAnswered(ans.json.data.id, { now: DAYTIME });
      expect(result).toMatchObject({ notified: true, push: "failed" });
      expect(await db.MedicalAnswerModel.findById(ans.json.data.id).lean()).toMatchObject({ moderationStatus: "visible" });
      expect((await questionDoc(id))!.answerCount).toBe(1);
      await expectQuestionInvariants(id);
    });

    test("alert state: pending → done, after which re-processing is a no-op", async () => {
      const id = await ask(await makePatient(), { category: "nursing-care" });
      expect((await questionDoc(id))!.alertStatus).toBe("pending");
      const first = await MedicalQaAlerts.processQuestion(id);
      expect(first).toMatchObject({ processed: true, status: "done" });
      const q = await questionDoc(id);
      expect(q).toMatchObject({ alertStatus: "done", alertAttempts: 1 });
      expect(q!.alertLeaseUntil).toBeNull();
      expect(await MedicalQaAlerts.processQuestion(id)).toEqual({ processed: false });
      expect((await questionDoc(id))!.alertAttempts).toBe(1);
    });

    test("alert state: a question hidden or deleted while pending is never processed", async () => {
      const hiddenId = await ask(await makePatient());
      await moderate(await makeAdmin(), await reportId(hiddenId, "question", hiddenId), "hide");
      const owner = await makePatient();
      const deletedId = await ask(owner);
      await del(deletedId, owner);
      for (const id of [hiddenId, deletedId]) {
        expect(await MedicalQaAlerts.processQuestion(id)).toEqual({ processed: false });
        expect((await questionDoc(id))!.alertStatus).toBe("pending");
        expect(await db.MedicalQaAlertModel.countDocuments({ questionId: id })).toBe(0);
      }
    });
  });

  // ===========================================================================
  describe("F. Failure recovery", () => {
    test("a failed question save returns 500, stores nothing and schedules no alerts", async () => {
      const patient = await makePatient();
      jest.spyOn(db.MedicalQuestionModel, "create").mockRejectedValueOnce(new Error("db down") as never);
      jest.spyOn(console, "error").mockImplementation(() => {});
      const before = await counts();
      const r = await call(questionsRoute.POST, "POST", "/api/v1/medical-questions", patient, validQuestion());
      expect(r.status).toBe(500);
      expect(JSON.stringify(r.json)).not.toMatch(/db down|stack/i);
      expect(await counts()).toEqual(before);
      expect(scheduleQuestionAlerts).not.toHaveBeenCalled();
    });

    test("a failed answer insert returns 500 and leaves the question untouched", async () => {
      const id = await ask(await makePatient());
      jest.spyOn(db.MedicalAnswerModel, "create").mockRejectedValueOnce(new Error("db down") as never);
      jest.spyOn(console, "error").mockImplementation(() => {});
      const r = await reply(id, await makeDoctor());
      expect(r.status).toBe(500);
      expect(await db.MedicalAnswerModel.countDocuments({ questionId: id })).toBe(0);
      expect((await questionDoc(id))!.answerCount).toBe(0);
      expect(scheduleAnswerNotification).not.toHaveBeenCalled();
    });

    test("delete interrupted after the question write: photos are still unreachable through the API", async () => {
      const owner = await makePatient();
      const id = await ask(owner);
      const photo = await upload(id, owner);
      expect(photo.status).toBe(200);
      jest.spyOn(db.MedicalQuestionAttachmentModel, "updateMany").mockRejectedValueOnce(new Error("db blip") as never);
      jest.spyOn(console, "error").mockImplementation(() => {});

      expect((await del(id, owner)).status).toBe(500);
      expect((await questionDoc(id))!.deletedAt).toBeInstanceOf(Date);
      expect(await readPhoto(id, photo.json.data.id, owner)).toBe(404);
      expect((await getQ(id)).status).toBe(404);
    });

    // Regression: the answer insert and the count write are separate. A failed count
    // write used to return 500 for a saved answer, and a retry never counted it or
    // notified the patient. The count is now recounted from the answers themselves.
    test("answer saved but count write failed: still a success, patient notified once, a retry heals the count", async () => {
      const id = await ask(await makePatient());
      const doctor = await makeDoctor();
      const idempotencyKey = randomUUID();
      jest.spyOn(db.MedicalQuestionModel, "updateOne").mockRejectedValueOnce(new Error("db blip") as never);
      const logged = jest.spyOn(console, "error").mockImplementation(() => {});

      const first = await reply(id, doctor, { body: "Rest it.", idempotencyKey });
      expect(first.status).toBe(200);
      expect(logged).toHaveBeenCalled();
      expect(scheduleAnswerNotification.mock.calls).toEqual([[first.json.data.id]]);
      expect((await questionDoc(id))!.answerCount).toBe(0); // the failed write left it behind

      const retry = await reply(id, doctor, { body: "Rest it.", idempotencyKey });
      expect(retry.status).toBe(200);
      expect(retry.json.data.id).toBe(first.json.data.id);
      await expectQuestionInvariants(id);
      expect(scheduleAnswerNotification).toHaveBeenCalledTimes(1); // the retry doesn't notify again
    });

    test("a count left behind by a failed write is healed by the next provider's answer", async () => {
      const id = await ask(await makePatient());
      jest.spyOn(db.MedicalQuestionModel, "updateOne").mockRejectedValueOnce(new Error("db blip") as never);
      jest.spyOn(console, "error").mockImplementation(() => {});
      expect((await reply(id, await makeDoctor())).status).toBe(200);
      expect((await questionDoc(id))!.answerCount).toBe(0);

      expect((await reply(id, await makeDoctor(), { body: "Second opinion: rest it." })).status).toBe(200);
      expect((await questionDoc(id))!.answerCount).toBe(2);
      await expectQuestionInvariants(id);
    });

    test("moderation recounts, correcting a count that had drifted in either direction", async () => {
      const id = await ask(await makePatient());
      const a1 = await reply(id, await makeDoctor());
      await reply(id, await makeDoctor(), { body: "Second opinion: rest it." });
      const admin = await makeAdmin();
      const rid = await reportId(id, "answer", a1.json.data.id);

      await db.MedicalQuestionModel.updateOne({ _id: id }, { $set: { answerCount: 9 } });
      await moderate(admin, rid, "hide");
      expect((await questionDoc(id))!.answerCount).toBe(1);

      await db.MedicalQuestionModel.updateOne({ _id: id }, { $set: { answerCount: 0 } });
      await moderate(admin, rid, "restore");
      expect((await questionDoc(id))!.answerCount).toBe(2);
      await expectQuestionInvariants(id);
    });
  });

  // ===========================================================================
  describe("G. Fixes for issues found by these tests", () => {
    // Earlier groups leave answers whose (mocked) notifier never ran; the catch-up sweep
    // would pick those up too, so each test here starts from a clean answer collection.
    beforeEach(async () => {
      await db.MedicalAnswerModel.deleteMany({});
    });

    async function answeredQuestion() {
      const owner = await makePatient();
      const id = await ask(owner);
      const r = await reply(id, await makeDoctor());
      return { id, owner, answerId: r.json.data.id as string };
    }
    const MINUTE = 60 * 1000;
    const later = (ms = 2 * MINUTE) => new Date(Date.now() + ms);
    const answeredNotifications = (userId: import("mongoose").Types.ObjectId) =>
      db.NotificationModel.countDocuments({ userId, "payload.type": "medical_question_answered" });

    // -------- Admin hide-answer: status flip and recount are two writes
    test("hide-answer interrupted after the flip: retrying the hide repairs the count and resolves the report", async () => {
      const { id, answerId } = await answeredQuestion();
      await reply(id, await makeDoctor(), { body: "Second opinion: rest it." });
      const rid = await reportId(id, "answer", answerId);
      const admin = await makeAdmin();
      jest.spyOn(db.MedicalQuestionModel, "updateOne").mockRejectedValueOnce(new Error("db blip") as never);
      jest.spyOn(console, "error").mockImplementation(() => {});

      expect((await moderate(admin, rid, "hide")).status).toBe(500);
      expect((await db.MedicalAnswerModel.findById(answerId).lean())!.moderationStatus).toBe("hidden");
      expect((await questionDoc(id))!.answerCount).toBe(2); // stale: the recount never ran
      expect((await db.MedicalQaReportModel.findById(rid).lean())!.status).toBe("open");

      expect((await moderate(admin, rid, "hide")).status).toBe(200);
      expect((await questionDoc(id))!.answerCount).toBe(1);
      expect((await db.MedicalQaReportModel.findById(rid).lean())!.status).toBe("actioned");
      await expectQuestionInvariants(id);
    });

    test("concurrent hide and restore requests on two answers always leave the count matching what is visible", async () => {
      const { id, answerId } = await answeredQuestion();
      const second = await reply(id, await makeDoctor(), { body: "Second opinion: rest it." });
      const admin = await makeAdmin();
      const r1 = await reportId(id, "answer", answerId);
      const r2 = await reportId(id, "answer", second.json.data.id);
      for (let round = 0; round < 3; round++) {
        const results = await Promise.all([
          moderate(admin, r1, "hide"),
          moderate(admin, r2, "hide"),
          moderate(admin, r1, "restore"),
          moderate(admin, r2, "hide"),
        ]);
        expect(results.every((r) => r.status === 200)).toBe(true);
        // Whatever order they landed in, a final recount pass makes the count exact.
        await moderate(admin, r2, "restore");
        await expectQuestionInvariants(id);
      }
    });

    // -------- Patient notifications: catch-up sweep, no duplicates
    test("a notification lost to a transient error is delivered by the catch-up sweep, exactly once", async () => {
      const { owner, answerId } = await answeredQuestion();
      sendExpoPush.mockResolvedValue({ sent: 1, failed: 0 });
      jest.spyOn(db.NotificationModel, "create").mockRejectedValueOnce(new Error("db blip") as never);
      await expect(notifyQuestionAnswered(answerId)).rejects.toThrow("db blip");
      expect(await answeredNotifications(owner._id)).toBe(0);

      expect(await sweepMissedAnswerNotifications({ now: later() })).toBe(1);
      expect(await sweepMissedAnswerNotifications({ now: later() })).toBe(0);
      expect(await answeredNotifications(owner._id)).toBe(1);
      expect(sendExpoPush).toHaveBeenCalledTimes(pushesExpected(1, later()));
    });

    test("the sweep leaves answers inside the grace period to their own in-flight run", async () => {
      const { owner } = await answeredQuestion();
      expect(await sweepMissedAnswerNotifications({ now: new Date() })).toBe(0);
      expect(await answeredNotifications(owner._id)).toBe(0);
    });

    test("concurrent sweeps racing the original run produce one notification and one push", async () => {
      const { owner, answerId } = await answeredQuestion();
      sendExpoPush.mockResolvedValue({ sent: 1, failed: 0 });
      await Promise.all([
        notifyQuestionAnswered(answerId, { now: later() }),
        sweepMissedAnswerNotifications({ now: later() }),
        sweepMissedAnswerNotifications({ now: later() }),
        sweepMissedAnswerNotifications({ now: later() }),
      ]);
      expect(await answeredNotifications(owner._id)).toBe(1);
      expect(sendExpoPush).toHaveBeenCalledTimes(pushesExpected(1, later()));
    });

    test("answers meant to get no notification never crowd a real miss out of the sweep", async () => {
      // 25 answers that must not notify: on a deleted question, and on a doctor's own question.
      const deletedOwner = await makePatient();
      const deletedQ = await ask(deletedOwner);
      const doctor = await makeDoctor();
      const ownQ = await ask(doctor);
      await del(deletedQ, deletedOwner);
      const filler = Array.from({ length: 25 }, (_, i) => ({
        questionId: i % 2 ? deletedQ : ownQ,
        authorId: doctor._id,
        authorRole: "doctor",
        kind: "answer",
        body: `Filler answer ${i}`,
      }));
      const { owner } = await answeredQuestion(); // the real miss (its notifier never ran)
      await db.MedicalAnswerModel.insertMany(filler); // newer than the real miss

      expect(await sweepMissedAnswerNotifications({ now: later() })).toBeGreaterThanOrEqual(1);
      expect(await answeredNotifications(owner._id)).toBe(1);
      expect(await answeredNotifications(deletedOwner._id)).toBe(0);
      expect(await answeredNotifications(doctor._id)).toBe(0);
    });

    // -------- Restored questions get the alerts they missed while hidden
    test("a question hidden before its alerts ran is alerted once on restore", async () => {
      const id = await ask(await makePatient(), { category: "nursing-care" });
      const nurse = await makeUser([Roles.NURSE]);
      await db.StaffProfileModel.create({ userId: nurse._id, staffType: "nurse", verificationStatus: "approved", isAvailable: true });
      const admin = await makeAdmin();
      const rid = await reportId(id, "question", id);
      await moderate(admin, rid, "hide");
      expect(await MedicalQaAlerts.processQuestion(id)).toEqual({ processed: false }); // hidden: skipped
      scheduleQuestionAlerts.mockClear();

      expect((await moderate(admin, rid, "restore")).status).toBe(200);
      expect(scheduleQuestionAlerts.mock.calls).toEqual([[id, { maxAgeMs: 24 * 60 * 60 * 1000 }]]);
      // Run what was scheduled, twice (as a retry would): one alert for the nurse.
      await MedicalQaAlerts.processQuestion(id);
      await MedicalQaAlerts.processQuestion(id);
      expect((await questionDoc(id))!.alertStatus).toBe("done");
      expect(await db.MedicalQaAlertModel.countDocuments({ questionId: id, recipientId: nurse._id })).toBe(1);
    });

    test("restoring a question that was already alerted sends nothing new", async () => {
      const id = await ask(await makePatient(), { category: "nursing-care" });
      await MedicalQaAlerts.processQuestion(id);
      const alertsBefore = await db.MedicalQaAlertModel.countDocuments({ questionId: id });
      const admin = await makeAdmin();
      const rid = await reportId(id, "question", id);
      await moderate(admin, rid, "hide");
      await moderate(admin, rid, "restore");
      expect(await MedicalQaAlerts.processQuestion(id)).toEqual({ processed: false });
      expect(await db.MedicalQaAlertModel.countDocuments({ questionId: id })).toBe(alertsBefore);
    });

    test("the moderation response never leaks the internal restore field", async () => {
      const id = await ask(await makePatient());
      const admin = await makeAdmin();
      const rid = await reportId(id, "question", id);
      await moderate(admin, rid, "hide");
      expect((await moderate(admin, rid, "restore")).json.data).toEqual({ ok: true });
    });

    // -------- Reporting rules
    test("an author cannot report their own question (403, nothing stored) but can report answers on it", async () => {
      const { id, owner, answerId } = await answeredQuestion();
      const own = await report(id, owner, "question", id);
      expect(own.status).toBe(403);
      expect(await db.MedicalQaReportModel.countDocuments({ targetId: id })).toBe(0);
      expect((await report(id, owner, "answer", answerId)).status).toBe(200);
      expect((await report(id, await makePatient(), "question", id)).status).toBe(200);
    });

    test("a hidden answer cannot be reported (404, nothing stored); once restored it can", async () => {
      const { id, answerId } = await answeredQuestion();
      const admin = await makeAdmin();
      const rid = await reportId(id, "answer", answerId);
      await moderate(admin, rid, "hide");
      const reporter = await makePatient();
      const before = await db.MedicalQaReportModel.countDocuments({ targetId: answerId });
      expect((await report(id, reporter, "answer", answerId)).status).toBe(404);
      expect(await db.MedicalQaReportModel.countDocuments({ targetId: answerId })).toBe(before);

      await moderate(admin, rid, "restore");
      expect((await report(id, reporter, "answer", answerId)).status).toBe(200);
    });

    // -------- Photos follow the question's visibility
    test("photos of a hidden question: 404 for its author and providers, readable by admins; restored → back to normal", async () => {
      const owner = await makePatient();
      const id = await ask(owner);
      const photo = await upload(id, owner);
      expect(photo.status).toBe(200);
      const pid = photo.json.data.id as string;
      const doctor = await makeDoctor();
      const admin = await makeAdmin();
      const rid = await reportId(id, "question", id);

      await moderate(admin, rid, "hide");
      expect(await readPhoto(id, pid, owner)).toBe(404);
      expect(await readPhoto(id, pid, doctor)).toBe(404);
      expect(await readPhoto(id, pid, await makePatient())).toBe(404);
      expect(await readPhoto(id, pid, admin)).toBe(200);

      await moderate(admin, rid, "restore");
      expect(await readPhoto(id, pid, owner)).toBe(200);
      expect(await readPhoto(id, pid, doctor)).toBe(200);
      expect(await readPhoto(id, pid, await makePatient())).toBe(403);
    });
  });

  // ===========================================================================
  describe("H. Round 3: photo privacy, restore freshness, count races, scheduled recovery", () => {
    const MINUTE = 60 * 1000;
    const HOUR = 60 * MINUTE;
    let recoveryRoute: typeof import("@/app/api/internal/medical-qa/notification-recovery/route");

    beforeAll(async () => {
      recoveryRoute = await import("@/app/api/internal/medical-qa/notification-recovery/route");
    });

    // Earlier groups leave answers whose (mocked) notifier never ran; start each test clean.
    beforeEach(async () => {
      await db.MedicalAnswerModel.deleteMany({});
    });

    async function answeredQuestion() {
      const owner = await makePatient();
      const id = await ask(owner);
      const r = await reply(id, await makeDoctor());
      return { id, owner, answerId: r.json.data.id as string };
    }
    const answeredNotifications = (userId: import("mongoose").Types.ObjectId) =>
      db.NotificationModel.countDocuments({ userId, "payload.type": "medical_question_answered" });

    /** A provider answer whose notifier never ran, created `ageMs` ago (outside the sweep's grace period). */
    async function missedAnswer(questionId: string, doctor: { _id: import("mongoose").Types.ObjectId }, ageMs = 5 * MINUTE) {
      // Timestamp prefix (what the sweep's window reads) + random tail, so ids in the same second differ.
      const seconds = Math.floor((Date.now() - ageMs) / 1000).toString(16).padStart(8, "0");
      const _id = new mongooseMod.Types.ObjectId(seconds + randomBytes(8).toString("hex"));
      await db.MedicalAnswerModel.create({
        _id,
        questionId,
        authorId: doctor._id,
        authorRole: "doctor",
        kind: "answer",
        body: "Rest and gentle stretching.",
      });
      return String(_id);
    }

    /** Backdates a question (Mongoose treats createdAt as immutable, so write to the collection). */
    const backdate = (id: string, ageMs: number) =>
      db.MedicalQuestionModel.collection.updateOne(
        { _id: new mongooseMod.Types.ObjectId(id) },
        { $set: { createdAt: new Date(Date.now() - ageMs) } },
      );

    async function runRecovery(headers: Record<string, string> = { authorization: "Bearer test-cron-secret" }) {
      const req = new Request("http://localhost/api/internal/medical-qa/notification-recovery", { method: "GET", headers });
      const res = await recoveryRoute.GET(req as never);
      return { status: res.status, json: await res.json() };
    }

    async function withNurse() {
      const nurse = await makeUser([Roles.NURSE]);
      await db.StaffProfileModel.create({ userId: nurse._id, staffType: "nurse", verificationStatus: "approved", isAvailable: true });
      return nurse;
    }

    // ------------------------------------------------------------------ 1. photos
    describe("1. Photo access follows question visibility", () => {
      async function questionWithPhoto() {
        const owner = await makePatient();
        const id = await ask(owner);
        const photo = await upload(id, owner);
        expect(photo.status).toBe(200);
        return { id, owner, pid: photo.json.data.id as string };
      }

      test("visible → hidden → restored, for author, provider, other patient and admin", async () => {
        const { id, owner, pid } = await questionWithPhoto();
        const doctor = await makeDoctor();
        const stranger = await makePatient();
        const admin = await makeAdmin();
        const rid = await reportId(id, "question", id);
        const access = async () => [owner, doctor, stranger, admin].map(async (u) => readPhoto(id, pid, u));

        expect(await Promise.all(await access())).toEqual([200, 200, 403, 200]);
        await moderate(admin, rid, "hide");
        expect(await Promise.all(await access())).toEqual([404, 404, 404, 200]);
        // The question's own detail is 404 too, so no photo URLs leak through it.
        expect((await getQ(id, owner)).status).toBe(404);
        await moderate(admin, rid, "restore");
        expect(await Promise.all(await access())).toEqual([200, 200, 403, 200]);
      });

      test("hiding keeps the photo (record and stored object); nothing is deleted", async () => {
        const { id, pid } = await questionWithPhoto();
        const att = await db.MedicalQuestionAttachmentModel.findById(pid).lean();
        await moderate(await makeAdmin(), await reportId(id, "question", id), "hide");
        const after = await db.MedicalQuestionAttachmentModel.findById(pid).lean();
        expect(after!.deletedAt).toBeUndefined();
        expect(objectStorageDouble.store.has(`medical-qa-attachments/${att!.storageKey}`)).toBe(true);
      });

      test("deleted (visible or hidden): nobody, admins included, can read the photo", async () => {
        for (const hideFirst of [false, true]) {
          const { id, owner, pid } = await questionWithPhoto();
          const admin = await makeAdmin();
          if (hideFirst) await moderate(admin, await reportId(id, "question", id), "hide");
          expect((await del(id, owner)).status).toBe(200);
          for (const u of [owner, await makeDoctor(), admin]) expect(await readPhoto(id, pid, u)).toBe(404);
        }
      });

      test("anonymous requests are refused in every state", async () => {
        const { id, pid } = await questionWithPhoto();
        expect(await readPhoto(id, pid, null)).toBe(401);
        await moderate(await makeAdmin(), await reportId(id, "question", id), "hide");
        expect(await readPhoto(id, pid, null)).toBe(401);
      });
    });

    // ------------------------------------------------------------------ 2. restore freshness
    describe("2. Alerts for restored questions respect the 24-hour freshness window", () => {
      const window = { maxAgeMs: 24 * HOUR };

      async function hiddenBeforeAlerts(ageMs: number) {
        const id = await ask(await makePatient(), { category: "nursing-care" });
        if (ageMs) await backdate(id, ageMs);
        const admin = await makeAdmin();
        const rid = await reportId(id, "question", id);
        await moderate(admin, rid, "hide");
        scheduleQuestionAlerts.mockClear();
        return { id, admin, rid };
      }

      test("restore schedules alerts with the 24h freshness limit (restoring is not a new question)", async () => {
        const { id, admin, rid } = await hiddenBeforeAlerts(0);
        const createdAt = (await questionDoc(id))!.createdAt;
        await moderate(admin, rid, "restore");
        expect(scheduleQuestionAlerts.mock.calls).toEqual([[id, window]]);
        expect((await questionDoc(id))!.createdAt).toEqual(createdAt); // unchanged
      });

      test("a recent question (23h old) is alerted on restore", async () => {
        const nurse = await withNurse();
        const { id, admin, rid } = await hiddenBeforeAlerts(23 * HOUR);
        await moderate(admin, rid, "restore");
        expect(await MedicalQaAlerts.processQuestion(id, window)).toMatchObject({ processed: true, status: "done" });
        expect(await db.MedicalQaAlertModel.countDocuments({ questionId: id, recipientId: nurse._id })).toBe(1);
      });

      test("a question older than 24h is not alerted on restore, and stays untouched", async () => {
        await withNurse();
        const { id, admin, rid } = await hiddenBeforeAlerts(25 * HOUR);
        await moderate(admin, rid, "restore");
        expect(await MedicalQaAlerts.processQuestion(id, window)).toEqual({ processed: false });
        expect(await db.MedicalQaAlertModel.countDocuments({ questionId: id })).toBe(0);
        expect((await questionDoc(id))!).toMatchObject({ alertStatus: "pending", alertAttempts: 0 });
        // Nor does the regular retry sweep pick it up.
        await MedicalQaAlerts.sweepPending();
        expect((await questionDoc(id))!).toMatchObject({ alertStatus: "pending", alertAttempts: 0 });
        expect(await db.MedicalQaAlertModel.countDocuments({ questionId: id })).toBe(0);
      });

      test("repeated and concurrent restores + concurrent processing alert each professional once", async () => {
        const nurses = [await withNurse(), await withNurse()];
        const { id, admin, rid } = await hiddenBeforeAlerts(HOUR);
        const restores = await Promise.all([1, 2, 3].map(() => moderate(admin, rid, "restore")));
        expect(restores.every((r) => r.status === 200)).toBe(true);
        expect(scheduleQuestionAlerts).toHaveBeenCalledTimes(3);
        await Promise.all(scheduleQuestionAlerts.mock.calls.map(([qid, opts]) => MedicalQaAlerts.processQuestion(qid, opts)));
        await moderate(admin, rid, "restore");
        await MedicalQaAlerts.processQuestion(id, window);

        for (const n of nurses) {
          expect(await db.MedicalQaAlertModel.countDocuments({ questionId: id, recipientId: n._id })).toBe(1);
          expect(await db.NotificationModel.countDocuments({ userId: n._id, "payload.questionId": id })).toBe(1);
        }
        expect((await questionDoc(id))!).toMatchObject({ alertStatus: "done", alertAttempts: 1 });
      });

      test("a failed restored-question run is retried while fresh, without duplicates", async () => {
        const nurse = await withNurse();
        const { id, admin, rid } = await hiddenBeforeAlerts(HOUR);
        await moderate(admin, rid, "restore");
        jest.spyOn(db.MedicalQaAlertModel, "updateOne").mockRejectedValueOnce(new Error("db blip") as never);
        jest.spyOn(console, "error").mockImplementation(() => {});
        expect(await MedicalQaAlerts.processQuestion(id, window)).toMatchObject({ processed: true, status: "failed" });
        expect((await questionDoc(id))!.alertStatus).toBe("failed");

        const retryAt = new Date(Date.now() + 30 * MINUTE); // past the first backoff, still < 24h old
        expect(await MedicalQaAlerts.sweepPending({ now: retryAt })).toBeGreaterThanOrEqual(1);
        expect((await questionDoc(id))!).toMatchObject({ alertStatus: "done", alertAttempts: 2 });
        await MedicalQaAlerts.sweepPending({ now: retryAt }); // a repeat run changes nothing
        expect((await questionDoc(id))!.alertAttempts).toBe(2);
        expect(await db.MedicalQaAlertModel.countDocuments({ questionId: id, recipientId: nurse._id })).toBe(1);
      });

      test("hidden or deleted questions are still never alerted, fresh or not", async () => {
        const { id } = await hiddenBeforeAlerts(HOUR);
        expect(await MedicalQaAlerts.processQuestion(id, window)).toEqual({ processed: false });
        const owner = await makePatient();
        const gone = await ask(owner);
        await del(gone, owner);
        expect(await MedicalQaAlerts.processQuestion(gone, window)).toEqual({ processed: false });
      });
    });

    // ------------------------------------------------------------------ 3. count races
    describe("3. Answer count stays exact under races and failures", () => {
      /**
       * Pauses the next countDocuments call after it has counted (so its number is
       * already computed) until `release()` — forcing the classic stale-write
       * interleaving deterministically.
       */
      function pauseNextCount() {
        const original = db.MedicalAnswerModel.countDocuments.bind(db.MedicalAnswerModel);
        let release!: () => void;
        let reached!: () => void;
        const gate = new Promise<void>((r) => (release = r));
        const atGate = new Promise<void>((r) => (reached = r));
        let armed = true;
        jest.spyOn(db.MedicalAnswerModel, "countDocuments").mockImplementation(((...args: Parameters<typeof original>) => {
          const q = original(...args);
          if (!armed) return q;
          armed = false;
          return Promise.resolve(q).then(async (n) => {
            reached();
            await gate;
            return n;
          });
        }) as never);
        return { atGate, release };
      }

      test("hide counted, then a new answer lands before the hide writes: final count is exact", async () => {
        const { id, answerId } = await answeredQuestion();
        const rid = await reportId(id, "answer", answerId);
        const { atGate, release } = pauseNextCount();
        const hide = moderate(await makeAdmin(), rid, "hide");
        await atGate; // hide has counted 0 visible answers
        expect((await reply(id, await makeDoctor(), { body: "Second opinion." })).status).toBe(200);
        release();
        expect((await hide).status).toBe(200);
        expect((await questionDoc(id))!.answerCount).toBe(1);
        await expectQuestionInvariants(id);
      });

      test("a new answer counted, then a hide lands before it writes: final count is exact", async () => {
        const { id, answerId } = await answeredQuestion();
        const rid = await reportId(id, "answer", answerId);
        const { atGate, release } = pauseNextCount();
        const answer = reply(id, await makeDoctor(), { body: "Second opinion." });
        await atGate; // the new answer's sync has counted 2
        expect((await moderate(await makeAdmin(), rid, "hide")).status).toBe(200);
        release();
        expect((await answer).status).toBe(200);
        expect((await questionDoc(id))!.answerCount).toBe(1);
        await expectQuestionInvariants(id);
      });

      test("restore counted, then another answer is hidden before it writes: final count is exact", async () => {
        const { id, answerId } = await answeredQuestion();
        const second = await reply(id, await makeDoctor(), { body: "Second opinion." });
        const admin = await makeAdmin();
        const r1 = await reportId(id, "answer", answerId);
        const r2 = await reportId(id, "answer", second.json.data.id);
        await moderate(admin, r1, "hide");
        const { atGate, release } = pauseNextCount();
        const restore = moderate(admin, r1, "restore");
        await atGate; // restore counted 2
        await moderate(admin, r2, "hide");
        release();
        expect((await restore).status).toBe(200);
        expect((await questionDoc(id))!.answerCount).toBe(1);
        await expectQuestionInvariants(id);
      });

      test("many concurrent answers, hides and restores end with an exact count", async () => {
        const { id, answerId } = await answeredQuestion();
        const admin = await makeAdmin();
        const rid = await reportId(id, "answer", answerId);
        const doctors = await Promise.all(Array.from({ length: 5 }, () => makeDoctor()));
        await Promise.all([
          ...doctors.map((d, i) => reply(id, d, { body: `Advice number ${i}` })),
          moderate(admin, rid, "hide"),
          moderate(admin, rid, "restore"),
          moderate(admin, rid, "hide"),
        ]);
        await expectQuestionInvariants(id);
      });

      test("if the count write keeps conflicting, the answer is still saved and the next sync repairs the count", async () => {
        const id = await ask(await makePatient());
        jest.spyOn(db.MedicalQuestionModel, "updateOne").mockResolvedValue({ matchedCount: 0, modifiedCount: 0 } as never);
        const logged = jest.spyOn(console, "error").mockImplementation(() => {});
        expect((await reply(id, await makeDoctor())).status).toBe(200);
        expect(logged).toHaveBeenCalled();
        jest.mocked(db.MedicalQuestionModel.updateOne).mockRestore();
        expect((await questionDoc(id))!.answerCount).toBe(0);

        expect((await reply(id, await makeDoctor(), { body: "Second opinion." })).status).toBe(200);
        expect((await questionDoc(id))!.answerCount).toBe(2);
        await expectQuestionInvariants(id);
      });
    });

    // ------------------------------------------------------------------ 4. scheduled recovery
    describe("4. Scheduled notification recovery endpoint", () => {
      const env = process.env as Record<string, string | undefined>;
      let savedSecret: string | undefined;
      let savedNodeEnv: string | undefined;
      beforeEach(() => {
        savedSecret = env.CRON_SECRET;
        savedNodeEnv = env.NODE_ENV;
        env.CRON_SECRET = "test-cron-secret";
      });
      afterEach(() => {
        env.CRON_SECRET = savedSecret;
        env.NODE_ENV = savedNodeEnv;
      });

      test.each([
        ["no credentials", {}],
        ["a wrong bearer secret", { authorization: "Bearer nope" }],
        ["a wrong x-cron-secret", { "x-cron-secret": "nope" }],
        ["a secret of a different length", { authorization: "Bearer test-cron-secret-extra" }],
        ["a user's session token style header", { authorization: "test-cron-secret" }],
      ])("refuses %s (401) and does no work", async (_l, headers) => {
        const { owner, id } = await answeredQuestion();
        await missedAnswer(id, await makeDoctor());
        const r = await runRecovery(headers as Record<string, string>);
        expect(r.status).toBe(401);
        expect(await answeredNotifications(owner._id)).toBe(0);
      });

      test("in production without CRON_SECRET configured, it refuses everything", async () => {
        delete env.CRON_SECRET;
        env.NODE_ENV = "production";
        expect((await runRecovery()).status).toBe(401);
        expect((await runRecovery({ authorization: "Bearer " })).status).toBe(401);
      });

      test("delivers missed notifications with no new answer posted (Bearer or x-cron-secret)", async () => {
        const owner = await makePatient();
        const id = await ask(owner);
        const doctor = await makeDoctor();
        await missedAnswer(id, doctor);
        sendExpoPush.mockResolvedValue({ sent: 1, failed: 0 });

        const r = await runRecovery();
        expect(r.status).toBe(200);
        expect(r.json).toMatchObject({ success: true, results: { answerNotificationsDelivered: 1 } });
        expect(await answeredNotifications(owner._id)).toBe(1);
        expect(sendExpoPush).toHaveBeenCalledTimes(pushesExpected(1));

        expect((await runRecovery({ "x-cron-secret": "test-cron-secret" })).json.results.answerNotificationsDelivered).toBe(0);
        expect(await answeredNotifications(owner._id)).toBe(1);
      });

      test("works through a backlog in bounded batches of 50, then goes idle", async () => {
        const owner = await makePatient();
        const id = await ask(owner);
        const doctor = await makeDoctor();
        for (let i = 0; i < 60; i++) await missedAnswer(id, doctor, 5 * MINUTE + i * 1000);

        expect((await runRecovery()).json.results.answerNotificationsDelivered).toBe(50);
        expect(await answeredNotifications(owner._id)).toBe(50);
        expect((await runRecovery()).json.results.answerNotificationsDelivered).toBe(10);
        expect((await runRecovery()).json.results.answerNotificationsDelivered).toBe(0);
        expect(await answeredNotifications(owner._id)).toBe(60);
      });

      test("reaches a miss deeper than one scan page, behind hundreds of already-notified answers", async () => {
        const owner = await makePatient();
        const id = await ask(owner);
        const doctor = await makeDoctor();
        const deep = await missedAnswer(id, doctor, 2 * HOUR);
        const notifiedIds = [];
        for (let i = 0; i < 250; i++) notifiedIds.push(await missedAnswer(id, doctor, HOUR - i * 1000));
        // Raw collection: only the ids matter here (the model's insertMany hook is not used by the app).
        await db.NotificationModel.collection.insertMany(
          notifiedIds.map((aid) => ({ _id: new mongooseMod.Types.ObjectId(aid), userId: owner._id, channel: "in_app" })),
        );
        expect((await runRecovery()).json.results.answerNotificationsDelivered).toBe(1);
        expect(await db.NotificationModel.exists({ _id: deep })).toBeTruthy();
      });

      test("concurrent runs deliver each missed notification exactly once", async () => {
        const doctor = await makeDoctor();
        const owners = await Promise.all(Array.from({ length: 8 }, () => makePatient()));
        for (const o of owners) await missedAnswer(await ask(o), doctor);
        sendExpoPush.mockResolvedValue({ sent: 1, failed: 0 });

        const runs = await Promise.all([1, 2, 3, 4].map(() => runRecovery()));
        expect(runs.every((r) => r.status === 200)).toBe(true);
        const delivered = runs.reduce((n, r) => n + r.json.results.answerNotificationsDelivered, 0);
        expect(delivered).toBe(8);
        for (const o of owners) expect(await answeredNotifications(o._id)).toBe(1);
        expect(sendExpoPush).toHaveBeenCalledTimes(pushesExpected(8));
      });

      test("never notifies for hidden/deleted questions, hidden answers, own questions or inactive authors", async () => {
        const doctor = await makeDoctor();
        const admin = await makeAdmin();
        const hiddenOwner = await makePatient();
        const hiddenQ = await ask(hiddenOwner);
        await moderate(admin, await reportId(hiddenQ, "question", hiddenQ), "hide");
        const deletedOwner = await makePatient();
        const deletedQ = await ask(deletedOwner);
        await del(deletedQ, deletedOwner);
        const ownQ = await ask(doctor);
        const inactiveOwner = await makePatient();
        const inactiveQ = await ask(inactiveOwner);
        await db.UserModel.updateOne({ _id: inactiveOwner._id }, { $set: { isActive: false } });
        const hiddenAnswerOwner = await makePatient();
        const hiddenAnswerQ = await ask(hiddenAnswerOwner);

        for (const q of [hiddenQ, deletedQ, ownQ, inactiveQ, hiddenAnswerQ]) await missedAnswer(q, doctor);
        const ha = await db.MedicalAnswerModel.findOne({ questionId: hiddenAnswerQ }).lean();
        await db.MedicalAnswerModel.updateOne({ _id: ha!._id }, { $set: { moderationStatus: "hidden" } });

        const r = await runRecovery();
        expect(r.status).toBe(200);
        expect(r.json.results.answerNotificationsDelivered).toBe(0);
        for (const u of [hiddenOwner, deletedOwner, doctor, inactiveOwner, hiddenAnswerOwner]) {
          expect(await answeredNotifications(u._id as import("mongoose").Types.ObjectId)).toBe(0);
        }
        expect(sendExpoPush).not.toHaveBeenCalled();
      });

      test("a failing item doesn't stop the batch; it is delivered on the next run", async () => {
        const doctor = await makeDoctor();
        const [o1, o2] = [await makePatient(), await makePatient()];
        await missedAnswer(await ask(o1), doctor);
        await missedAnswer(await ask(o2), doctor);
        jest.spyOn(db.NotificationModel, "create").mockRejectedValueOnce(new Error("db blip") as never);
        jest.spyOn(console, "error").mockImplementation(() => {});

        expect((await runRecovery()).json.results.answerNotificationsDelivered).toBe(1);
        expect((await runRecovery()).json.results.answerNotificationsDelivered).toBe(1);
        expect(await answeredNotifications(o1._id)).toBe(1);
        expect(await answeredNotifications(o2._id)).toBe(1);
      });

      test("a whole-sweep failure returns 500 (so the scheduler logs it) and the next run recovers", async () => {
        const owner = await makePatient();
        await missedAnswer(await ask(owner), await makeDoctor());
        jest.spyOn(db.MedicalAnswerModel, "find").mockImplementationOnce(() => {
          throw new Error("db down");
        });
        jest.spyOn(console, "error").mockImplementation(() => {});

        const failed = await runRecovery();
        expect(failed.status).toBe(500);
        expect(failed.json.success).toBe(false);
        expect(JSON.stringify(failed.json)).not.toMatch(/db down/);
        expect((await runRecovery()).json.results.answerNotificationsDelivered).toBe(1);
        expect(await answeredNotifications(owner._id)).toBe(1);
      });

      test("also retries failed new-question alerts that no new question would otherwise trigger", async () => {
        const nurse = await withNurse();
        const id = await ask(await makePatient(), { category: "nursing-care" });
        jest.spyOn(db.MedicalQaAlertModel, "updateOne").mockRejectedValueOnce(new Error("db blip") as never);
        jest.spyOn(console, "error").mockImplementation(() => {});
        await MedicalQaAlerts.processQuestion(id);
        expect((await questionDoc(id))!.alertStatus).toBe("failed");
        // Make the retry due now (the backoff has elapsed).
        await db.MedicalQuestionModel.updateOne({ _id: id }, { $set: { alertNextAttemptAt: new Date(Date.now() - 1000) } });

        expect((await runRecovery()).json.results.questionAlertRunsRetried).toBeGreaterThanOrEqual(1);
        expect((await questionDoc(id))!.alertStatus).toBe("done");
        expect(await db.MedicalQaAlertModel.countDocuments({ questionId: id, recipientId: nurse._id })).toBe(1);
      });
    });
  });
});
