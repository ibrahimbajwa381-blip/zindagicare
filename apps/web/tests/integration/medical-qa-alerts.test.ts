/**
 * QA-ALERTS — new-question alerts to verified professionals.
 *
 * Real local MongoDB (mongodb-memory-server, ephemeral — never Atlas, never
 * production) + REAL route handlers + REAL MedicalQaService/MedicalQaAlerts.
 * Push providers (Expo, web push) are mocked: no real notification is sent.
 * The after-response scheduler is spied so route tests can assert when
 * processing is (and is not) triggered. Redis is never reached.
 */
import { MongoMemoryServer } from "mongodb-memory-server";
import { randomBytes } from "crypto";
import type { Role } from "@zindagi/shared";
import { MedicalQaCategories, type MedicalQaCategory } from "@zindagi/validators";
import { topicRecipientRule } from "@/server/lib/medical-qa-alert-rules";

/**
 * The intended routing, written out independently of the app's table on
 * purpose: tests driven from the app's own table would follow any mistake
 * in it. Changing who a topic reaches must change this list too.
 */
const EXPECTED_SPECIALTY_ROUTING: Record<string, string[]> = {
  skin: ["Dermatologist", "Cosmetologist", "Aesthetic Physician"],
  "mental-health": ["Psychiatrist", "Psychologist", "Counselor", "Pediatric Psychologist"],
  "heart-bp": ["Cardiologist", "Interventional Cardiologist", "Hypertension Specialist"],
  children: ["Pediatrician", "Neonatologist"],
  women: ["Gynecologist", "Obstetrician", "Fertility Consultant"],
  diabetes: ["Diabetologist", "Endocrinologist"],
  stomach: ["Gastroenterologist", "Hepatologist"],
  "bones-joints": ["Orthopedic Surgeon", "Pain Management Specialist"],
};
const SPECIALTY_TOPICS = Object.entries(EXPECTED_SPECIALTY_ROUTING).map(([topic, specialties]) => ({
  topic: topic as MedicalQaCategory,
  specialties,
}));

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

