/**
 * CHAT-001..008 — P0 Chat API, Authorization, Pagination & Attachment Security Audit.
 *
 * Real local MongoDB (mongodb-memory-server, ephemeral — never Atlas, never
 * production) + REAL route handlers (imported and invoked directly) +
 * REAL auth (resolveSession / mobile JWT, signed with test AUTH_SECRET) +
 * REAL ChatService and storage validation logic.
 *
 * Only Supabase network I/O is mocked with buildObjectStorageDouble.
 */
import { MongoMemoryServer } from "mongodb-memory-server";
import { randomBytes } from "crypto";
import { buildObjectStorageDouble } from "../helpers/object-storage-double";
import {
  makeValidJpeg,
  makeValidPdf,
  toFile,
} from "../helpers/synthetic-files";

jest.setTimeout(60000);

const objectStorageDouble = buildObjectStorageDouble();

jest.mock("@/server/lib/object-storage", () => {
  const actual = jest.requireActual("@/server/lib/object-storage");
  return {
    ...actual,
    isObjectStorageConfigured: () => true,
    putObject: (...args: Parameters<typeof objectStorageDouble.putObject>) =>
      objectStorageDouble.putObject(...args),
    getObject: (...args: Parameters<typeof objectStorageDouble.getObject>) =>
      objectStorageDouble.getObject(...args),
    deleteObject: (...args: Parameters<typeof objectStorageDouble.deleteObject>) =>
      objectStorageDouble.deleteObject(...args),
  };
});

// Mock web cookie auth; mobile Bearer-token path runs unmocked
jest.mock("@/lib/auth", () => ({ auth: async () => null }));

