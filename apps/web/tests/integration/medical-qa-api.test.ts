/**
 * QA-API — Public Medical Q&A: routes, authorization, attachments, abuse,
 * consistency.
 *
 * Real local MongoDB (mongodb-memory-server, ephemeral — never Atlas, never
 * production) + REAL route handlers + REAL auth (mobile Bearer JWT signed
 * with a test secret) + REAL MedicalQaService and image pipeline.
 * Only Supabase network I/O (object-storage double), the realtime
 * publisher (spy) and the push providers (mocks) are replaced; global fetch
 * throws, as a backstop. Redis is never reached: production Upstash
 * env vars are removed before any module loads.
 */
import { MongoMemoryServer } from "mongodb-memory-server";
import { randomBytes, randomUUID } from "crypto";
import sharp from "sharp";
import { buildObjectStorageDouble } from "../helpers/object-storage-double";
import { makeTruncatedImage, makeValidJpeg, makeValidPng, toFile } from "../helpers/synthetic-files";
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

// Answers and new questions trigger real background notification runs here; their
// push step must never reach Expo or web-push.
const pushSpy = jest.fn(async () => ({ sent: 0, failed: 0 }));
jest.mock("@/server/services/push.service", () => ({
  sendExpoPushToUser: (...args: unknown[]) => pushSpy(...(args as [])),
  sendWebPushToUser: (...args: unknown[]) => pushSpy(...(args as [])),
}));

jest.mock("@/lib/auth", () => ({ auth: async () => null }));

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- each route returns a different payload shape
type Json = { success: boolean; data: any; error: { code: string; message: string } | null };

