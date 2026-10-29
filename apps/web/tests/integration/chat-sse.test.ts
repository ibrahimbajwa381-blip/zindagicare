/**
 * CHAT-SSE-001..009 — P0 Chat SSE Real-Time Layer Security & Concurrency Audit.
 *
 * Real local MongoDB (mongodb-memory-server, ephemeral — never Atlas, never
 * production) + REAL SSE route handler (imported and invoked directly) +
 * REAL auth (resolveSession / mobile JWT, signed with test AUTH_SECRET) +
 * REAL chatEmitter (EventEmitter).
 *
 * Verifies recipient isolation, cross-conversation leak prevention,
 * multiple connections per user, reconnects, disconnects, and cleanup.
 */
import { MongoMemoryServer } from "mongodb-memory-server";
import { randomBytes } from "crypto";
import { NextRequest } from "next/server";

jest.setTimeout(60000);

// Mock web cookie auth; mobile Bearer-token path runs unmocked
jest.mock("@/lib/auth", () => ({ auth: async () => null }));

describe("Chat SSE Real-Time Layer — P0 Security & Concurrency Audit", () => {
  let mongod: InstanceType<typeof MongoMemoryServer>;
  let mongooseMod: typeof import("mongoose");
  let UserModel: typeof import("@zindagi/database").UserModel;
  let DoctorProfileModel: typeof import("@zindagi/database").DoctorProfileModel;
  let AppointmentModel: typeof import("@zindagi/database").AppointmentModel;
  let PaymentModel: typeof import("@zindagi/database").PaymentModel;
  let Roles: typeof import("@zindagi/shared").Roles;
  let AppointmentTypes: typeof import("@zindagi/shared").AppointmentTypes;
  let AppointmentStatuses: typeof import("@zindagi/shared").AppointmentStatuses;
  let PaymentStatuses: typeof import("@zindagi/shared").PaymentStatuses;
  let VerificationStatuses: typeof import("@zindagi/shared").VerificationStatuses;
  let signMobileAccessToken: typeof import("@/server/api/mobile-jwt").signMobileAccessToken;

  let eventsRoute: typeof import("@/app/api/v1/chat/events/route");
  let ChatService: typeof import("@/server/services/chat.service").ChatService;
  let chatEmitter: typeof import("@/lib/realtime/chat-emitter").chatEmitter;
  let userRoomKey: typeof import("@/lib/realtime/chat-emitter").userRoomKey;

  let counter = 0;
  const nextEmail = () => `sse-audit-${Date.now()}-${counter++}@test.local`;

  async function createPatientUser(name = "SSE Patient") {
    return UserModel.create({
      name,
      email: nextEmail(),
      phone: `+92300${Math.floor(1000000 + Math.random() * 9000000)}`,
      roles: [Roles.PATIENT],
    });
  }

  async function createDoctorUser(name = "SSE Doctor") {
    const user = await UserModel.create({
      name,
      email: nextEmail(),
      phone: `+92301${Math.floor(1000000 + Math.random() * 9000000)}`,
      roles: [Roles.DOCTOR],
    });

    const profile = await DoctorProfileModel.create({
      userId: user._id,
      pmdcNumber: `PMDC-${Date.now()}-${counter++}`,
      verificationStatus: VerificationStatuses.APPROVED,
      isListed: true,
      specialties: ["Cardiologist"],
      consultationFee: 2000,
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
      amount: 2000,
      status: PaymentStatuses.PAID,
      provider: "jazzcash",
      // (provider, externalTransactionId) is unique; null collides once the index is built.
      externalTransactionId: `sse-txn-${counter++}`,
    });

    await AppointmentModel.updateOne(
      { _id: appointment._id },
      { $set: { paymentId: payment._id } },
    );

    return { appointment, payment };
  }

  async function sseRequest(userId: string, abortController?: AbortController) {
    const token = await signMobileAccessToken(userId);
    return new NextRequest("http://localhost/api/v1/chat/events", {
      headers: {
        authorization: `Bearer ${token}`,
        accept: "text/event-stream",
      },
      signal: abortController?.signal,
    });
  }

  type SseEvent = Record<string, unknown>;

  /**
   * Helper to collect events from an SSE ReadableStream.
   * Runs until expectedCount events are collected or timeout occurs.
   */
  async function collectSseEvents(
    res: Response,
    expectedCount = 1,
    timeoutMs = 2500,
  ): Promise<SseEvent[]> {
    if (!res.body) return [];
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    const events: SseEvent[] = [];
    let buffer = "";

    const timer = setTimeout(() => {
      reader.cancel().catch(() => {});
    }, timeoutMs);

    try {
      while (events.length < expectedCount) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let sepIndex: number;
        while ((sepIndex = buffer.indexOf("\n\n")) !== -1) {
          const raw = buffer.slice(0, sepIndex);
          buffer = buffer.slice(sepIndex + 2);

          const dataLines = raw
            .split("\n")
            .filter((l) => l.startsWith("data:"))
            .map((l) => l.slice(5).trimStart())
            .join("\n");

          if (dataLines) {
            try {
              events.push(JSON.parse(dataLines));
            } catch {
              // Ignore ping or non-json
            }
          }
        }
      }
    } catch {
      // Aborted or cancelled
    } finally {
      clearTimeout(timer);
      try {
        reader.releaseLock();
      } catch {
        // Ignore
      }
    }

    return events;
  }

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongod.getUri("chat_sse_audit");
    process.env.FIELD_ENCRYPTION_KEY = randomBytes(32).toString("base64");
    process.env.AUTH_SECRET = "test-secret-at-least-32-chars-long-12345";

    const db = await import("@zindagi/database");
    UserModel = db.UserModel;
    DoctorProfileModel = db.DoctorProfileModel;
    AppointmentModel = db.AppointmentModel;
    PaymentModel = db.PaymentModel;
    mongooseMod = (await import("mongoose")).default;

    const shared = await import("@zindagi/shared");
    Roles = shared.Roles;
    AppointmentTypes = shared.AppointmentTypes;
    AppointmentStatuses = shared.AppointmentStatuses;
    PaymentStatuses = shared.PaymentStatuses;
    VerificationStatuses = shared.VerificationStatuses;

    await db.connectDatabase();

    ({ signMobileAccessToken } = await import("@/server/api/mobile-jwt"));
    eventsRoute = await import("@/app/api/v1/chat/events/route");
    ({ ChatService } = await import("@/server/services/chat.service"));
    const realtime = await import("@/lib/realtime/chat-emitter");
    chatEmitter = realtime.chatEmitter;
    userRoomKey = realtime.userRoomKey;
  });

  afterAll(async () => {
    await mongooseMod.disconnect();
    await mongod.stop();
  });

  // =========================================================================
  // CHAT-SSE-001: Connect SSE
  // =========================================================================
  describe("CHAT-SSE-001 — Connect SSE", () => {
    test("authenticated client receives 200, SSE headers, and initial connected event", async () => {
      const patient = await createPatientUser("Conn Patient");
      const patientId = patient._id.toString();

      const ac = new AbortController();
      const req = await sseRequest(patientId, ac);
      const res = await eventsRoute.GET(req);

      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toBe("text/event-stream");
      expect(res.headers.get("cache-control")).toBe("no-cache, no-transform");
      expect(res.headers.get("connection")).toBe("keep-alive");

      const events = await collectSseEvents(res, 1, 1000);
      expect(events.length).toBeGreaterThanOrEqual(1);
      expect(events[0].type).toBe("connected");
      expect(events[0].room).toBe(`chat:user:${patientId}`);

      ac.abort();
    });
  });

  // =========================================================================
  // CHAT-SSE-002 & CHAT-SSE-003: Auth & Rejection
  // =========================================================================
  describe("CHAT-SSE-002 & CHAT-SSE-003 — Authentication Gates", () => {
    test("unauthenticated connection rejected with 401 (no token)", async () => {
      const req = new NextRequest("http://localhost/api/v1/chat/events", {
        headers: { accept: "text/event-stream" },
      });
      const res = await eventsRoute.GET(req);
      expect(res.status).toBe(401);
    });

    test("invalid / forged token rejected with 401", async () => {
      const req = new NextRequest("http://localhost/api/v1/chat/events", {
        headers: {
          authorization: "Bearer forged-token-xyz-123",
          accept: "text/event-stream",
        },
      });
      const res = await eventsRoute.GET(req);
      expect(res.status).toBe(401);
    });

    test("empty token rejected with 401", async () => {
      const req = new NextRequest("http://localhost/api/v1/chat/events", {
        headers: {
          authorization: "Bearer ",
          accept: "text/event-stream",
        },
      });
      const res = await eventsRoute.GET(req);
      expect(res.status).toBe(401);
    });
  });

  // =========================================================================
  // CHAT-SSE-004: New Message Pushed
  // =========================================================================
  describe("CHAT-SSE-004 — New Message Pushed to Stream", () => {
    test("sending a message pushes an SSE event with complete metadata", async () => {
      const patient = await createPatientUser("Push Patient");
      const { user: docUser, profile: docProfile } = await createDoctorUser("Push Doctor");
      const { appointment } = await createPaidAppointment(patient._id.toString(), docProfile._id.toString());
      const threadId = await ChatService.ensureAppointmentThread(appointment._id.toString());

      const patientId = patient._id.toString();
      const doctorId = docUser._id.toString();

      // Doctor connects to SSE
      const acDoctor = new AbortController();
      const docReq = await sseRequest(doctorId, acDoctor);
      const docRes = await eventsRoute.GET(docReq);

      // Start collecting events for Doctor (expect 2: "connected" + "message")
      const docEventsPromise = collectSseEvents(docRes, 2, 2000);

      // Patient sends message
      const msg = await ChatService.sendMessage(threadId, patientId, "Realtime test message 123");

      const docEvents = await docEventsPromise;
      acDoctor.abort();

      const msgEvent = docEvents.find((e) => e.type === "message");
      expect(msgEvent).toBeDefined();
      expect(msgEvent?.messageId).toBe(msg.id);
      expect(msgEvent?.threadId).toBe(threadId);
      expect(msgEvent?.senderId).toBe(patientId);
      expect(msgEvent?.body).toBe("Realtime test message 123");
      expect(msgEvent?.lastMessagePreview).toBe("Realtime test message 123");
      expect(msgEvent?.createdAt).toBeDefined();
    });
  });

  // =========================================================================
  // 🔥 CHAT-SSE-005: Critical Recipient Isolation (Doctor B receives, Doctor C does NOT)
  // =========================================================================
  describe("🔥 CHAT-SSE-005 — Correct Recipient Receives Event (Doctor B receives, Doctor C NEVER)", () => {
    test("Doctor B receives Patient A's message; Doctor C receives 0 private events", async () => {
      const patientA = await createPatientUser("Patient A");
      const { user: docB, profile: profB } = await createDoctorUser("Doctor B");
      const { user: docC } = await createDoctorUser("Doctor C");

      const { appointment } = await createPaidAppointment(patientA._id.toString(), profB._id.toString());
      const threadId = await ChatService.ensureAppointmentThread(appointment._id.toString());

      const patientAId = patientA._id.toString();
      const doctorBId = docB._id.toString();
      const doctorCId = docC._id.toString();

      // Connect both Doctor B and Doctor C
      const acB = new AbortController();
      const acC = new AbortController();

      const resB = await eventsRoute.GET(await sseRequest(doctorBId, acB));
      const resC = await eventsRoute.GET(await sseRequest(doctorCId, acC));

      // Collect events in parallel
      const eventsBPromise = collectSseEvents(resB, 2, 2000);
      const eventsCPromise = collectSseEvents(resC, 2, 1000); // Expect only "connected", never "message"

      // Send private message from Patient A to Doctor B
      await ChatService.sendMessage(threadId, patientAId, "Secret patient diagnosis for Doctor B only");

      const [eventsB, eventsC] = await Promise.all([eventsBPromise, eventsCPromise]);
      acB.abort();
      acC.abort();

      // Doctor B must receive the message
      const bMessage = eventsB.find((e) => e.type === "message");
      expect(bMessage).toBeDefined();
      expect(bMessage?.body).toBe("Secret patient diagnosis for Doctor B only");

      // Doctor C must NEVER receive any message event
      const cMessages = eventsC.filter((e) => e.type === "message");
      expect(cMessages.length).toBe(0);
      expect(eventsC.every((e) => e.type === "connected")).toBe(true);
    });
  });

  // =========================================================================
  // 🔥 CHAT-SSE-006: Cross-Conversation Isolation
  // =========================================================================
  describe("🔥 CHAT-SSE-006 — Other Users Must NOT Receive Event (Cross-Conversation)", () => {
    test("Conversation 1 (A ↔ B) does not leak to Conversation 2 (C ↔ D)", async () => {
      const patientA = await createPatientUser("Conv1 Patient A");
      const { user: docB, profile: profB } = await createDoctorUser("Conv1 Doctor B");
      const { appointment: appt1 } = await createPaidAppointment(patientA._id.toString(), profB._id.toString());
      const thread1 = await ChatService.ensureAppointmentThread(appt1._id.toString());

      const patientC = await createPatientUser("Conv2 Patient C");
      const { user: docD, profile: profD } = await createDoctorUser("Conv2 Doctor D");
      const { appointment: appt2 } = await createPaidAppointment(patientC._id.toString(), profD._id.toString());
      const thread2 = await ChatService.ensureAppointmentThread(appt2._id.toString());

      const acA = new AbortController();
      const acB = new AbortController();
      const acC = new AbortController();
      const acD = new AbortController();

      const [resA, resB, resC, resD] = await Promise.all([
        eventsRoute.GET(await sseRequest(patientA._id.toString(), acA)),
        eventsRoute.GET(await sseRequest(docB._id.toString(), acB)),
        eventsRoute.GET(await sseRequest(patientC._id.toString(), acC)),
        eventsRoute.GET(await sseRequest(docD._id.toString(), acD)),
      ]);

      const promiseA = collectSseEvents(resA, 2, 2000);
      const promiseB = collectSseEvents(resB, 2, 2000);
      const promiseC = collectSseEvents(resC, 2, 1000);
      const promiseD = collectSseEvents(resD, 2, 1000);

      // Send message into Conversation 1
      await ChatService.sendMessage(thread1, patientA._id.toString(), "Hello Conv1 from Patient A");

      const [eventsA, eventsB, eventsC, eventsD] = await Promise.all([
        promiseA,
        promiseB,
        promiseC,
        promiseD,
      ]);

      acA.abort();
      acB.abort();
      acC.abort();
      acD.abort();

      // Conv 1 participants receive event
      expect(eventsB.some((e) => e.type === "message" && e.threadId === thread1)).toBe(true);
      expect(eventsA.some((e) => e.type === "message" && e.threadId === thread1)).toBe(true);

      // Conv 2 participants must NOT receive event
      expect(eventsC.some((e) => e.type === "message")).toBe(false);
      expect(eventsD.some((e) => e.type === "message")).toBe(false);
    });
  });

  // =========================================================================
  // CHAT-SSE-007: Multiple Connections for a Single User
  // =========================================================================
  describe("CHAT-SSE-007 — Multiple Concurrent Connections per User", () => {
    test("a user with 10 concurrent connections receives the event on all connections", async () => {
      const patient = await createPatientUser("MultiConn Patient");
      const { user: docUser, profile: docProfile } = await createDoctorUser("MultiConn Doctor");
      const { appointment } = await createPaidAppointment(patient._id.toString(), docProfile._id.toString());
      const threadId = await ChatService.ensureAppointmentThread(appointment._id.toString());

      const numConns = 10;
      const abortControllers = Array.from({ length: numConns }, () => new AbortController());

      // Open 10 connections for the doctor
      const responses = await Promise.all(
        abortControllers.map((ac) => sseRequest(docUser._id.toString(), ac).then((req) => eventsRoute.GET(req))),
      );

      for (const res of responses) {
        expect(res.status).toBe(200);
      }

      // Collect events across all 10 connections
      const collectionPromises = responses.map((res) => collectSseEvents(res, 2, 2000));

      // Patient sends 1 message
      await ChatService.sendMessage(threadId, patient._id.toString(), "Message to all 10 doctor connections");

      const allEvents = await Promise.all(collectionPromises);
      abortControllers.forEach((ac) => ac.abort());

      // Every connection should receive the message event
      for (const events of allEvents) {
        const msg = events.find((e) => e.type === "message");
        expect(msg).toBeDefined();
        expect(msg?.body).toBe("Message to all 10 doctor connections");
      }
    });
  });

  // =========================================================================
  // CHAT-SSE-008: Reconnect After Disconnect
  // =========================================================================
  describe("CHAT-SSE-008 — Reconnect After Disconnect", () => {
    test("client can disconnect and reconnect 5 times sequentially and receive events on new connection", async () => {
      const patient = await createPatientUser("Recon Patient");
      const { user: docUser, profile: docProfile } = await createDoctorUser("Recon Doctor");
      const { appointment } = await createPaidAppointment(patient._id.toString(), docProfile._id.toString());
      const threadId = await ChatService.ensureAppointmentThread(appointment._id.toString());

      const doctorId = docUser._id.toString();

      for (let i = 1; i <= 5; i++) {
        const ac = new AbortController();
        const req = await sseRequest(doctorId, ac);
        const res = await eventsRoute.GET(req);
        expect(res.status).toBe(200);

        const eventsPromise = collectSseEvents(res, 2, 2000);
        await ChatService.sendMessage(threadId, patient._id.toString(), `Reconnect cycle ${i}`);
        const events = await eventsPromise;

        const msg = events.find((e) => e.type === "message");
        expect(msg).toBeDefined();
        expect(msg?.body).toBe(`Reconnect cycle ${i}`);

        // Disconnect
        ac.abort();
      }
    });
  });

  // =========================================================================
  // CHAT-SSE-009: Connection Cleanup
  // =========================================================================
  describe("CHAT-SSE-009 — Connection Cleanup", () => {
    test("disconnecting 25 connections cleans up listeners without memory leak", async () => {
      const patient = await createPatientUser("Cleanup Patient");
      const patientId = patient._id.toString();
      const room = userRoomKey(patientId);

      const initialListeners = chatEmitter.listenerCount(room);
      expect(initialListeners).toBe(0);

      const count = 25;
      const controllers = Array.from({ length: count }, () => new AbortController());

      // Connect 25 clients
      const responses = await Promise.all(
        controllers.map((ac) => sseRequest(patientId, ac).then((req) => eventsRoute.GET(req))),
      );

      // Give streams a tick to register
      await new Promise((r) => setTimeout(r, 50));
      expect(chatEmitter.listenerCount(room)).toBe(count);

      // Abort all 25 connections
      controllers.forEach((ac) => ac.abort());
      await new Promise((r) => setTimeout(r, 50));

      // Verify all listeners were cleanly removed
      expect(chatEmitter.listenerCount(room)).toBe(0);
    });
  });

  // =========================================================================
  // Disconnect During Message Delivery
  // =========================================================================
  describe("Disconnect During Message Delivery", () => {
    test("client aborting during message dispatch does not crash server or fail message persistence", async () => {
      const patient = await createPatientUser("DisconDeliv Patient");
      const { user: docUser, profile: docProfile } = await createDoctorUser("DisconDeliv Doctor");
      const { appointment } = await createPaidAppointment(patient._id.toString(), docProfile._id.toString());
      const threadId = await ChatService.ensureAppointmentThread(appointment._id.toString());

      const doctorId = docUser._id.toString();
      const patientId = patient._id.toString();

      // Open 5 doctor connections
      const controllers = Array.from({ length: 5 }, () => new AbortController());
      await Promise.all(
        controllers.map((ac) => sseRequest(doctorId, ac).then((req) => eventsRoute.GET(req))),
      );

      // Simultaneously abort connections while patient sends message
      const [msg] = await Promise.all([
        ChatService.sendMessage(threadId, patientId, "Message racing with abort"),
        ...controllers.map(async (ac) => {
          ac.abort();
        }),
      ]);

      expect(msg.id).toBeDefined();
      expect(msg.body).toBe("Message racing with abort");

      // Verify message is saved in MongoDB
      const dbMsg = await (await import("@zindagi/database")).ChatMessageModel.findById(msg.id).lean();
      expect(dbMsg).toBeDefined();
      expect(dbMsg?.body).toBe("Message racing with abort");
    });
  });
});