describe("Chat API & Security Audit (real local MongoDB)", () => {
  let mongod: InstanceType<typeof MongoMemoryServer>;
  let mongooseMod: typeof import("mongoose");
  let UserModel: typeof import("@zindagi/database").UserModel;
  let DoctorProfileModel: typeof import("@zindagi/database").DoctorProfileModel;
  let AppointmentModel: typeof import("@zindagi/database").AppointmentModel;
  let PaymentModel: typeof import("@zindagi/database").PaymentModel;
  let ChatThreadModel: typeof import("@zindagi/database").ChatThreadModel;
  let ChatMessageModel: typeof import("@zindagi/database").ChatMessageModel;
  let Roles: typeof import("@zindagi/shared").Roles;
  let AppointmentTypes: typeof import("@zindagi/shared").AppointmentTypes;
  let AppointmentStatuses: typeof import("@zindagi/shared").AppointmentStatuses;
  let PaymentStatuses: typeof import("@zindagi/shared").PaymentStatuses;
  let VerificationStatuses: typeof import("@zindagi/shared").VerificationStatuses;
  let ChatThreadTypes: typeof import("@zindagi/shared").ChatThreadTypes;
  let ChatMessageKinds: typeof import("@zindagi/shared").ChatMessageKinds;
  let signMobileAccessToken: typeof import("@/server/api/mobile-jwt").signMobileAccessToken;

  let threadsRoute: typeof import("@/app/api/v1/chat/threads/route");
  let messagesRoute: typeof import("@/app/api/v1/chat/threads/[threadId]/messages/route");
  let readRoute: typeof import("@/app/api/v1/chat/threads/[threadId]/read/route");
  let uploadRoute: typeof import("@/app/api/v1/chat/attachments/upload/route");
  let attachmentRoute: typeof import("@/app/api/v1/chat/attachments/[...key]/route");
  let ChatService: typeof import("@/server/services/chat.service").ChatService;

  let counter = 0;
  const nextEmail = () => `chat-audit-${Date.now()}-${counter++}@test.local`;

  async function createPatientUser(name = "Test Patient") {
    return UserModel.create({
      name,
      email: nextEmail(),
      phone: `+92300${Math.floor(1000000 + Math.random() * 9000000)}`,
      roles: [Roles.PATIENT],
    });
  }

  async function createDoctorUser(name = "Test Doctor", approved = true, listed = true) {
    const user = await UserModel.create({
      name,
      email: nextEmail(),
      phone: `+92301${Math.floor(1000000 + Math.random() * 9000000)}`,
      roles: [Roles.DOCTOR, Roles.PATIENT],
    });

    const profile = await DoctorProfileModel.create({
      userId: user._id,
      pmdcNumber: `PMDC-${Date.now()}-${counter++}`,
      verificationStatus: approved
        ? VerificationStatuses.APPROVED
        : VerificationStatuses.PENDING,
      isListed: listed,
      specialties: ["General Physician"],
      consultationFee: 1500,
    });

    return { user, profile };
  }

  async function createPaidAppointment(patientUserId: string, doctorProfileId: string) {
    const appointment = await AppointmentModel.create({
      patientId: patientUserId,
      doctorId: doctorProfileId,
      type: AppointmentTypes.ONLINE,
      status: AppointmentStatuses.CONFIRMED,
      scheduledStart: new Date(Date.now() - 3600000),
      scheduledEnd: new Date(Date.now() + 3600000),
    });

    const payment = await PaymentModel.create({
      userId: patientUserId,
      appointmentId: appointment._id,
      amount: 1500,
      status: PaymentStatuses.PAID,
      provider: "jazzcash",
    });

    await AppointmentModel.updateOne(
      { _id: appointment._id },
      { $set: { paymentId: payment._id } },
    );

    return { appointment, payment };
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
    process.env.MONGODB_URI = mongod.getUri("chat_api_audit");
    process.env.FIELD_ENCRYPTION_KEY = randomBytes(32).toString("base64");
    process.env.AUTH_SECRET = "test-secret-at-least-32-chars-long-12345";

    const db = await import("@zindagi/database");
    UserModel = db.UserModel;
    DoctorProfileModel = db.DoctorProfileModel;
    AppointmentModel = db.AppointmentModel;
    PaymentModel = db.PaymentModel;
    ChatThreadModel = db.ChatThreadModel;
    ChatMessageModel = db.ChatMessageModel;
    mongooseMod = (await import("mongoose")).default;

    const shared = await import("@zindagi/shared");
    Roles = shared.Roles;
    AppointmentTypes = shared.AppointmentTypes;
    AppointmentStatuses = shared.AppointmentStatuses;
    PaymentStatuses = shared.PaymentStatuses;
    VerificationStatuses = shared.VerificationStatuses;
    ChatThreadTypes = shared.ChatThreadTypes;
    ChatMessageKinds = shared.ChatMessageKinds;

    await db.connectDatabase();

    ({ signMobileAccessToken } = await import("@/server/api/mobile-jwt"));
    threadsRoute = await import("@/app/api/v1/chat/threads/route");
    messagesRoute = await import("@/app/api/v1/chat/threads/[threadId]/messages/route");
    readRoute = await import("@/app/api/v1/chat/threads/[threadId]/read/route");
    uploadRoute = await import("@/app/api/v1/chat/attachments/upload/route");
    attachmentRoute = await import("@/app/api/v1/chat/attachments/[...key]/route");
    ({ ChatService } = await import("@/server/services/chat.service"));
  });

  afterEach(() => {
    objectStorageDouble.store.clear();
    objectStorageDouble.setFailNextPut(null);
    objectStorageDouble.setFailNextGet(null);
  });

  afterAll(async () => {
    await mongooseMod.disconnect();
    await mongod.stop();
  });

  // =========================================================================
  // CHAT-001: Create Conversation
  // =========================================================================
  describe("CHAT-001 — Create Conversation", () => {
    test("unauthenticated request is rejected with 401", async () => {
      const req = new Request("http://localhost/api/v1/chat/threads", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ participantId: new mongooseMod.Types.ObjectId().toString() }),
      });
      const res = await threadsRoute.POST(req as never);
      expect(res.status).toBe(401);
    });

    test("conversation creation requires a doctor-patient pairing", async () => {
      const patient1 = await createPatientUser("Patient 1");
      const patient2 = await createPatientUser("Patient 2");

      const req = new Request("http://localhost/api/v1/chat/threads", {
        method: "POST",
        headers: await authHeaders(patient1._id.toString()),
        body: JSON.stringify({ participantId: patient2._id.toString() }),
      });
      const res = await threadsRoute.POST(req as never);
      const json = await res.json();
      expect(res.status).toBe(403);
      expect(json.error.code).toBe("FORBIDDEN");
    });

    test("conversation creation rejected if doctor is not approved", async () => {
      const patient = await createPatientUser("Patient Unapproved");
      const { user: docUser, profile: docProfile } = await createDoctorUser("Unapproved Doc", false, true);
      await createPaidAppointment(patient._id.toString(), docProfile._id.toString());

      const req = new Request("http://localhost/api/v1/chat/threads", {
        method: "POST",
        headers: await authHeaders(patient._id.toString()),
        body: JSON.stringify({ participantId: docUser._id.toString() }),
      });
      const res = await threadsRoute.POST(req as never);
      const json = await res.json();
      expect(res.status).toBe(403);
      expect(json.error.code).toBe("FORBIDDEN");
    });

    test("conversation creation rejected if no paid appointment exists", async () => {
      const patient = await createPatientUser("Patient No Appt");
      const { user: docUser } = await createDoctorUser("Doctor No Appt", true, true);

      const req = new Request("http://localhost/api/v1/chat/threads", {
        method: "POST",
        headers: await authHeaders(patient._id.toString()),
        body: JSON.stringify({ participantId: docUser._id.toString() }),
      });
      const res = await threadsRoute.POST(req as never);
      const json = await res.json();
      expect(res.status).toBe(403);
      expect(json.error.code).toBe("FORBIDDEN");
    });

    test("valid conversation creation succeeds and returns persisted thread", async () => {
      const patient = await createPatientUser("Patient Valid");
      const { user: docUser, profile: docProfile } = await createDoctorUser("Doctor Valid", true, true);
      await createPaidAppointment(patient._id.toString(), docProfile._id.toString());

      const req = new Request("http://localhost/api/v1/chat/threads", {
        method: "POST",
        headers: await authHeaders(patient._id.toString()),
        body: JSON.stringify({ participantId: docUser._id.toString() }),
      });
      const res = await threadsRoute.POST(req as never);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.id).toBeDefined();
      expect(json.data.type).toBe(ChatThreadTypes.DIRECT);
      expect(json.data.otherParticipant.id).toBe(docUser._id.toString());

      // DB verification
      const dbThread = await ChatThreadModel.findById(json.data.id).lean();
      expect(dbThread).toBeDefined();
      expect(dbThread?.participantIds.map((p) => p.toString())).toEqual(
        expect.arrayContaining([patient._id.toString(), docUser._id.toString()]),
      );
    });

    test("repeated creation is idempotent and reuses existing thread", async () => {
      const patient = await createPatientUser("Patient Repeat");
      const { user: docUser, profile: docProfile } = await createDoctorUser("Doctor Repeat", true, true);
      await createPaidAppointment(patient._id.toString(), docProfile._id.toString());

      const createReq = async () =>
        threadsRoute.POST(
          new Request("http://localhost/api/v1/chat/threads", {
            method: "POST",
            headers: await authHeaders(patient._id.toString()),
            body: JSON.stringify({ participantId: docUser._id.toString() }),
          }) as never,
        );

      const res1 = await createReq();
      const json1 = await res1.json();
      const res2 = await createReq();
      const json2 = await res2.json();

      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);
      expect(json1.data.id).toBe(json2.data.id);

      // Verify no duplicate documents in DB
      const threadsCount = await ChatThreadModel.countDocuments({
        participantIds: { $all: [patient._id.toString(), docUser._id.toString()] },
        deletedAt: null,
      });
      expect(threadsCount).toBe(1);
    });

    test("concurrent conversation creation does not crash or create duplicates", async () => {
      const patient = await createPatientUser("Patient Concurrent");
      const { user: docUser, profile: docProfile } = await createDoctorUser("Doctor Concurrent", true, true);
      await createPaidAppointment(patient._id.toString(), docProfile._id.toString());

      const n = 10;
      const promises = Array.from({ length: n }, async () =>
        threadsRoute.POST(
          new Request("http://localhost/api/v1/chat/threads", {
            method: "POST",
            headers: await authHeaders(patient._id.toString()),
            body: JSON.stringify({ participantId: docUser._id.toString() }),
          }) as never,
        ),
      );

      const results = await Promise.all(promises);
      const jsonResults = await Promise.all(results.map((r) => r.json()));

      for (const res of results) {
        expect(res.status).toBe(200);
      }

      const threadIds = new Set(jsonResults.map((j) => j.data.id));
      expect(threadIds.size).toBe(1); // Exactly 1 thread returned across all calls

      const count = await ChatThreadModel.countDocuments({
        participantIds: { $all: [patient._id.toString(), docUser._id.toString()] },
        deletedAt: null,
      });
      expect(count).toBe(1);
    });
  });

  // =========================================================================
  // CHAT-002 & CHAT-003: Send & Receive Message
  // =========================================================================
  describe("CHAT-002 & CHAT-003 — Send & Receive Message", () => {
    let patientId: string;
    let doctorUserId: string;
    let threadId: string;

    beforeEach(async () => {
      const patient = await createPatientUser("Msg Patient");
      const { user: docUser, profile: docProfile } = await createDoctorUser("Msg Doctor", true, true);
      const { appointment } = await createPaidAppointment(patient._id.toString(), docProfile._id.toString());

      patientId = patient._id.toString();
      doctorUserId = docUser._id.toString();
      threadId = await ChatService.ensureAppointmentThread(appointment._id.toString());
    });

    test("participant can send message, persisted correctly in database", async () => {
      const req = new Request(`http://localhost/api/v1/chat/threads/${threadId}/messages`, {
        method: "POST",
        headers: await authHeaders(patientId),
        body: JSON.stringify({ body: "Hello Doctor, this is my test message." }),
      });

      const res = await messagesRoute.POST(req, {
        params: Promise.resolve({ threadId }),
      });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.id).toBeDefined();
      expect(json.data.body).toBe("Hello Doctor, this is my test message.");
      expect(json.data.senderId).toBe(patientId);
      expect(json.data.threadId).toBe(threadId);
      expect(json.data.isMine).toBe(true);

      // Verify DB persistence
      const dbMsg = await ChatMessageModel.findById(json.data.id).lean();
      expect(dbMsg).toBeDefined();
      expect(dbMsg?.body).toBe("Hello Doctor, this is my test message.");
      expect(dbMsg?.senderId?.toString()).toBe(patientId);
      expect(dbMsg?.threadId?.toString()).toBe(threadId);

      // Verify thread metadata updated
      const dbThread = await ChatThreadModel.findById(threadId).lean();
      expect(dbThread?.lastMessagePreview).toBe("Hello Doctor, this is my test message.");
      expect(dbThread?.lastMessageAt).toBeDefined();
    });

    test("recipient receives message correctly in message list", async () => {
      // Patient sends
      await ChatService.sendMessage(threadId, patientId, "Message for doctor to receive");

      // Doctor fetches messages
      const req = new Request(`http://localhost/api/v1/chat/threads/${threadId}/messages`, {
        method: "GET",
        headers: await authHeaders(doctorUserId),
      });

      const res = await messagesRoute.GET(req, {
        params: Promise.resolve({ threadId }),
      });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.messages.length).toBe(1);
      const received = json.data.messages[0];
      expect(received.body).toBe("Message for doctor to receive");
      expect(received.senderId).toBe(patientId);
      expect(received.isMine).toBe(false); // isMine false for Doctor
    });

    test("read receipts are tracked and updated", async () => {
      const msg = await ChatService.sendMessage(threadId, patientId, "Unread message");
      expect(msg.readBy).toEqual([patientId]);

      // Doctor marks thread as read
      const req = new Request(`http://localhost/api/v1/chat/threads/${threadId}/read`, {
        method: "PATCH",
        headers: await authHeaders(doctorUserId),
      });

      const res = await readRoute.PATCH(req, {
        params: Promise.resolve({ threadId }),
      });
      expect(res.status).toBe(200);

      // Verify message has doctor in readBy
      const dbMsg = await ChatMessageModel.findById(msg.id).lean();
      expect(dbMsg?.readBy?.map((r) => r.userId?.toString())).toContain(doctorUserId);
    });
  });

  // =========================================================================
  // CHAT-004: Send Empty / Malformed Message
  // =========================================================================
  describe("CHAT-004 — Send Empty Message", () => {
    let patientId: string;
    let threadId: string;

    beforeEach(async () => {
      const patient = await createPatientUser("Empty Msg Patient");
      const { user: docUser, profile: docProfile } = await createDoctorUser("Empty Msg Doctor", true, true);
      const { appointment } = await createPaidAppointment(patient._id.toString(), docProfile._id.toString());
      patientId = patient._id.toString();
      threadId = await ChatService.ensureAppointmentThread(appointment._id.toString());
    });

    const invalidBodies = [
      { name: "null body", payload: { body: null } },
      { name: "empty string", payload: { body: "" } },
      { name: "whitespace string", payload: { body: "    " } },
      { name: "newline only", payload: { body: "\n\n\n" } },
      { name: "tabs only", payload: { body: "\t\t" } },
      { name: "missing body field", payload: {} },
      { name: "numeric body", payload: { body: 12345 } },
      { name: "array body", payload: { body: ["hello"] } },
    ];

    for (const { name, payload } of invalidBodies) {
      test(`rejects ${name} with 400 and does not persist message`, async () => {
        const initialCount = await ChatMessageModel.countDocuments({ threadId });

        const req = new Request(`http://localhost/api/v1/chat/threads/${threadId}/messages`, {
          method: "POST",
          headers: await authHeaders(patientId),
          body: JSON.stringify(payload),
        });

        const res = await messagesRoute.POST(req, {
          params: Promise.resolve({ threadId }),
        });
        const json = await res.json();

        expect(res.status).toBe(400);
        expect(json.success).toBe(false);
        expect(json.error.code).toBe("VALIDATION_ERROR");

        // Verify no message persisted
        const postCount = await ChatMessageModel.countDocuments({ threadId });
        expect(postCount).toBe(initialCount);
      });
    }
  });

  // =========================================================================
  // CHAT-005 & CHAT-006: Attachments & Voice Notes
  // =========================================================================
  describe("CHAT-005 & CHAT-006 — Attachments & Voice Notes", () => {
    let patientId: string;
    let doctorUserId: string;
    let threadId: string;

    beforeEach(async () => {
      const patient = await createPatientUser("Attach Patient");
      const { user: docUser, profile: docProfile } = await createDoctorUser("Attach Doctor", true, true);
      const { appointment } = await createPaidAppointment(patient._id.toString(), docProfile._id.toString());
      patientId = patient._id.toString();
      doctorUserId = docUser._id.toString();
      threadId = await ChatService.ensureAppointmentThread(appointment._id.toString());
    });

    test("valid image attachment can be uploaded and attached to message", async () => {
      const jpegBuf = await makeValidJpeg();
      const file = toFile(jpegBuf, "test-report.jpg", "image/jpeg");

      const fd = new FormData();
      fd.append("threadId", threadId);
      fd.append("file", file);

      const uploadReq = new Request("http://localhost/api/v1/chat/attachments/upload", {
        method: "POST",
        headers: { authorization: (await authHeaders(patientId)).authorization },
        body: fd,
      });

      const uploadRes = await uploadRoute.POST(uploadReq);
      const uploadJson = await uploadRes.json();

      expect(uploadRes.status).toBe(200);
      expect(uploadJson.success).toBe(true);
      expect(uploadJson.data.url).toBeDefined();
      expect(uploadJson.data.storageKey).toBeDefined();

      // Send message with attachment
      const sendReq = new Request(`http://localhost/api/v1/chat/threads/${threadId}/messages`, {
        method: "POST",
        headers: await authHeaders(patientId),
        body: JSON.stringify({
          body: "Here is my blood test report",
          attachmentUrl: uploadJson.data.url,
          attachmentMime: "image/jpeg",
        }),
      });

      const sendRes = await messagesRoute.POST(sendReq, {
        params: Promise.resolve({ threadId }),
      });
      const sendJson = await sendRes.json();

      expect(sendRes.status).toBe(200);
      expect(sendJson.data.attachmentUrl).toBe(uploadJson.data.url);
      expect(sendJson.data.attachmentMime).toBe("image/jpeg");

      // Doctor can download attachment
      const keyParts = uploadJson.data.storageKey.split("/");
      const dlReq = new Request(`http://localhost${uploadJson.data.url}`, {
        headers: await authHeaders(doctorUserId),
      });

      const dlRes = await attachmentRoute.GET(dlReq, {
        params: Promise.resolve({ key: keyParts }),
      });
      expect(dlRes.status).toBe(200);
      expect(dlRes.headers.get("content-type")).toBe("image/jpeg");
    });

    test("valid voice note (audio/webm) can be uploaded and sent without body", async () => {
      const audioBytes = Buffer.from([0x1A, 0x45, 0xDF, 0xA3, 0x01, 0x02, 0x03, 0x04]);
      const file = toFile(audioBytes, "voice-note.webm", "audio/webm");

      const fd = new FormData();
      fd.append("threadId", threadId);
      fd.append("file", file);

      const uploadReq = new Request("http://localhost/api/v1/chat/attachments/upload", {
        method: "POST",
        headers: { authorization: (await authHeaders(patientId)).authorization },
        body: fd,
      });

      const uploadRes = await uploadRoute.POST(uploadReq);
      const uploadJson = await uploadRes.json();
      expect(uploadRes.status).toBe(200);

      // Send voice note with empty body
      const sendReq = new Request(`http://localhost/api/v1/chat/threads/${threadId}/messages`, {
        method: "POST",
        headers: await authHeaders(patientId),
        body: JSON.stringify({
          body: "",
          attachmentUrl: uploadJson.data.url,
          attachmentMime: "audio/webm",
        }),
      });

      const sendRes = await messagesRoute.POST(sendReq, {
        params: Promise.resolve({ threadId }),
      });
      const sendJson = await sendRes.json();

      expect(sendRes.status).toBe(200);
      expect(sendJson.data.attachmentMime).toBe("audio/webm");

      // Verify thread preview says "🎤 Voice note"
      const dbThread = await ChatThreadModel.findById(threadId).lean();
      expect(dbThread?.lastMessagePreview).toBe("🎤 Voice note");
    });

    test("rejects unsupported attachment mime type", async () => {
      const badFile = toFile(Buffer.from("echo evil"), "script.sh", "application/x-sh");
      const fd = new FormData();
      fd.append("threadId", threadId);
      fd.append("file", badFile);

      const uploadReq = new Request("http://localhost/api/v1/chat/attachments/upload", {
        method: "POST",
        headers: { authorization: (await authHeaders(patientId)).authorization },
        body: fd,
      });

      const uploadRes = await uploadRoute.POST(uploadReq);
      expect(uploadRes.status).toBe(400);
    });

    test("rejects empty attachment file (0 bytes)", async () => {
      const emptyFile = toFile(Buffer.alloc(0), "empty.jpg", "image/jpeg");
      const fd = new FormData();
      fd.append("threadId", threadId);
      fd.append("file", emptyFile);

      const uploadReq = new Request("http://localhost/api/v1/chat/attachments/upload", {
        method: "POST",
        headers: { authorization: (await authHeaders(patientId)).authorization },
        body: fd,
      });

      const uploadRes = await uploadRoute.POST(uploadReq);
      expect(uploadRes.status).toBe(400);
    });

    test("rejects oversized attachment file (>20MB)", async () => {
      // 21 MB buffer
      const hugeBuf = Buffer.alloc(21 * 1024 * 1024);
      const hugeFile = toFile(hugeBuf, "huge.pdf", "application/pdf");
      const fd = new FormData();
      fd.append("threadId", threadId);
      fd.append("file", hugeFile);

      const uploadReq = new Request("http://localhost/api/v1/chat/attachments/upload", {
        method: "POST",
        headers: { authorization: (await authHeaders(patientId)).authorization },
        body: fd,
      });

      const uploadRes = await uploadRoute.POST(uploadReq);
      expect(uploadRes.status).toBe(400);
    });
  });

  // =========================================================================
  // CHAT-007: Unauthorized Conversation Access (IDOR Protection)
  // =========================================================================
  describe("CHAT-007 — Unauthorized Conversation (IDOR & Recipient Isolation)", () => {
    let patientAId: string;
    let doctorBId: string;
    let doctorCId: string;
    let threadId: string;
    let attachmentKey: string;

    beforeEach(async () => {
      const patientA = await createPatientUser("Patient A");
      const { user: docB, profile: profB } = await createDoctorUser("Doctor B", true, true);
      const { user: docC } = await createDoctorUser("Doctor C", true, true);

      const { appointment } = await createPaidAppointment(patientA._id.toString(), profB._id.toString());
      patientAId = patientA._id.toString();
      doctorBId = docB._id.toString();
      doctorCId = docC._id.toString();

      threadId = await ChatService.ensureAppointmentThread(appointment._id.toString());

      // Upload attachment in thread
      const jpegBuf = await makeValidJpeg();
      const file = toFile(jpegBuf, "secret.jpg", "image/jpeg");
      const fd = new FormData();
      fd.append("threadId", threadId);
      fd.append("file", file);

      const uploadReq = new Request("http://localhost/api/v1/chat/attachments/upload", {
        method: "POST",
        headers: { authorization: (await authHeaders(patientAId)).authorization },
        body: fd,
      });
      const uploadRes = await uploadRoute.POST(uploadReq);
      const uploadJson = await uploadRes.json();
      attachmentKey = uploadJson.data.storageKey;
    });

    test("Doctor C cannot fetch messages from Patient A ↔ Doctor B conversation", async () => {
      const req = new Request(`http://localhost/api/v1/chat/threads/${threadId}/messages`, {
        headers: await authHeaders(doctorCId),
      });

      const res = await messagesRoute.GET(req, {
        params: Promise.resolve({ threadId }),
      });
      expect(res.status).toBe(404);
    });

    test("Doctor C cannot send message to Patient A ↔ Doctor B conversation", async () => {
      const req = new Request(`http://localhost/api/v1/chat/threads/${threadId}/messages`, {
        method: "POST",
        headers: await authHeaders(doctorCId),
        body: JSON.stringify({ body: "Unauthorized intrusion" }),
      });

      const res = await messagesRoute.POST(req, {
        params: Promise.resolve({ threadId }),
      });
      expect(res.status).toBe(404);

      // Verify no message persisted
      const msg = await ChatMessageModel.findOne({ body: "Unauthorized intrusion" });
      expect(msg).toBeNull();
    });

    test("Doctor C cannot mark Patient A ↔ Doctor B conversation as read", async () => {
      const req = new Request(`http://localhost/api/v1/chat/threads/${threadId}/read`, {
        method: "PATCH",
        headers: await authHeaders(doctorCId),
      });

      const res = await readRoute.PATCH(req, {
        params: Promise.resolve({ threadId }),
      });
      expect(res.status).toBe(404);
    });

    test("Doctor C cannot upload attachments to Patient A ↔ Doctor B conversation", async () => {
      const jpegBuf = await makeValidJpeg();
      const file = toFile(jpegBuf, "evil.jpg", "image/jpeg");
      const fd = new FormData();
      fd.append("threadId", threadId);
      fd.append("file", file);

      const uploadReq = new Request("http://localhost/api/v1/chat/attachments/upload", {
        method: "POST",
        headers: { authorization: (await authHeaders(doctorCId)).authorization },
        body: fd,
      });

      const uploadRes = await uploadRoute.POST(uploadReq);
      expect(uploadRes.status).toBe(404);
    });

    test("Doctor C cannot download attachment from Patient A ↔ Doctor B conversation", async () => {
      const keyParts = attachmentKey.split("/");
      const req = new Request(`http://localhost/api/v1/chat/attachments/${encodeURIComponent(attachmentKey)}`, {
        headers: await authHeaders(doctorCId),
      });

      const res = await attachmentRoute.GET(req, {
        params: Promise.resolve({ key: keyParts }),
      });
      expect(res.status).toBe(404);
    });
  });

  // =========================================================================
  // CHAT-008: Message Pagination & Ordering
  // =========================================================================
  describe("CHAT-008 — Message Pagination & Ordering", () => {
    let patientId: string;
    let threadId: string;
    const TOTAL_MESSAGES = 65;

    beforeAll(async () => {
      const patient = await createPatientUser("Page Patient");
      const { user: docUser, profile: docProfile } = await createDoctorUser("Page Doctor", true, true);
      const { appointment } = await createPaidAppointment(patient._id.toString(), docProfile._id.toString());
      patientId = patient._id.toString();
      threadId = await ChatService.ensureAppointmentThread(appointment._id.toString());

      // Seed 65 messages with sequential timestamps
      for (let i = 1; i <= TOTAL_MESSAGES; i++) {
        await ChatMessageModel.create({
          threadId,
          senderId: patientId,
          kind: ChatMessageKinds.USER,
          body: `Message ${i.toString().padStart(3, "0")}`,
          createdAt: new Date(Date.now() + i * 100),
        });
      }
    });

    test("page 1 returns latest limit messages with hasMore=true", async () => {
      const req = new Request(`http://localhost/api/v1/chat/threads/${threadId}/messages?limit=25`, {
        headers: await authHeaders(patientId),
      });

      const res = await messagesRoute.GET(req, {
        params: Promise.resolve({ threadId }),
      });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.data.messages.length).toBe(25);
      expect(json.data.hasMore).toBe(true);
      // Verify ordering is chronological (oldest to newest within slice)
      expect(json.data.messages[0].body).toBe("Message 041");
      expect(json.data.messages[24].body).toBe("Message 065");
    });

    test("page 2 using before cursor returns previous 25 messages", async () => {
      // Get page 1 first to obtain the cursor (oldest message of page 1)
      const res1 = await messagesRoute.GET(
        new Request(`http://localhost/api/v1/chat/threads/${threadId}/messages?limit=25`, {
          headers: await authHeaders(patientId),
        }),
        { params: Promise.resolve({ threadId }) },
      );
      const json1 = await res1.json();
      const cursor = json1.data.messages[0].id;

      // Page 2
      const res2 = await messagesRoute.GET(
        new Request(`http://localhost/api/v1/chat/threads/${threadId}/messages?limit=25&before=${cursor}`, {
          headers: await authHeaders(patientId),
        }),
        { params: Promise.resolve({ threadId }) },
      );
      const json2 = await res2.json();

      expect(res2.status).toBe(200);
      expect(json2.data.messages.length).toBe(25);
      expect(json2.data.hasMore).toBe(true);
      expect(json2.data.messages[0].body).toBe("Message 016");
      expect(json2.data.messages[24].body).toBe("Message 040");
    });

    test("page 3 returns remaining messages with hasMore=false", async () => {
      // Get page 2 cursor
      const res1 = await messagesRoute.GET(
        new Request(`http://localhost/api/v1/chat/threads/${threadId}/messages?limit=50`, {
          headers: await authHeaders(patientId),
        }),
        { params: Promise.resolve({ threadId }) },
      );
      const json1 = await res1.json();
      const cursor = json1.data.messages[0].id; // 15th message from beginning

      // Page 3
      const res3 = await messagesRoute.GET(
        new Request(`http://localhost/api/v1/chat/threads/${threadId}/messages?limit=25&before=${cursor}`, {
          headers: await authHeaders(patientId),
        }),
        { params: Promise.resolve({ threadId }) },
      );
      const json3 = await res3.json();

      expect(res3.status).toBe(200);
      expect(json3.data.messages.length).toBe(15);
      expect(json3.data.hasMore).toBe(false);
      expect(json3.data.messages[0].body).toBe("Message 001");
      expect(json3.data.messages[14].body).toBe("Message 015");
    });

    test("invalid limit returns 400 validation error, not 500", async () => {
      const req = new Request(`http://localhost/api/v1/chat/threads/${threadId}/messages?limit=abc`, {
        headers: await authHeaders(patientId),
      });

      const res = await messagesRoute.GET(req, {
        params: Promise.resolve({ threadId }),
      });
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error.code).toBe("VALIDATION_ERROR");
    });

    test("invalid cursor returns 400 validation error, not 500", async () => {
      const req = new Request(`http://localhost/api/v1/chat/threads/${threadId}/messages?before=not-an-id`, {
        headers: await authHeaders(patientId),
      });

      const res = await messagesRoute.GET(req, {
        params: Promise.resolve({ threadId }),
      });
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error.code).toBe("VALIDATION_ERROR");
    });

    test("concurrent message arrivals during pagination do not duplicate or corrupt results", async () => {
      // Concurrently fetch page 1 while inserting 5 new messages
      const [resPage, ...resInserts] = await Promise.all([
        messagesRoute.GET(
          new Request(`http://localhost/api/v1/chat/threads/${threadId}/messages?limit=20`, {
            headers: await authHeaders(patientId),
          }),
          { params: Promise.resolve({ threadId }) },
        ),
        ...Array.from({ length: 5 }, (_, i) =>
          ChatService.sendMessage(threadId, patientId, `Concurrent Msg ${i}`),
        ),
      ]);

      const json = await resPage.json();
      expect(resPage.status).toBe(200);
      expect(json.data.messages.length).toBe(20);

      // Verify all returned message IDs are distinct (no duplicates)
      const ids = json.data.messages.map((m: { id: string }) => m.id);
      expect(new Set(ids).size).toBe(20);
    });
  });

  // =========================================================================
  // IDOR & Malformed Resource IDs
  // =========================================================================
  describe("Resource ID Manipulation & IDOR Protection", () => {
    let patientId: string;

    beforeAll(async () => {
      const patient = await createPatientUser("IDOR Patient");
      patientId = patient._id.toString();
    });

    test("malformed threadId in GET messages returns 404 cleanly without 500 crash", async () => {
      const res = await messagesRoute.GET(
        new Request("http://localhost/api/v1/chat/threads/invalid-thread-id/messages", {
          headers: await authHeaders(patientId),
        }),
        { params: Promise.resolve({ threadId: "invalid-thread-id" }) },
      );
      expect(res.status).toBe(404);
    });

    test("malformed threadId in POST message returns 404 cleanly without 500 crash", async () => {
      const res = await messagesRoute.POST(
        new Request("http://localhost/api/v1/chat/threads/invalid-thread-id/messages", {
          method: "POST",
          headers: await authHeaders(patientId),
          body: JSON.stringify({ body: "test" }),
        }),
        { params: Promise.resolve({ threadId: "invalid-thread-id" }) },
      );
      expect(res.status).toBe(404);
    });

    test("malformed participantId in POST threads returns 404 cleanly without 500 crash", async () => {
      const res = await threadsRoute.POST(
        new Request("http://localhost/api/v1/chat/threads", {
          method: "POST",
          headers: await authHeaders(patientId),
          body: JSON.stringify({ participantId: "not-an-id" }),
        }) as never,
      );
      expect(res.status).toBe(404);
    });
  });
});