const scheduleSpy = jest.fn();
jest.mock("@/server/lib/schedule-question-alerts", () => ({
  scheduleQuestionAlerts: (...args: unknown[]) => scheduleSpy(...args),
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

describe("Medical Q&A new-question alerts (real local MongoDB)", () => {
  let mongod: InstanceType<typeof MongoMemoryServer>;
  let mongooseMod: typeof import("mongoose");
  let db: typeof import("@zindagi/database");
  let Roles: typeof import("@zindagi/shared").Roles;
  let signMobileAccessToken: typeof import("@/server/api/mobile-jwt").signMobileAccessToken;
  let questionsRoute: typeof import("@/app/api/v1/medical-questions/route");
  let prefsRoute: typeof import("@/app/api/v1/medical-questions/alert-preferences/route");
  let Alerts: typeof import("@/server/services/medical-qa-alerts.service").MedicalQaAlerts;
  let QaService: typeof import("@/server/services/medical-qa.service").MedicalQaService;

  let counter = 0;
  const uniq = () => `${Date.now()}-${counter++}`;

  async function makeUser(roles: Role[], extra: Record<string, unknown> = {}) {
    return db.UserModel.create({
      name: "Synthetic",
      email: `alert-${uniq()}@test.local`,
      phone: `+92300${Math.floor(1000000 + Math.random() * 9000000)}`,
      roles,
      ...extra,
    });
  }

  type Status = "pending" | "approved" | "rejected" | "restricted";

  async function makeDoctor(
    specialties: string[] = ["General Physician"],
    opts: { status?: Status; user?: Record<string, unknown>; profile?: Record<string, unknown> } = {},
  ) {
    const user = await makeUser([Roles.DOCTOR], opts.user);
    await db.DoctorProfileModel.create({
      userId: user._id,
      pmdcNumber: `PMDC-${uniq()}`,
      verificationStatus: opts.status ?? "approved",
      isListed: true,
      specialties,
      consultationFee: 1500,
      ...opts.profile,
    });
    return user;
  }

  async function makeStaff(
    staffType: "nurse" | "physiotherapist",
    opts: { status?: Exclude<Status, "restricted">; user?: Record<string, unknown>; profile?: Record<string, unknown> } = {},
  ) {
    const user = await makeUser([staffType as Role], opts.user);
    await db.StaffProfileModel.create({
      userId: user._id,
      staffType,
      verificationStatus: opts.status ?? "approved",
      isAvailable: true,
      ...opts.profile,
    });
    return user;
  }

  /** Each test runs in a clean slate so recipient sets are exact. */
  async function reset() {
    await Promise.all([
      db.UserModel.deleteMany({}),
      db.DoctorProfileModel.deleteMany({}),
      db.StaffProfileModel.deleteMany({}),
      db.MedicalQuestionModel.deleteMany({}),
      db.MedicalQaAlertModel.deleteMany({}),
      db.MedicalQaAlertPreferenceModel.deleteMany({}),
      db.NotificationModel.deleteMany({}),
    ]);
  }

  async function question(category = "general", title = "Fever and body ache for two days") {
    const author = await makeUser([Roles.PATIENT]);
    const q = await QaService.createQuestion(
      { id: String(author._id), roles: [Roles.PATIENT] },
      { category: category as never, title, body: "Synthetic private details: diabetic, takes metformin 500mg twice daily." },
    );
    return { id: q.id, author };
  }

  const inAppFor = (userId: import("mongoose").Types.ObjectId) =>
    db.NotificationModel.find({ userId, channel: "in_app", "payload.type": "medical_question_new" }).lean();
  const notifiedIds = async (questionId: string) =>
    (await db.MedicalQaAlertModel.find({ questionId }).lean()).map((a) => String(a.recipientId)).sort();
  const ids = (...users: Array<{ _id: unknown }>) => users.map((u) => String(u._id)).sort();

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

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongod.getUri("zindagi_alerts_test");
    process.env.FIELD_ENCRYPTION_KEY = randomBytes(32).toString("base64");
    process.env.AUTH_SECRET = "test-secret-at-least-32-chars-long-12345";

    mongooseMod = (await import("mongoose")).default;
    db = await import("@zindagi/database");
    ({ Roles } = await import("@zindagi/shared"));
    await db.connectDatabase();
    expect(mongooseMod.connection.host).toMatch(/127\.0\.0\.1|localhost/);
    await Promise.all([db.MedicalQaAlertModel.init(), db.MedicalQaAlertPreferenceModel.init(), db.MedicalQuestionModel.init()]);

    ({ signMobileAccessToken } = await import("@/server/api/mobile-jwt"));
    questionsRoute = await import("@/app/api/v1/medical-questions/route");
    prefsRoute = await import("@/app/api/v1/medical-questions/alert-preferences/route");
    ({ MedicalQaAlerts: Alerts } = await import("@/server/services/medical-qa-alerts.service"));
    ({ MedicalQaService: QaService } = await import("@/server/services/medical-qa.service"));
  });

  beforeEach(async () => {
    await reset();
    expoPush.mockReset().mockResolvedValue({ sent: 1, failed: 0 });
    webPush.mockReset().mockResolvedValue({ sent: 0, failed: 0 });
    scheduleSpy.mockReset();
  });

  afterAll(async () => {
    await mongooseMod.disconnect();
    await mongod.stop();
  });

  // ---------------------------------------------------------------------------
  describe("Topic fallback through the real API", () => {
    test("a question with no topic is saved as general and triggers alert processing once", async () => {
      const patient = await makeUser([Roles.PATIENT]);
      const r = await call(questionsRoute.POST as never, "POST", "/api/v1/medical-questions", patient, {
        title: "Headache every morning for a week",
        body: "Synthetic: headache every morning, no fever, sleeping fine.",
      });
      expect(r.status).toBe(200);
      expect(r.json.data.category).toBe("general");
      const stored = await db.MedicalQuestionModel.findById(r.json.data.id).lean();
      expect(stored!.category).toBe("general");
      expect(scheduleSpy).toHaveBeenCalledTimes(1);
      expect(scheduleSpy).toHaveBeenCalledWith(r.json.data.id);
    });

    test.each([null, "", "   "])("topic %p is saved as general", async (category) => {
      const patient = await makeUser([Roles.PATIENT]);
      const r = await call(questionsRoute.POST as never, "POST", "/api/v1/medical-questions", patient, {
        category,
        title: "Knee pain after walking in the evening",
        body: "Synthetic: knee pain after walking, mild swelling, no injury.",
      });
      expect(r.status).toBe(200);
      expect(r.json.data.category).toBe("general");
    });

    test("an invalid topic is rejected and nothing is scheduled", async () => {
      const patient = await makeUser([Roles.PATIENT]);
      const r = await call(questionsRoute.POST as never, "POST", "/api/v1/medical-questions", patient, {
        category: { $ne: null },
        title: "Knee pain after walking in the evening",
        body: "Synthetic: knee pain after walking, mild swelling, no injury.",
      });
      expect(r.status).toBe(400);
      expect(scheduleSpy).not.toHaveBeenCalled();
    });

    test("unauthenticated users cannot post, and nothing is scheduled", async () => {
      const r = await call(questionsRoute.POST as never, "POST", "/api/v1/medical-questions", null, {
        title: "Knee pain after walking in the evening",
        body: "Synthetic: knee pain after walking, mild swelling, no injury.",
      });
      expect(r.status).toBe(401);
      expect(scheduleSpy).not.toHaveBeenCalled();
    });

    test("a failed database save does not trigger notifications", async () => {
      const patient = await makeUser([Roles.PATIENT]);
      const spy = jest.spyOn(db.MedicalQuestionModel, "create").mockRejectedValueOnce(new Error("db down") as never);
      const r = await call(questionsRoute.POST as never, "POST", "/api/v1/medical-questions", patient, {
        title: "Knee pain after walking in the evening",
        body: "Synthetic: knee pain after walking, mild swelling, no injury.",
      });
      spy.mockRestore();
      expect(r.status).toBe(500);
      expect(JSON.stringify(r.json)).not.toMatch(/db down|at \w+ \(/);
      expect(scheduleSpy).not.toHaveBeenCalled();
    });

    test("clients cannot choose recipients or spoof alert fields", async () => {
      const patient = await makeUser([Roles.PATIENT]);
      for (const extra of [{ recipients: ["x"] }, { alertStatus: "done" }, { notify: false }, { role: "doctor" }]) {
        const r = await call(questionsRoute.POST as never, "POST", "/api/v1/medical-questions", patient, {
          title: "Knee pain after walking in the evening",
          body: "Synthetic: knee pain after walking, mild swelling, no injury.",
          ...extra,
        });
        expect(r.status).toBe(400);
      }
      expect(scheduleSpy).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  describe("Recipient matching", () => {
    test("general reaches every eligible verified doctor, not only general physicians", async () => {
      const gp = await makeDoctor(["General Physician"]);
      const derm = await makeDoctor(["Dermatologist"]);
      const cardio = await makeDoctor(["Cardiologist"]);
      await makeStaff("nurse");
      await makeStaff("physiotherapist");
      const q = await question("general");
      await Alerts.processQuestion(q.id, { now: DAYTIME });
      expect(await notifiedIds(q.id)).toEqual(ids(gp, derm, cardio));
    });

    test("physiotherapy reaches verified physiotherapists only", async () => {
      const physio = await makeStaff("physiotherapist");
      await makeStaff("nurse");
      await makeDoctor();
      const q = await question("physiotherapy");
      await Alerts.processQuestion(q.id, { now: DAYTIME });
      expect(await notifiedIds(q.id)).toEqual(ids(physio));
    });

    test("nursing-care reaches verified nurses only", async () => {
      const nurse = await makeStaff("nurse");
      await makeStaff("physiotherapist");
      await makeDoctor();
      const q = await question("nursing-care");
      await Alerts.processQuestion(q.id, { now: DAYTIME });
      expect(await notifiedIds(q.id)).toEqual(ids(nurse));
    });

    test.each([
      ["skin", "Dermatologist"],
      ["mental-health", "Psychiatrist"],
      ["heart-bp", "Cardiologist"],
    ])("%s uses the admin-verified specialties field (%s)", async (topic, specialty) => {
      const match = await makeDoctor([specialty]);
      await makeDoctor(["General Physician"]);
      // Self-claimed primary specialty is NOT trusted for matching.
      await makeDoctor(["General Physician"], { profile: { primarySpecialty: specialty } });
      const q = await question(topic);
      await Alerts.processQuestion(q.id, { now: DAYTIME });
      expect(await notifiedIds(q.id)).toEqual(ids(match));
    });

    test("a specialty topic with no eligible specialist falls back to all eligible doctors", async () => {
      const a = await makeDoctor(["General Physician"]);
      const b = await makeDoctor(["Cardiologist"]);
      await makeDoctor(["Dermatologist"], { status: "pending" });
      const q = await question("skin");
      await Alerts.processQuestion(q.id, { now: DAYTIME });
      expect(await notifiedIds(q.id)).toEqual(ids(a, b));
    });

    test("excludes unverified, restricted, rejected, inactive, deleted, banned and opted-out professionals", async () => {
      const ok = await makeDoctor();
      await makeDoctor(undefined, { status: "pending" });
      await makeDoctor(undefined, { status: "restricted" });
      await makeDoctor(undefined, { status: "rejected" });
      await makeDoctor(undefined, { user: { isActive: false } });
      await makeDoctor(undefined, { user: { deletedAt: new Date() } });
      await makeDoctor(undefined, { profile: { deletedAt: new Date() } });
      await makeDoctor(undefined, { user: { bannedUntil: new Date(DAYTIME.getTime() + 86_400_000) } });
      const optedOut = await makeDoctor();
      await Alerts.setPreference(String(optedOut._id), false);
      // A profile whose account does not hold the doctor role is ignored.
      const patientUser = await makeUser([Roles.PATIENT]);
      await db.DoctorProfileModel.create({
        userId: patientUser._id,
        pmdcNumber: `PMDC-${uniq()}`,
        verificationStatus: "approved",
        specialties: ["General Physician"],
        consultationFee: 1000,
      });
      const q = await question("general");
      await Alerts.processQuestion(q.id, { now: DAYTIME });
      expect(await notifiedIds(q.id)).toEqual(ids(ok));
    });

    test("an expired ban does not exclude a professional", async () => {
      const d = await makeDoctor(undefined, { user: { bannedUntil: new Date(DAYTIME.getTime() - 1000) } });
      const q = await question("general");
      await Alerts.processQuestion(q.id, { now: DAYTIME });
      expect(await notifiedIds(q.id)).toEqual(ids(d));
    });

    test("the author is never alerted about their own question, even if they are a verified doctor", async () => {
      const doc = await makeDoctor();
      const other = await makeDoctor();
      const q = await QaService.createQuestion(
        { id: String(doc._id), roles: [Roles.DOCTOR] },
        { category: "general", title: "Question from a doctor account", body: "Synthetic body text for a doctor's question." },
      );
      await Alerts.processQuestion(q.id, { now: DAYTIME });
      expect(await notifiedIds(q.id)).toEqual(ids(other));
    });

    test("duplicate profile records for one user produce one alert", async () => {
      const d = await makeDoctor();
      // Simulates legacy data written before the unique index existed (in-memory DB only).
      await db.DoctorProfileModel.collection.dropIndex("userId_1").catch(() => undefined);
      await db.DoctorProfileModel.collection.insertOne({
        userId: d._id,
        verificationStatus: "approved",
        specialties: ["General Physician"],
      });
      const q = await question("general");
      await Alerts.processQuestion(q.id, { now: DAYTIME });
      expect((await inAppFor(d._id)).length).toBe(1);
    });
  });

  // ---------------------------------------------------------------------------
  // ---------------------------------------------------------------------------
  // Specialty routing: a question in a specialty topic reaches that topic's
  // specialists — and only them — for every topic and every listed specialty.
  // ---------------------------------------------------------------------------
  describe("Specialty routing — every topic reaches the right doctors", () => {
    test("the app's routing table matches the intended specialty routing exactly", () => {
      const actual: Record<string, string[]> = {};
      for (const topic of MedicalQaCategories) {
        const rule = topicRecipientRule(topic);
        if (rule.kind === "doctors" && rule.specialties) actual[topic] = [...rule.specialties].sort();
      }
      const expected = Object.fromEntries(
        Object.entries(EXPECTED_SPECIALTY_ROUTING).map(([topic, sp]) => [topic, [...sp].sort()]),
      );
      expect(actual).toEqual(expected);
    });

    /**
     * A full roster: one approved doctor for every specialty used by any
     * topic, plus a General Physician, a nurse and a physiotherapist.
     */
    async function fullRoster() {
      const bySpecialty = new Map<string, { _id: unknown }>();
      for (const { specialties } of SPECIALTY_TOPICS) {
        for (const specialty of specialties) {
          if (!bySpecialty.has(specialty)) bySpecialty.set(specialty, await makeDoctor([specialty]));
        }
      }
      const gp = await makeDoctor(["General Physician"]);
      const nurse = await makeStaff("nurse");
      const physio = await makeStaff("physiotherapist");
      return { bySpecialty, gp, nurse, physio };
    }

    test.each(SPECIALTY_TOPICS.map((t) => [t.topic, t.specialties.join(", ")]))(
      "%s reaches exactly its specialists (%s) and no other doctor, nurse or physio",
      async (topic) => {
        const { bySpecialty } = await fullRoster();
        const expected = SPECIALTY_TOPICS.find((t) => t.topic === topic)!.specialties.map((sp) => bySpecialty.get(sp)!);

        const q = await question(topic);
        await Alerts.processQuestion(q.id, { now: DAYTIME });

        expect(await notifiedIds(q.id)).toEqual(ids(...expected));
      },
    );

    test.each(SPECIALTY_TOPICS.flatMap((t) => t.specialties.map((sp) => [t.topic, sp])))(
      "%s: a lone %s is reached directly (no fallback to all doctors)",
      async (topic, specialty) => {
        const specialist = await makeDoctor([specialty as string]);
        await makeDoctor(["General Physician"]); // decoy: would only be reached by the fallback
        const q = await question(topic as string);
        await Alerts.processQuestion(q.id, { now: DAYTIME });
        expect(await notifiedIds(q.id)).toEqual(ids(specialist));
      },
    );

    test("a doctor with several specialties gets each matching topic, and not unrelated ones", async () => {
      const both = await makeDoctor(["Dermatologist", "Cardiologist"]);
      const endo = await makeDoctor(["Endocrinologist"]);

      const skin = await question("skin", "Itchy rash on both arms");
      const heart = await question("heart-bp", "High blood pressure in the mornings");
      const diabetes = await question("diabetes", "Sugar level high after meals");
      for (const q of [skin, heart, diabetes]) await Alerts.processQuestion(q.id, { now: DAYTIME });

      expect(await notifiedIds(skin.id)).toEqual(ids(both));
      expect(await notifiedIds(heart.id)).toEqual(ids(both));
      expect(await notifiedIds(diabetes.id)).toEqual(ids(endo));
    });

    test("a specialist who is not approved or has opted out is skipped; the approved one still gets it", async () => {
      const approved = await makeDoctor(["Pediatrician"]);
      await makeDoctor(["Pediatrician"], { status: "pending" });
      await makeDoctor(["Neonatologist"], { status: "rejected" });
      const optedOut = await makeDoctor(["Neonatologist"]);
      await Alerts.setPreference(String(optedOut._id), false);

      const q = await question("children", "Baby has a fever and is not feeding well");
      await Alerts.processQuestion(q.id, { now: DAYTIME });
      expect(await notifiedIds(q.id)).toEqual(ids(approved));
    });

    test("end to end through the real API: a patient picks Heart & BP; only the cardiologist is notified (in-app + push)", async () => {
      const cardio = await makeDoctor(["Cardiologist"]);
      const derm = await makeDoctor(["Dermatologist"]);
      const gp = await makeDoctor(["General Physician"]);
      const patient = await makeUser([Roles.PATIENT]);

      const r = await call(questionsRoute.POST as never, "POST", "/api/v1/medical-questions", patient, {
        category: "heart-bp",
        title: "Chest tightness when climbing stairs",
        body: "Synthetic: chest tightness on exertion for a week, BP 150/95 at home.",
      });
      expect(r.status).toBe(200);
      expect(r.json.data.category).toBe("heart-bp");
      expect(scheduleSpy).toHaveBeenCalledWith(r.json.data.id);

      // Run the job the route scheduled for after the response.
      await Alerts.processQuestion(r.json.data.id, { now: DAYTIME });

      const [n] = await inAppFor(cardio._id);
      expect(n).toBeDefined();
      expect(n.title).toBe("New question · Heart & blood pressure");
      expect(n.payload).toEqual({
        type: "medical_question_new",
        questionId: r.json.data.id,
        category: "heart-bp",
        url: `/questions/${r.json.data.id}`,
      });
      expect(await inAppFor(derm._id)).toHaveLength(0);
      expect(await inAppFor(gp._id)).toHaveLength(0);
      expect(await inAppFor(patient._id)).toHaveLength(0);

      const pushedTo = new Set([...expoPush.mock.calls, ...webPush.mock.calls].map(([uid]) => String(uid)));
      expect([...pushedTo]).toEqual([String(cardio._id)]);
    });

    test("end to end: the topic label in every specialty alert matches what the patient selected", async () => {
      for (const { topic, specialties } of SPECIALTY_TOPICS) {
        const doctor = await makeDoctor([specialties[0]!]);
        const q = await question(topic, `Question about ${topic}`);
        await Alerts.processQuestion(q.id, { now: DAYTIME });
        const alerts = await db.NotificationModel.find({ userId: doctor._id, "payload.questionId": q.id }).lean();
        expect(alerts).toHaveLength(1);
        expect((alerts[0]!.payload as { category: MedicalQaCategory }).category).toBe(topic);
      }
    });
  });

  describe("Delivery", () => {
    test("persists an in-app notification and sends a privacy-safe push with the question link", async () => {
      const d = await makeDoctor();
      const q = await question("general", "Fever and body ache for two days");
      await Alerts.processQuestion(q.id, { now: DAYTIME });

      const [n] = await inAppFor(d._id);
      expect(n.title).toBe("New question · General health");
      expect(n.body).toContain("Fever and body ache for two days");
      expect(n.payload).toEqual({
        type: "medical_question_new",
        questionId: q.id,
        category: "general",
        url: `/questions/${q.id}`,
      });

      expect(expoPush).toHaveBeenCalledTimes(1);
      const [uid, push] = expoPush.mock.calls[0];
      expect(uid).toBe(String(d._id));
      expect(webPush).toHaveBeenCalledWith(String(d._id), expect.objectContaining({ url: `/questions/${q.id}` }));
      // Neither channel ever carries the private question body, author or photos.
      const everything = JSON.stringify([expoPush.mock.calls, webPush.mock.calls, n]);
      expect(everything).not.toMatch(/metformin|diabetic|attachments|authorId/);
      expect(push.data).toEqual(n.payload);

      const stored = await db.MedicalQuestionModel.findById(q.id).lean();
      expect(stored!.alertStatus).toBe("done");
      expect(stored!.alertRecipientCount).toBe(1);
    });

    test("in-app notifications persist even when every push provider fails", async () => {
      const d = await makeDoctor();
      expoPush.mockRejectedValue(new Error("expo down"));
      webPush.mockRejectedValue(new Error("vapid down"));
      const q = await question();
      await expect(Alerts.processQuestion(q.id, { now: DAYTIME })).resolves.toBeDefined();
      expect((await inAppFor(d._id)).length).toBe(1);
      const alert = await db.MedicalQaAlertModel.findOne({ questionId: q.id }).lean();
      expect(alert!.pushStatus).toBe("failed");
      expect(alert!.pushAttempts).toBe(1);
      const stored = await db.MedicalQuestionModel.findById(q.id).lean();
      expect(stored!.alertStatus).toBe("failed");
      expect(stored!.alertNextAttemptAt!.getTime()).toBeGreaterThan(DAYTIME.getTime());
    });

    test("Expo and web push fail independently: one failing does not block the other", async () => {
      const d = await makeDoctor();
      expoPush.mockRejectedValue(new Error("expo down"));
      webPush.mockResolvedValue({ sent: 1, failed: 0 });
      const q = await question();
      await Alerts.processQuestion(q.id, { now: DAYTIME });
      expect(webPush).toHaveBeenCalledWith(String(d._id), expect.anything());
      const alert = await db.MedicalQaAlertModel.findOne({ questionId: q.id }).lean();
      expect(alert!.pushStatus).toBe("sent");
    });

    test("a professional with no registered devices is marked no_device, not failed", async () => {
      await makeDoctor();
      expoPush.mockResolvedValue({ sent: 0, failed: 0 });
      webPush.mockResolvedValue({ sent: 0, failed: 0 });
      const q = await question();
      await Alerts.processQuestion(q.id, { now: DAYTIME });
      const alert = await db.MedicalQaAlertModel.findOne({ questionId: q.id }).lean();
      expect(alert!.pushStatus).toBe("no_device");
      expect((await db.MedicalQuestionModel.findById(q.id).lean())!.alertStatus).toBe("done");
    });

    test("a hanging provider is cut off by the timeout instead of blocking processing", async () => {
      await makeDoctor();
      expoPush.mockImplementation(() => new Promise(() => {}));
      const q = await question();
      const started = Date.now();
      await Alerts.processQuestion(q.id, { now: DAYTIME, pushTimeoutMs: 200 });
      expect(Date.now() - started).toBeLessThan(5000);
      const alert = await db.MedicalQaAlertModel.findOne({ questionId: q.id }).lean();
      expect(alert!.pushStatus).toBe("failed");
    });

    test("quiet hours keep the in-app notification but skip the push", async () => {
      const d = await makeDoctor();
      const q = await question();
      await Alerts.processQuestion(q.id, { now: NIGHT });
      expect((await inAppFor(d._id)).length).toBe(1);
      expect(expoPush).not.toHaveBeenCalled();
      expect(webPush).not.toHaveBeenCalled();
      expect((await db.MedicalQaAlertModel.findOne({ questionId: q.id }).lean())!.pushStatus).toBe("quiet_hours");
    });

    test("per-professional push throttle: a burst of questions sends one push, but every in-app alert is kept", async () => {
      const d = await makeDoctor();
      const qs = [await question(), await question(), await question()];
      for (const q of qs) await Alerts.processQuestion(q.id, { now: DAYTIME });
      expect((await inAppFor(d._id)).length).toBe(3);
      expect(expoPush).toHaveBeenCalledTimes(1);
      const statuses = (await db.MedicalQaAlertModel.find({ recipientId: d._id }).lean()).map((a) => a.pushStatus).sort();
      expect(statuses).toEqual(["sent", "throttled", "throttled"]);
    });
  });

  // ---------------------------------------------------------------------------
  describe("Idempotency, retries and concurrency", () => {
    test("processing the same question twice creates no duplicate notifications or pushes", async () => {
      const d = await makeDoctor();
      const q = await question();
      await Alerts.processQuestion(q.id, { now: DAYTIME });
      await Alerts.processQuestion(q.id, { now: DAYTIME });
      expect((await inAppFor(d._id)).length).toBe(1);
      expect(expoPush).toHaveBeenCalledTimes(1);
    });

    test("concurrent workers on the same question produce exactly one alert per professional", async () => {
      const docs = await Promise.all([makeDoctor(), makeDoctor(), makeDoctor()]);
      const q = await question();
      await Promise.all(Array.from({ length: 5 }, () => Alerts.processQuestion(q.id, { now: DAYTIME })));
      for (const d of docs) expect((await inAppFor(d._id)).length).toBe(1);
      expect(await db.MedicalQaAlertModel.countDocuments({ questionId: q.id })).toBe(3);
      expect(expoPush).toHaveBeenCalledTimes(3);
    });

    test("a duplicate (idempotent) API submission does not alert twice", async () => {
      const d = await makeDoctor();
      const patient = await makeUser([Roles.PATIENT]);
      const body = {
        title: "Chest tightness when climbing stairs",
        body: "Synthetic: chest tightness when climbing stairs, settles with rest.",
        idempotencyKey: "4f9e3b8a-1c2d-4e5f-8a9b-0c1d2e3f4a5b",
      };
      const [a, b] = await Promise.all([
        call(questionsRoute.POST as never, "POST", "/api/v1/medical-questions", patient, body),
        call(questionsRoute.POST as never, "POST", "/api/v1/medical-questions", patient, body),
      ]);
      expect(a.json.data.id).toBe(b.json.data.id);
      for (const [id] of scheduleSpy.mock.calls) await Alerts.processQuestion(id, { now: DAYTIME });
      expect((await inAppFor(d._id)).length).toBe(1);
    });

    test("transient push failures retry with backoff and stop after the attempt limit", async () => {
      const d = await makeDoctor();
      expoPush.mockRejectedValue(new Error("expo down"));
      const q = await question();
      let now = DAYTIME;
      await Alerts.processQuestion(q.id, { now });

      // Not due yet: the sweep leaves it alone.
      expect(await Alerts.sweepPending({ now })).toBe(0);

      for (let i = 0; i < 10; i++) {
        now = new Date(now.getTime() + 2 * 60 * 60 * 1000);
        await Alerts.sweepPending({ now });
      }
      const alert = await db.MedicalQaAlertModel.findOne({ questionId: q.id }).lean();
      const stored = await db.MedicalQuestionModel.findById(q.id).lean();
      expect(stored!.alertAttempts).toBeLessThanOrEqual(4);
      expect(alert!.pushAttempts).toBeLessThanOrEqual(4);
      expect(expoPush.mock.calls.length).toBeLessThanOrEqual(4);
      // Retries never duplicate the in-app record.
      expect((await inAppFor(d._id)).length).toBe(1);
    });

    test("a retry delivers the push once the provider recovers, without re-sending to those already reached", async () => {
      const ok = await makeDoctor();
      const flaky = await makeDoctor();
      expoPush.mockImplementation(async (uid: string) => {
        if (uid === String(flaky._id)) throw new Error("timeout");
        return { sent: 1, failed: 0 };
      });
      const q = await question();
      await Alerts.processQuestion(q.id, { now: DAYTIME });
      expoPush.mockReset().mockResolvedValue({ sent: 1, failed: 0 });
      await Alerts.sweepPending({ now: new Date(DAYTIME.getTime() + 60 * 60 * 1000) });
      expect(expoPush.mock.calls.map(([uid]) => uid)).toEqual([String(flaky._id)]);
      const statuses = await db.MedicalQaAlertModel.find({ questionId: q.id }).lean();
      expect(statuses.every((a) => a.pushStatus === "sent")).toBe(true);
      expect((await db.MedicalQuestionModel.findById(q.id).lean())!.alertStatus).toBe("done");
      expect((await inAppFor(ok._id)).length).toBe(1);
    });

    test("deleted or hidden questions are never alerted (and stale retries stop)", async () => {
      await makeDoctor();
      const deleted = await question();
      await db.MedicalQuestionModel.updateOne({ _id: deleted.id }, { $set: { deletedAt: new Date() } });
      const hidden = await question();
      await db.MedicalQuestionModel.updateOne({ _id: hidden.id }, { $set: { moderationStatus: "hidden" } });
      await Alerts.processQuestion(deleted.id, { now: DAYTIME });
      await Alerts.processQuestion(hidden.id, { now: DAYTIME });
      expect(await db.MedicalQaAlertModel.countDocuments({})).toBe(0);
      expect(expoPush).not.toHaveBeenCalled();
    });

    test("malformed question ids are ignored safely", async () => {
      await expect(Alerts.processQuestion("not-an-id", { now: DAYTIME })).resolves.toEqual({ processed: false });
      await expect(Alerts.processQuestion({ $gt: "" } as never, { now: DAYTIME })).resolves.toEqual({ processed: false });
    });
  });

  // ---------------------------------------------------------------------------
  describe("Alert preference API", () => {
    test("requires sign-in", async () => {
      expect((await call(prefsRoute.GET as never, "GET", "/api/v1/medical-questions/alert-preferences", null)).status).toBe(401);
      expect(
        (await call(prefsRoute.PUT as never, "PUT", "/api/v1/medical-questions/alert-preferences", null, { questionAlerts: false })).status,
      ).toBe(401);
    });

    test("defaults to on, and a professional can turn alerts off for themselves only", async () => {
      const a = await makeDoctor();
      const b = await makeDoctor();
      let r = await call(prefsRoute.GET as never, "GET", "/api/v1/medical-questions/alert-preferences", a);
      expect(r.json.data).toEqual({ questionAlerts: true, eligible: true });

      r = await call(prefsRoute.PUT as never, "PUT", "/api/v1/medical-questions/alert-preferences", a, { questionAlerts: false });
      expect(r.status).toBe(200);
      expect(r.json.data.questionAlerts).toBe(false);

      const q = await question();
      await Alerts.processQuestion(q.id, { now: DAYTIME });
      expect(await notifiedIds(q.id)).toEqual(ids(b));
    });

    test("cannot target another user's preference (IDOR) or send unexpected fields", async () => {
      const a = await makeDoctor();
      const b = await makeDoctor();
      for (const body of [
        { questionAlerts: false, userId: String(b._id) },
        { questionAlerts: "false" },
        { questionAlerts: { $ne: true } },
        {},
      ]) {
        const r = await call(prefsRoute.PUT as never, "PUT", "/api/v1/medical-questions/alert-preferences", a, body);
        expect(r.status).toBe(400);
      }
      expect(await Alerts.getPreference(String(b._id))).toBe(true);
    });

    test("patients see eligible: false", async () => {
      const p = await makeUser([Roles.PATIENT]);
      const r = await call(prefsRoute.GET as never, "GET", "/api/v1/medical-questions/alert-preferences", p);
      expect(r.json.data).toEqual({ questionAlerts: true, eligible: false });
    });
  });
});