describe("Public Medical Q&A API (real local MongoDB)", () => {
  let mongod: InstanceType<typeof MongoMemoryServer>;
  let mongooseMod: typeof import("mongoose");
  let db: typeof import("@zindagi/database");
  let Roles: typeof import("@zindagi/shared").Roles;
  let signMobileAccessToken: typeof import("@/server/api/mobile-jwt").signMobileAccessToken;

  let questionsRoute: typeof import("@/app/api/v1/medical-questions/route");
  let questionRoute: typeof import("@/app/api/v1/medical-questions/[id]/route");
  let answersRoute: typeof import("@/app/api/v1/medical-questions/[id]/answers/route");
  let attachmentsRoute: typeof import("@/app/api/v1/medical-questions/[id]/attachments/route");
  let attachmentRoute: typeof import("@/app/api/v1/medical-questions/[id]/attachments/[attachmentId]/route");
  let reportsRoute: typeof import("@/app/api/v1/medical-questions/[id]/reports/route");
  let adminReportsRoute: typeof import("@/app/api/v1/admin/medical-questions/reports/route");

  let counter = 0;
  const uniq = () => `${Date.now()}-${counter++}`;

  async function makeUser(roles: Role[], name = "Test User") {
    return db.UserModel.create({
      name,
      email: `qa-${uniq()}@test.local`,
      phone: `+92300${Math.floor(1000000 + Math.random() * 9000000)}`,
      roles,
    });
  }
  const makePatient = (name = "Synthetic Patient") => makeUser([Roles.PATIENT], name);

  async function makeDoctor(status: "approved" | "pending" | "restricted" | "rejected" = "approved") {
    const user = await makeUser([Roles.DOCTOR], "Dr. Synthetic");
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

  async function makeStaff(staffType: "nurse" | "physiotherapist", status: "approved" | "pending" = "approved") {
    const user = await makeUser([staffType], `Synthetic ${staffType}`);
    await db.StaffProfileModel.create({ userId: user._id, staffType, verificationStatus: status, isAvailable: true });
    return user;
  }

  const makeAdmin = () => makeUser([Roles.ADMIN], "Synthetic Admin");

  async function headers(user?: { _id: unknown } | null, json = true) {
    const h: Record<string, string> = {};
    if (json) h["content-type"] = "application/json";
    if (user) h.authorization = `Bearer ${await signMobileAccessToken(String(user._id))}`;
    return h;
  }

  async function call(
    handler: (req: never, ctx?: never) => Promise<Response>,
    method: string,
    path: string,
    user?: { _id: unknown } | null,
    body?: unknown,
  ): Promise<{ status: number; json: Json; res: Response }> {
    const req = new Request(`http://localhost${path}`, {
      method,
      headers: await headers(user),
      body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
    });
    const res = await handler(req as never);
    const text = await res.clone().text();
    let json: Json;
    try {
      json = JSON.parse(text);
    } catch {
      json = { success: false, data: null, error: null };
    }
    return { status: res.status, json, res };
  }

  const validQuestion = () => ({
    category: "general",
    title: `Mild fever and body ache ${uniq()}`,
    body: "Synthetic test question: mild fever 99.5F and body ache for two days, no other symptoms.",
  });

  async function ask(user: { _id: unknown }, overrides: Record<string, unknown> = {}) {
    const r = await call(questionsRoute.POST as never, "POST", "/api/v1/medical-questions", user, {
      ...validQuestion(),
      ...overrides,
    });
    expect(r.status).toBe(200);
    return r.json.data as { id: string };
  }

  async function upload(questionId: string, user: { _id: unknown } | null, file: File) {
    const fd = new FormData();
    fd.set("file", file);
    const h = await headers(user, false);
    const req = new Request(`http://localhost/api/v1/medical-questions/${questionId}/attachments`, {
      method: "POST",
      headers: h,
      body: fd,
    });
    const res = await attachmentsRoute.POST(req as never);
    return { status: res.status, json: (await res.json()) as Json };
  }

  async function getAttachment(questionId: string, attachmentId: string, user: { _id: unknown } | null) {
    const req = new Request(`http://localhost/api/v1/medical-questions/${questionId}/attachments/${attachmentId}`, {
      headers: await headers(user, false),
    });
    return attachmentRoute.GET(req as never);
  }

  const realFetch = global.fetch;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongod.getUri("medical_qa_audit");
    // Backstop: nothing in these tests may reach the network.
    global.fetch = (() => Promise.reject(new Error("network access is blocked in tests"))) as typeof fetch;
    process.env.FIELD_ENCRYPTION_KEY = randomBytes(32).toString("base64");
    process.env.AUTH_SECRET = "test-secret-at-least-32-chars-long-12345";

    db = await import("@zindagi/database");
    mongooseMod = (await import("mongoose")).default;
    Roles = (await import("@zindagi/shared")).Roles;
    await db.connectDatabase();
    // Guard: refuse to run against anything but the in-memory server.
    expect(mongooseMod.connection.host).toMatch(/127\.0\.0\.1|localhost/);

    ({ signMobileAccessToken } = await import("@/server/api/mobile-jwt"));
    questionsRoute = await import("@/app/api/v1/medical-questions/route");
    questionRoute = await import("@/app/api/v1/medical-questions/[id]/route");
    answersRoute = await import("@/app/api/v1/medical-questions/[id]/answers/route");
    attachmentsRoute = await import("@/app/api/v1/medical-questions/[id]/attachments/route");
    attachmentRoute = await import("@/app/api/v1/medical-questions/[id]/attachments/[attachmentId]/route");
    reportsRoute = await import("@/app/api/v1/medical-questions/[id]/reports/route");
    adminReportsRoute = await import("@/app/api/v1/admin/medical-questions/reports/route");
  });

  afterEach(() => {
    objectStorageDouble.setFailNextPut(null);
    objectStorageDouble.setFailNextGet(null);
    objectStorageDouble.setPutDelayMs(0);
    publishSpy.mockReset();
  });

  afterAll(async () => {
    global.fetch = realFetch;
    await mongooseMod.disconnect();
    await mongod.stop();
  });

  // ---------------------------------------------------------------------------
  describe("Creating questions", () => {
    test("anonymous users cannot post a question (401)", async () => {
      const r = await call(questionsRoute.POST as never, "POST", "/api/v1/medical-questions", null, validQuestion());
      expect(r.status).toBe(401);
    });

    test("an existing patient account posts a question; each question gets its own thread id", async () => {
      const patient = await makePatient();
      const a = await ask(patient);
      const b = await ask(patient);
      expect(a.id).toMatch(/^[a-f0-9]{24}$/);
      expect(a.id).not.toBe(b.id);
      const stored = await db.MedicalQuestionModel.findById(a.id).lean();
      expect(String(stored!.authorId)).toBe(String(patient._id));
      expect(await db.UserModel.countDocuments({ _id: patient._id })).toBe(1);
    });

    test("ignores/rejects client-supplied ownership and moderation fields", async () => {
      const patient = await makePatient();
      const other = await makePatient();
      const r = await call(questionsRoute.POST as never, "POST", "/api/v1/medical-questions", patient, {
        ...validQuestion(),
        authorId: String(other._id),
        moderationStatus: "visible",
      });
      expect(r.status).toBe(400);
      expect(r.json.error!.code).toBe("VALIDATION_ERROR");
    });

    test.each([
      ["operator in body", { body: { $gt: "" } }],
      ["operator in category", { category: { $ne: null } }],
      ["$where key", { $where: "sleep(1000)" }],
      ["prototype pollution key", JSON.parse('{"__proto__":{"isAdmin":true}}')],
    ])("rejects NoSQL/prototype injection: %s", async (_l, extra) => {
      const patient = await makePatient();
      const r = await call(questionsRoute.POST as never, "POST", "/api/v1/medical-questions", patient, {
        ...validQuestion(),
        ...extra,
      });
      expect(r.status).toBe(400);
    });

    test("rejects malformed JSON and wrong content-type without a stack trace", async () => {
      const patient = await makePatient();
      const r = await call(questionsRoute.POST as never, "POST", "/api/v1/medical-questions", patient, "{not json");
      expect(r.status).toBe(400);
      expect(JSON.stringify(r.json)).not.toMatch(/at \w+ \(|node_modules|mongo/i);

      const req = new Request("http://localhost/api/v1/medical-questions", {
        method: "POST",
        headers: { ...(await headers(patient)), "content-type": "text/plain" },
        body: JSON.stringify(validQuestion()),
      });
      expect((await questionsRoute.POST(req as never)).status).toBe(415);
    });

    test("rejects an oversized request body before parsing it (413)", async () => {
      const patient = await makePatient();
      const r = await call(questionsRoute.POST as never, "POST", "/api/v1/medical-questions", patient, {
        ...validQuestion(),
        body: "x".repeat(200_000),
      });
      expect(r.status).toBe(413);
    });

    test("stores XSS payloads literally (rendering escapes them)", async () => {
      const patient = await makePatient();
      const body = 'Is this rash serious? <img src=x onerror=alert(1)><script>alert("x")</script>';
      const { id } = await ask(patient, { body });
      const r = await call(questionRoute.GET as never, "GET", `/api/v1/medical-questions/${id}`, null);
      expect(r.json.data.question.body).toBe(body);
    });

    test("duplicate submission with the same idempotency key creates one question", async () => {
      const patient = await makePatient();
      const idempotencyKey = randomUUID();
      const payload = { ...validQuestion(), idempotencyKey };
      const results = await Promise.all(
        Array.from({ length: 5 }, () =>
          call(questionsRoute.POST as never, "POST", "/api/v1/medical-questions", patient, payload),
        ),
      );
      expect(results.every((r) => r.status === 200)).toBe(true);
      expect(new Set(results.map((r) => r.json.data.id)).size).toBe(1);
      expect(await db.MedicalQuestionModel.countDocuments({ authorId: patient._id })).toBe(1);
    });

    test("question rate limit: boundary then 429 with Retry-After", async () => {
      const patient = await makePatient();
      const { MEDICAL_QA_RATE_LIMITS } = await import("@/server/services/medical-qa.service");
      for (let i = 0; i < MEDICAL_QA_RATE_LIMITS.createQuestion.limit; i++) await ask(patient);
      const r = await call(questionsRoute.POST as never, "POST", "/api/v1/medical-questions", patient, validQuestion());
      expect(r.status).toBe(429);
      expect(Number(r.res.headers.get("retry-after"))).toBeGreaterThan(0);
    });

    test("database persistence does not depend on realtime publish succeeding", async () => {
      publishSpy.mockImplementation(() => {
        throw new Error("redis down");
      });
      const patient = await makePatient();
      const { id } = await ask(patient);
      expect(await db.MedicalQuestionModel.exists({ _id: id })).toBeTruthy();
    });
  });

  // ---------------------------------------------------------------------------
  describe("Public reads", () => {
    test("anyone can list and read public questions; patient identity is never exposed", async () => {
      const patient = await makePatient("Very Private Name");
      const { id } = await ask(patient);
      const list = await call(questionsRoute.GET as never, "GET", "/api/v1/medical-questions?limit=50", null);
      expect(list.status).toBe(200);
      expect(list.json.data.items.some((q: { id: string }) => q.id === id)).toBe(true);

      const detail = await call(questionRoute.GET as never, "GET", `/api/v1/medical-questions/${id}`, null);
      expect(detail.status).toBe(200);
      const raw = JSON.stringify(detail.json);
      expect(raw).not.toContain("Very Private Name");
      expect(raw).not.toContain(String(patient._id));
      expect(raw).not.toContain(patient.email!);
    });

    test("malformed ids are 400/404 and never reach Mongo as operators", async () => {
      for (const bad of ["not-an-id", "%7B%22%24ne%22%3Anull%7D", "..%2F..%2Fetc"]) {
        const r = await call(questionRoute.GET as never, "GET", `/api/v1/medical-questions/${bad}`, null);
        expect([400, 404]).toContain(r.status);
      }
      const missing = await call(
        questionRoute.GET as never,
        "GET",
        `/api/v1/medical-questions/${new mongooseMod.Types.ObjectId()}`,
        null,
      );
      expect(missing.status).toBe(404);
    });

    test("cursor pagination returns stable, non-overlapping pages and caps page size", async () => {
      const patient = await makePatient();
      for (let i = 0; i < 3; i++) await ask(patient, { category: "skin" });
      const p1 = await call(questionsRoute.GET as never, "GET", "/api/v1/medical-questions?category=skin&limit=2", null);
      expect(p1.json.data.items).toHaveLength(2);
      const p2 = await call(
        questionsRoute.GET as never,
        "GET",
        `/api/v1/medical-questions?category=skin&limit=2&cursor=${p1.json.data.nextCursor}`,
        null,
      );
      const ids1 = p1.json.data.items.map((q: { id: string }) => q.id);
      const ids2 = p2.json.data.items.map((q: { id: string }) => q.id);
      expect(ids1.filter((x: string) => ids2.includes(x))).toHaveLength(0);
      const tooBig = await call(questionsRoute.GET as never, "GET", "/api/v1/medical-questions?limit=5000", null);
      expect(tooBig.status).toBe(400);
    });

    test("hidden (moderated) and deleted questions are not publicly visible", async () => {
      const patient = await makePatient();
      const { id } = await ask(patient);
      await db.MedicalQuestionModel.updateOne({ _id: id }, { $set: { moderationStatus: "hidden" } });
      expect((await call(questionRoute.GET as never, "GET", `/api/v1/medical-questions/${id}`, null)).status).toBe(404);
      const list = await call(questionsRoute.GET as never, "GET", "/api/v1/medical-questions?limit=50", null);
      expect(list.json.data.items.some((q: { id: string }) => q.id === id)).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  describe("Answers & follow-ups — provider verification from trusted records", () => {
    test.each([
      ["verified doctor", () => makeDoctor("approved"), "doctor"],
      ["verified nurse", () => makeStaff("nurse"), "nurse"],
      ["verified physiotherapist", () => makeStaff("physiotherapist"), "physiotherapist"],
    ])("%s can answer and is shown as verified", async (_l, makeProvider, role) => {
      const patient = await makePatient();
      const provider = await makeProvider();
      const { id } = await ask(patient);
      const r = await call(answersRoute.POST as never, "POST", `/api/v1/medical-questions/${id}/answers`, provider, {
        body: "Synthetic advice: rest, fluids, and see a doctor if fever exceeds 102F.",
      });
      expect(r.status).toBe(200);
      expect(r.json.data.author).toMatchObject({ role, verified: true });
      const stored = await db.MedicalAnswerModel.findById(r.json.data.id).lean();
      expect(String(stored!.questionId)).toBe(id);
    });

    test.each([
      ["pending doctor", () => makeDoctor("pending")],
      ["suspended (restricted) doctor", () => makeDoctor("restricted")],
      ["rejected doctor", () => makeDoctor("rejected")],
      ["pending nurse", () => makeStaff("nurse", "pending")],
      ["another patient", () => makePatient()],
      ["admin without a provider profile", () => makeAdmin()],
    ])("%s cannot answer (403)", async (_l, makeActor) => {
      const patient = await makePatient();
      const actor = await makeActor();
      const { id } = await ask(patient);
      const r = await call(answersRoute.POST as never, "POST", `/api/v1/medical-questions/${id}/answers`, actor, {
        body: "I am totally a doctor, trust me.",
      });
      expect(r.status).toBe(403);
      expect(await db.MedicalAnswerModel.countDocuments({ questionId: id })).toBe(0);
    });

    test("a user with a doctor role but no profile cannot answer (role claim alone is not trusted)", async () => {
      const fake = await makeUser([Roles.DOCTOR]);
      const { id } = await ask(await makePatient());
      const r = await call(answersRoute.POST as never, "POST", `/api/v1/medical-questions/${id}/answers`, fake, {
        body: "fake doctor answer",
      });
      expect(r.status).toBe(403);
    });

    test("anonymous users cannot answer (401)", async () => {
      const { id } = await ask(await makePatient());
      const r = await call(answersRoute.POST as never, "POST", `/api/v1/medical-questions/${id}/answers`, null, {
        body: "hello",
      });
      expect(r.status).toBe(401);
    });

    test("multiple providers can answer the same question; all answers stay on that thread", async () => {
      const patient = await makePatient();
      const { id } = await ask(patient);
      const { id: otherId } = await ask(patient);
      const providers = [await makeDoctor(), await makeDoctor(), await makeStaff("nurse")];
      for (const p of providers) {
        const r = await call(answersRoute.POST as never, "POST", `/api/v1/medical-questions/${id}/answers`, p, {
          body: "Synthetic answer text.",
        });
        expect(r.status).toBe(200);
      }
      const detail = await call(questionRoute.GET as never, "GET", `/api/v1/medical-questions/${id}`, null);
      expect(detail.json.data.answers).toHaveLength(3);
      expect(detail.json.data.question.answerCount).toBe(3);
      expect(await db.MedicalAnswerModel.countDocuments({ questionId: otherId })).toBe(0);
    });

    test("verification badge reflects the CURRENT record: a provider suspended later is no longer shown as verified", async () => {
      const doctor = await makeDoctor("approved");
      const { id } = await ask(await makePatient());
      await call(answersRoute.POST as never, "POST", `/api/v1/medical-questions/${id}/answers`, doctor, {
        body: "Answer before suspension.",
      });
      await db.DoctorProfileModel.updateOne({ userId: doctor._id }, { $set: { verificationStatus: "restricted" } });
      const detail = await call(questionRoute.GET as never, "GET", `/api/v1/medical-questions/${id}`, null);
      expect(detail.json.data.answers[0].author.verified).toBe(false);
    });

    test("the question author can post a follow-up; other patients cannot", async () => {
      const patient = await makePatient();
      const stranger = await makePatient();
      const { id } = await ask(patient);
      const own = await call(answersRoute.POST as never, "POST", `/api/v1/medical-questions/${id}/answers`, patient, {
        body: "Follow-up: the fever went down today.",
      });
      expect(own.status).toBe(200);
      expect(own.json.data.kind).toBe("follow_up");
      const other = await call(answersRoute.POST as never, "POST", `/api/v1/medical-questions/${id}/answers`, stranger, {
        body: "hijack",
      });
      expect(other.status).toBe(403);
    });

    test("answer to a hidden or deleted question is rejected (404)", async () => {
      const { id } = await ask(await makePatient());
      await db.MedicalQuestionModel.updateOne({ _id: id }, { $set: { deletedAt: new Date() } });
      const r = await call(answersRoute.POST as never, "POST", `/api/v1/medical-questions/${id}/answers`, await makeDoctor(), {
        body: "late answer",
      });
      expect(r.status).toBe(404);
    });

    test("answer persisted even if realtime publish throws; publish happens after the write", async () => {
      const doctor = await makeDoctor();
      const { id } = await ask(await makePatient());
      publishSpy.mockImplementation(async (event: { answerId?: string }) => {
        // The record must already be readable when the event fires.
        expect(await db.MedicalAnswerModel.exists({ _id: event.answerId })).toBeTruthy();
        throw new Error("publish failed");
      });
      const r = await call(answersRoute.POST as never, "POST", `/api/v1/medical-questions/${id}/answers`, doctor, {
        body: "Persist me",
      });
      expect(r.status).toBe(200);
      expect(publishSpy).toHaveBeenCalled();
      expect(await db.MedicalAnswerModel.countDocuments({ questionId: id })).toBe(1);
    });

    test("realtime event payloads carry ids only — no medical text or attachment URLs", async () => {
      const doctor = await makeDoctor();
      const { id } = await ask(await makePatient());
      await call(answersRoute.POST as never, "POST", `/api/v1/medical-questions/${id}/answers`, doctor, {
        body: "SECRET-CLINICAL-TEXT",
      });
      const payload = JSON.stringify(publishSpy.mock.calls);
      expect(payload).not.toContain("SECRET-CLINICAL-TEXT");
      expect(payload).not.toMatch(/attachments|storageKey|url/i);
    });

    test("duplicate answer with the same idempotency key is stored once", async () => {
      const doctor = await makeDoctor();
      const { id } = await ask(await makePatient());
      const payload = { body: "Same answer", idempotencyKey: randomUUID() };
      const rs = await Promise.all(
        Array.from({ length: 4 }, () =>
          call(answersRoute.POST as never, "POST", `/api/v1/medical-questions/${id}/answers`, doctor, payload),
        ),
      );
      expect(rs.every((r) => r.status === 200)).toBe(true);
      expect(await db.MedicalAnswerModel.countDocuments({ questionId: id })).toBe(1);
      expect((await db.MedicalQuestionModel.findById(id).lean())!.answerCount).toBe(1);
    });
  });

  // ---------------------------------------------------------------------------
  describe("Owner actions", () => {
    test("only the author (or an admin) can delete a question", async () => {
      const owner = await makePatient();
      const stranger = await makePatient();
      const { id } = await ask(owner);
      expect((await call(questionRoute.DELETE as never, "DELETE", `/api/v1/medical-questions/${id}`, stranger)).status).toBe(403);
      expect((await call(questionRoute.DELETE as never, "DELETE", `/api/v1/medical-questions/${id}`, null)).status).toBe(401);
      expect((await call(questionRoute.DELETE as never, "DELETE", `/api/v1/medical-questions/${id}`, owner)).status).toBe(200);
      expect((await call(questionRoute.GET as never, "GET", `/api/v1/medical-questions/${id}`, null)).status).toBe(404);
    });
  });

  // ---------------------------------------------------------------------------
  describe("Private attachments", () => {
    test("owner uploads a JPEG; it is re-encoded, encrypted at rest and stored under a random key", async () => {
      const owner = await makePatient();
      const { id } = await ask(owner);
      const r = await upload(id, owner, toFile(await makeValidJpeg(), "../../evil name.jpg", "image/jpeg"));
      expect(r.status).toBe(200);
      const att = await db.MedicalQuestionAttachmentModel.findById(r.json.data.id).lean();
      expect(att!.storageKey).toMatch(new RegExp(`^${id}/[0-9a-f-]{36}\\.webp$`));
      expect(att!.contentType).toBe("image/webp");
      expect(att!.storageKey).not.toContain("evil");
      const stored = objectStorageDouble.store.get(`medical-qa-attachments/${att!.storageKey}`)!;
      expect(stored).toBeDefined();
      // Encrypted envelope, not a raw WebP.
      expect(stored.buffer.subarray(8, 12).toString()).not.toBe("WEBP");
      expect(JSON.stringify(r.json)).not.toContain(att!.storageKey);
    });

    test.each([
      ["SVG", Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>'), "image/svg+xml", "x.svg"],
      ["HTML renamed .jpg", Buffer.from("<html><script>alert(1)</script></html>"), "image/jpeg", "x.jpg"],
      ["EXE renamed .png", Buffer.concat([Buffer.from("MZ"), Buffer.alloc(500)]), "image/png", "x.png"],
    ])("rejects %s with 400 and stores nothing", async (_l, buf, mime, name) => {
      const owner = await makePatient();
      const { id } = await ask(owner);
      const before = objectStorageDouble.store.size;
      const r = await upload(id, owner, toFile(buf, name, mime));
      expect(r.status).toBe(400);
      expect(objectStorageDouble.store.size).toBe(before);
      expect(await db.MedicalQuestionAttachmentModel.countDocuments({ questionId: id })).toBe(0);
      expect((await db.MedicalQuestionModel.findById(id).lean())!.attachmentCount).toBe(0);
    });

    test("rejects a corrupt image", async () => {
      const owner = await makePatient();
      const { id } = await ask(owner);
      expect((await upload(id, owner, toFile(await makeTruncatedImage(), "a.jpg", "image/jpeg"))).status).toBe(400);
    });

    test("rejects an oversized upload via Content-Length before reading the body (413)", async () => {
      const owner = await makePatient();
      const { id } = await ask(owner);
      const req = new Request(`http://localhost/api/v1/medical-questions/${id}/attachments`, {
        method: "POST",
        headers: { ...(await headers(owner, false)), "content-type": "multipart/form-data; boundary=x", "content-length": String(50 * 1024 * 1024) },
        body: "--x--",
      });
      expect((await attachmentsRoute.POST(req as never)).status).toBe(413);
    });

    test("anonymous and non-owner users cannot attach to someone else's question", async () => {
      const owner = await makePatient();
      const { id } = await ask(owner);
      expect((await upload(id, null, toFile(await makeValidJpeg(), "a.jpg", "image/jpeg"))).status).toBe(401);
      expect((await upload(id, await makePatient(), toFile(await makeValidJpeg(), "a.jpg", "image/jpeg"))).status).toBe(403);
      expect((await upload(id, await makeDoctor(), toFile(await makeValidJpeg(), "a.jpg", "image/jpeg"))).status).toBe(403);
    });

    test("enforces the per-question attachment limit even under concurrent uploads", async () => {
      const owner = await makePatient();
      const { id } = await ask(owner);
      const { MEDICAL_QA_LIMITS } = await import("@zindagi/validators");
      objectStorageDouble.setPutDelayMs(20);
      const png = await makeValidPng();
      const results = await Promise.all(
        Array.from({ length: MEDICAL_QA_LIMITS.maxAttachments + 3 }, (_, i) => upload(id, owner, toFile(png, `p${i}.png`, "image/png"))),
      );
      expect(results.filter((r) => r.status === 200)).toHaveLength(MEDICAL_QA_LIMITS.maxAttachments);
      expect(await db.MedicalQuestionAttachmentModel.countDocuments({ questionId: id })).toBe(MEDICAL_QA_LIMITS.maxAttachments);
      expect((await db.MedicalQuestionModel.findById(id).lean())!.attachmentCount).toBe(MEDICAL_QA_LIMITS.maxAttachments);
    });

    test("storage outage: no metadata row is written and the attachment slot is released", async () => {
      const owner = await makePatient();
      const { id } = await ask(owner);
      objectStorageDouble.setFailNextPut(new Error("supabase 503"));
      const r = await upload(id, owner, toFile(await makeValidJpeg(), "a.jpg", "image/jpeg"));
      expect(r.status).toBe(503);
      expect(JSON.stringify(r.json)).not.toContain("supabase");
      expect(await db.MedicalQuestionAttachmentModel.countDocuments({ questionId: id })).toBe(0);
      expect((await db.MedicalQuestionModel.findById(id).lean())!.attachmentCount).toBe(0);
    });

    test("metadata write failure: the uploaded object is cleaned up (no orphan)", async () => {
      const owner = await makePatient();
      const { id } = await ask(owner);
      const spy = jest
        .spyOn(db.MedicalQuestionAttachmentModel, "create")
        .mockRejectedValueOnce(new Error("mongo write failed") as never);
      const before = [...objectStorageDouble.store.keys()].filter((k) => k.includes(id)).length;
      const r = await upload(id, owner, toFile(await makeValidJpeg(), "a.jpg", "image/jpeg"));
      spy.mockRestore();
      expect(r.status).toBe(500);
      expect([...objectStorageDouble.store.keys()].filter((k) => k.includes(id)).length).toBe(before);
      expect((await db.MedicalQuestionModel.findById(id).lean())!.attachmentCount).toBe(0);
    });

    describe("access control on private images", () => {
      let ownerId: { _id: unknown };
      let questionId: string;
      let attachmentId: string;

      beforeAll(async () => {
        ownerId = await makePatient();
        ({ id: questionId } = await ask(ownerId));
        const r = await upload(questionId, ownerId, toFile(await makeValidJpeg(), "a.jpg", "image/jpeg"));
        attachmentId = r.json.data.id;
      });

      test("anonymous visitor: 401, and public question JSON exposes no attachment URL or key", async () => {
        expect((await getAttachment(questionId, attachmentId, null)).status).toBe(401);
        const detail = await call(questionRoute.GET as never, "GET", `/api/v1/medical-questions/${questionId}`, null);
        expect(detail.json.data.photos).toBeNull();
        expect(detail.json.data.question.photoCount).toBe(1);
        expect(JSON.stringify(detail.json)).not.toMatch(/attachments\/|storageKey|supabase/i);
      });

      test("another patient: 403 on the image and no photo list", async () => {
        const stranger = await makePatient();
        expect((await getAttachment(questionId, attachmentId, stranger)).status).toBe(403);
        const detail = await call(questionRoute.GET as never, "GET", `/api/v1/medical-questions/${questionId}`, stranger);
        expect(detail.json.data.photos).toBeNull();
      });

      test("unverified/suspended providers: 403", async () => {
        expect((await getAttachment(questionId, attachmentId, await makeDoctor("pending"))).status).toBe(403);
        expect((await getAttachment(questionId, attachmentId, await makeDoctor("restricted"))).status).toBe(403);
      });

      test("owner and verified providers can view it, with safe headers", async () => {
        for (const viewer of [ownerId, await makeDoctor(), await makeStaff("physiotherapist")]) {
          const res = await getAttachment(questionId, attachmentId, viewer);
          expect(res.status).toBe(200);
          expect(res.headers.get("content-type")).toBe("image/webp");
          expect(res.headers.get("x-content-type-options")).toBe("nosniff");
          expect(res.headers.get("cache-control")).toMatch(/private/);
          expect(res.headers.get("cache-control")).toMatch(/no-store/);
          expect(res.headers.get("content-security-policy")).toMatch(/default-src 'none'/);
          const bytes = Buffer.from(await res.arrayBuffer());
          expect((await sharp(bytes).metadata()).format).toBe("webp");
        }
      });

      test("owner sees photo URLs in the question detail, pointing at the authorized proxy only", async () => {
        const detail = await call(questionRoute.GET as never, "GET", `/api/v1/medical-questions/${questionId}`, ownerId);
        expect(detail.json.data.photos).toHaveLength(1);
        expect(detail.json.data.photos[0].url).toBe(`/api/v1/medical-questions/${questionId}/attachments/${attachmentId}`);
      });

      test("attachment-id substitution across questions is rejected (IDOR/BOLA)", async () => {
        const attacker = await makePatient();
        const { id: attackerQuestion } = await ask(attacker);
        expect((await getAttachment(attackerQuestion, attachmentId, attacker)).status).toBe(404);
      });

      test("malformed attachment ids are rejected", async () => {
        const res = await getAttachment(questionId, "../../secret", ownerId);
        expect([400, 404]).toContain(res.status);
      });
    });
  });

  // ---------------------------------------------------------------------------
  describe("Reports & moderation", () => {
    test("logged-in users can report; repeated reports are idempotent", async () => {
      const { id } = await ask(await makePatient());
      const reporter = await makePatient();
      const body = { targetType: "question", targetId: id, reason: "misleading" };
      const a = await call(reportsRoute.POST as never, "POST", `/api/v1/medical-questions/${id}/reports`, reporter, body);
      const b = await call(reportsRoute.POST as never, "POST", `/api/v1/medical-questions/${id}/reports`, reporter, body);
      expect(a.status).toBe(200);
      expect(b.status).toBe(200);
      expect(await db.MedicalQaReportModel.countDocuments({ targetId: id })).toBe(1);
    });

    test("anonymous users cannot report (401)", async () => {
      const { id } = await ask(await makePatient());
      const r = await call(reportsRoute.POST as never, "POST", `/api/v1/medical-questions/${id}/reports`, null, {
        targetType: "question",
        targetId: id,
        reason: "spam",
      });
      expect(r.status).toBe(401);
    });

    test("reporting an answer that belongs to a different question is rejected (thread substitution)", async () => {
      const doctor = await makeDoctor();
      const { id: q1 } = await ask(await makePatient());
      const { id: q2 } = await ask(await makePatient());
      const ans = await call(answersRoute.POST as never, "POST", `/api/v1/medical-questions/${q1}/answers`, doctor, {
        body: "answer on q1",
      });
      const r = await call(reportsRoute.POST as never, "POST", `/api/v1/medical-questions/${q2}/reports`, await makePatient(), {
        targetType: "answer",
        targetId: ans.json.data.id,
        reason: "spam",
      });
      expect(r.status).toBe(404);
    });

    test("only admins can list reports or moderate; actions are audited and reversible", async () => {
      const doctor = await makeDoctor();
      const { id } = await ask(await makePatient());
      const ans = await call(answersRoute.POST as never, "POST", `/api/v1/medical-questions/${id}/answers`, doctor, {
        body: "Take double dose of everything",
      });
      await call(reportsRoute.POST as never, "POST", `/api/v1/medical-questions/${id}/reports`, await makePatient(), {
        targetType: "answer",
        targetId: ans.json.data.id,
        reason: "dangerous",
      });
      const report = await db.MedicalQaReportModel.findOne({ targetId: ans.json.data.id }).lean();

      for (const nonAdmin of [await makePatient(), doctor, await makeStaff("nurse")]) {
        expect((await call(adminReportsRoute.GET as never, "GET", "/api/v1/admin/medical-questions/reports", nonAdmin)).status).toBe(403);
        expect(
          (await call(adminReportsRoute.PATCH as never, "PATCH", "/api/v1/admin/medical-questions/reports", nonAdmin, {
            reportId: String(report!._id),
            action: "hide",
          })).status,
        ).toBe(403);
      }

      const admin = await makeAdmin();
      const list = await call(adminReportsRoute.GET as never, "GET", "/api/v1/admin/medical-questions/reports", admin);
      expect(list.status).toBe(200);
      expect(list.json.data.items.some((r: { id: string }) => r.id === String(report!._id))).toBe(true);

      const hide = await call(adminReportsRoute.PATCH as never, "PATCH", "/api/v1/admin/medical-questions/reports", admin, {
        reportId: String(report!._id),
        action: "hide",
      });
      expect(hide.status).toBe(200);
      let detail = await call(questionRoute.GET as never, "GET", `/api/v1/medical-questions/${id}`, null);
      expect(detail.json.data.answers).toHaveLength(0);
      expect(await db.AuditLogModel.countDocuments({ entityId: ans.json.data.id, action: "medical_qa.hide" })).toBe(1);

      const restore = await call(adminReportsRoute.PATCH as never, "PATCH", "/api/v1/admin/medical-questions/reports", admin, {
        reportId: String(report!._id),
        action: "restore",
      });
      expect(restore.status).toBe(200);
      detail = await call(questionRoute.GET as never, "GET", `/api/v1/medical-questions/${id}`, null);
      expect(detail.json.data.answers).toHaveLength(1);
    });
  });
});
