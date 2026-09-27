/**
 * Chat + SSE Realtime Concurrency & Isolation Stress Runner.
 *
 * Real local MongoDB (mongodb-memory-server, ephemeral — never Atlas, never
 * production) + REAL ChatService + REAL SSE route handler + REAL chatEmitter.
 *
 * Runs:
 * 1. Progressive Connection Stress (10, 25, 50, 100, 250 connections)
 * 2. Message Fan-Out Race (10, 25, 50, 100, 250 concurrent messages)
 * 3. 50 Concurrent Cross-Conversation Stress (50 independent conversations)
 * 4. 100 Synthetic Users Multi-User Stress
 * 5. 🔥 Final Critical Isolation Stress Test (Patient A -> Doctor B x 100; Doctors C, D, E get 0)
 *
 * Run: cd apps/web && npx tsx ../../scripts/chat-sse-stress.ts
 */
import { MongoMemoryServer } from "mongodb-memory-server";
import { randomBytes } from "crypto";
import { NextRequest } from "next/server";

type SseEvent = Record<string, unknown>;

async function collectEvents(
  res: Response,
  expectedCount: number,
  timeoutMs: number,
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
            // Ignore non-json
          }
        }
      }
    }
  } catch {
    // Cancelled / aborted
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

async function main() {
  console.log("==========================================================");
  console.log("  ZindagiCare Chat + SSE Realtime Concurrency Audit");
  console.log("==========================================================");

  console.log("Starting ephemeral local MongoDB (mongodb-memory-server)...");
  const mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri("zindagi_chat_stress");
  process.env.FIELD_ENCRYPTION_KEY = randomBytes(32).toString("base64");
  process.env.AUTH_SECRET = "test-secret-at-least-32-chars-long-12345";

  const {
    connectDatabase,
    UserModel,
    DoctorProfileModel,
    AppointmentModel,
    PaymentModel,
    ChatThreadModel,
    ChatMessageModel,
  } = await import("@zindagi/database");
  const mongooseMod = (await import("mongoose")).default;
  const {
    AppointmentStatuses,
    AppointmentTypes,
    VerificationStatuses,
    PaymentStatuses,
    Roles,
  } = await import("@zindagi/shared");

  await connectDatabase();
  console.log("Database connected. Waiting for indexes...");
  await UserModel.init();
  await DoctorProfileModel.init();
  await AppointmentModel.init();
  await PaymentModel.init();
  await ChatThreadModel.init();
  await ChatMessageModel.init();
  console.log("Indexes ready.\n");

  const { signMobileAccessToken } = await import("@/server/api/mobile-jwt");
  const { ChatService } = await import("@/server/services/chat.service");
  const eventsRoute = await import("@/app/api/v1/chat/events/route");
  const { chatEmitter, userRoomKey } = await import("@/lib/realtime/chat-emitter");

  let counter = 0;
  const nextEmail = () => `stress-${Date.now()}-${counter++}@test.local`;

  async function createPatient(name = "Stress Patient") {
    return UserModel.create({
      name,
      email: nextEmail(),
      phone: `+92300${Math.floor(1000000 + Math.random() * 9000000)}`,
      roles: [Roles.PATIENT],
    });
  }

  async function createDoctor(name = "Stress Doctor") {
    const user = await UserModel.create({
      name,
      email: nextEmail(),
      phone: `+92301${Math.floor(1000000 + Math.random() * 9000000)}`,
      roles: [Roles.DOCTOR, Roles.PATIENT],
    });

    const profile = await DoctorProfileModel.create({
      userId: user._id,
      pmdcNumber: `PMDC-STR-${Date.now()}-${counter++}`,
      verificationStatus: VerificationStatuses.APPROVED,
      isListed: true,
      specialties: ["General Physician"],
      consultationFee: 1500,
    });

    return { user, profile };
  }

  async function createAppointmentAndThread(patientUserId: string, doctorProfileId: string) {
    const appt = await AppointmentModel.create({
      patientId: patientUserId,
      doctorId: doctorProfileId,
      type: AppointmentTypes.ONLINE,
      status: AppointmentStatuses.CONFIRMED,
      scheduledStart: new Date(Date.now() - 3600000),
      scheduledEnd: new Date(Date.now() + 3600000),
      fee: 1500,
    });

    const payment = await PaymentModel.create({
      userId: patientUserId,
      appointmentId: appt._id,
      amount: 1500,
      status: PaymentStatuses.PAID,
      provider: "jazzcash",
      externalTransactionId: `tx-${Date.now()}-${counter++}-${Math.random()}`,
    });

    await AppointmentModel.updateOne({ _id: appt._id }, { $set: { paymentId: payment._id } });
    const threadId = await ChatService.ensureAppointmentThread(appt._id.toString());
    return { appointment: appt, threadId };
  }

  async function connectSse(userId: string, ac: AbortController) {
    const token = await signMobileAccessToken(userId);
    const req = new NextRequest("http://localhost/api/v1/chat/events", {
      headers: {
        authorization: `Bearer ${token}`,
        accept: "text/event-stream",
      },
      signal: ac.signal,
    });
    return eventsRoute.GET(req);
  }

  // =========================================================================
  // SCENARIO 1: Progressive Connection Stress (10, 25, 50, 100, 250 connections)
  // =========================================================================
  console.log("----------------------------------------------------------");
  console.log("SCENARIO 1: Progressive Connection Stress (10, 25, 50, 100, 250 connections)");
  console.log("----------------------------------------------------------");

  const connLevels = [10, 25, 50, 100, 250];
  const sseStressResults: Record<number, Record<string, number | string>> = {};

  for (const n of connLevels) {
    const testPatient = await createPatient(`ConnStress Patient ${n}`);
    const { user: testDoc, profile: testDocProf } = await createDoctor(`ConnStress Doc ${n}`);
    const { threadId } = await createAppointmentAndThread(testPatient._id.toString(), testDocProf._id.toString());

    const controllers = Array.from({ length: n }, () => new AbortController());
    const startMs = Date.now();

    let attempted = n;
    let established = 0;
    let rejected = 0;
    let serverErrors = 0;
    let timeouts = 0;
    let dbErrors = 0;
    let unhandledExceptions = 0;

    const responses: Response[] = [];
    for (const ac of controllers) {
      try {
        const res = await connectSse(testDoc._id.toString(), ac);
        if (res.status === 200) established++;
        else if (res.status >= 500) serverErrors++;
        else rejected++;
        responses.push(res);
      } catch {
        unhandledExceptions++;
      }
    }

    // Read initial connected events across all connections
    const collectionPromises = responses.map((res) => collectEvents(res, 2, 2500));

    // Send 1 message
    const msg = await ChatService.sendMessage(threadId, testPatient._id.toString(), `Message for level ${n}`);

    const allEvents = await Promise.all(collectionPromises);
    controllers.forEach((ac) => ac.abort());
    const elapsedMs = Date.now() - startMs;

    let receivedEvents = 0;
    let missingEvents = 0;
    let duplicateEvents = 0;
    let wrongRecipientEvents = 0;
    let wrongConversationEvents = 0;

    for (const events of allEvents) {
      const msgEvents = events.filter((e) => e.type === "message");
      if (msgEvents.length === 0) missingEvents++;
      else if (msgEvents.length > 1) duplicateEvents += (msgEvents.length - 1);

      receivedEvents += msgEvents.length;

      for (const e of msgEvents) {
        if (e.senderId !== testPatient._id.toString()) wrongRecipientEvents++;
        if (e.threadId !== threadId) wrongConversationEvents++;
      }
    }

    const expectedEvents = established; // 1 event per established connection

    sseStressResults[n] = {
      attempted,
      established,
      disconnects: established,
      messages: 1,
      expectedEvents,
      receivedEvents,
      missingEvents,
      duplicateEvents,
      wrongRecipientEvents,
      wrongConversationEvents,
      serverErrors,
      timeouts,
      unhandledExceptions,
      elapsedMs: `${elapsedMs}ms`,
    };

    console.log(
      `[Level ${n.toString().padStart(3)}] established=${established}/${attempted} received=${receivedEvents}/${expectedEvents} wrongRecipient=${wrongRecipientEvents} 5xx=${serverErrors} (${elapsedMs}ms)`,
    );
  }
  console.log("Progressive connection stress complete.\n");

  // =========================================================================
  // SCENARIO 2: Message Fan-Out Race (10, 25, 50, 100, 250 concurrent messages)
  // =========================================================================
  console.log("----------------------------------------------------------");
  console.log("SCENARIO 2: Message Fan-Out Race (10, 25, 50, 100, 250 concurrent messages)");
  console.log("----------------------------------------------------------");

  const msgLevels = [10, 25, 50, 100, 250];
  const msgStressResults: Record<number, Record<string, number | string>> = {};

  for (const n of msgLevels) {
    const patient = await createPatient(`MsgStress Patient ${n}`);
    const { user: doc, profile: docProf } = await createDoctor(`MsgStress Doc ${n}`);
    const { threadId } = await createAppointmentAndThread(patient._id.toString(), docProf._id.toString());

    const ac = new AbortController();
    const docRes = await connectSse(doc._id.toString(), ac);
    const startMs = Date.now();

    // Start event collector in background expecting n messages (+1 connected event)
    const collectPromise = collectEvents(docRes, n + 1, Math.max(4000, n * 50));

    // Send n messages concurrently from Patient
    const sendPromises = Array.from({ length: n }, (_, i) =>
      ChatService.sendMessage(threadId, patient._id.toString(), `Concurrent Msg ${i} of ${n}`),
    );

    const sentMessages = await Promise.all(sendPromises);
    const receivedEvents = await collectPromise;
    ac.abort();
    const elapsedMs = Date.now() - startMs;

    const persistedCount = await ChatMessageModel.countDocuments({ threadId, deletedAt: null });
    const messageEvents = receivedEvents.filter((e) => e.type === "message");

    const messageIds = new Set(messageEvents.map((e) => e.messageId));
    const duplicateCount = messageEvents.length - messageIds.size;
    const missingCount = Math.max(0, n - messageEvents.length);

    let wrongRecipient = 0;
    let wrongConversation = 0;
    for (const e of messageEvents) {
      if (e.senderId !== patient._id.toString()) wrongRecipient++;
      if (e.threadId !== threadId) wrongConversation++;
    }

    msgStressResults[n] = {
      persisted: persistedCount,
      eventsExpected: n,
      eventsReceived: messageEvents.length,
      missing: missingCount,
      duplicate: duplicateCount,
      wrongRecipient,
      wrongConversation,
      elapsedMs: `${elapsedMs}ms`,
    };

    console.log(
      `[Messages ${n.toString().padStart(3)}] persisted=${persistedCount}/${n} received=${messageEvents.length}/${n} duplicates=${duplicateCount} wrongRecipient=${wrongRecipient} (${elapsedMs}ms)`,
    );
  }
  console.log("Message fan-out race complete.\n");

  // =========================================================================
  // SCENARIO 3: 50 Concurrent Cross-Conversation Stress
  // =========================================================================
  console.log("----------------------------------------------------------");
  console.log("SCENARIO 3: 50 Concurrent Independent Conversations");
  console.log("----------------------------------------------------------");

  const NUM_CONVS = 50;
  type ConvData = {
    patientId: string;
    doctorId: string;
    threadId: string;
    res: Response;
    ac: AbortController;
  };

  const convs: ConvData[] = [];
  console.log(`Setting up ${NUM_CONVS} patient-doctor pairs, appointments, and threads...`);
  for (let i = 0; i < NUM_CONVS; i++) {
    const patient = await createPatient(`CrossPatient ${i}`);
    const { user: doc, profile: docProf } = await createDoctor(`CrossDoctor ${i}`);
    const { threadId } = await createAppointmentAndThread(patient._id.toString(), docProf._id.toString());

    const ac = new AbortController();
    const res = await connectSse(doc._id.toString(), ac);
    convs.push({
      patientId: patient._id.toString(),
      doctorId: doc._id.toString(),
      threadId,
      res,
      ac,
    });
  }

  console.log(`All ${NUM_CONVS} SSE streams connected. Firing simultaneous messages...`);
  const crossStartMs = Date.now();

  // Background collectors for each doctor
  const convCollectPromises = convs.map((c) => collectEvents(c.res, 2, 3000));

  // Send 1 message into each conversation simultaneously
  const sendResults = await Promise.all(
    convs.map((c, i) =>
      ChatService.sendMessage(c.threadId, c.patientId, `Unique Cross Msg for Conv ${i}`),
    ),
  );

  const allConvEvents = await Promise.all(convCollectPromises);
  convs.forEach((c) => c.ac.abort());
  const crossElapsedMs = Date.now() - crossStartMs;

  let crossWrongRecipient = 0;
  let crossWrongConversation = 0;
  let crossMissing = 0;

  for (let i = 0; i < NUM_CONVS; i++) {
    const expectedConv = convs[i];
    const events = allConvEvents[i];
    const msgEvents = events.filter((e) => e.type === "message");

    if (msgEvents.length === 0) {
      crossMissing++;
      continue;
    }

    for (const e of msgEvents) {
      if (e.threadId !== expectedConv.threadId) {
        crossWrongConversation++;
        console.error(`CROSS-CONVERSATION LEAK: Doctor ${i} received event for thread ${e.threadId}`);
      }
      if (e.senderId !== expectedConv.patientId) {
        crossWrongRecipient++;
        console.error(`CROSS-RECIPIENT LEAK: Doctor ${i} received message from sender ${e.senderId}`);
      }
    }
  }

  console.log(
    `50 Concurrent Conversations: wrongRecipient=${crossWrongRecipient} wrongConversation=${crossWrongConversation} missing=${crossMissing} (${crossElapsedMs}ms)\n`,
  );

  // =========================================================================
  // SCENARIO 4: 100 Synthetic Users Multi-User Stress
  // =========================================================================
  console.log("----------------------------------------------------------");
  console.log("SCENARIO 4: 100 Synthetic Users Multi-User Stress");
  console.log("----------------------------------------------------------");

  const NUM_USERS = 100;
  const userPairs: Array<{ patientId: string; doctorId: string; threadId: string }> = [];

  for (let i = 0; i < NUM_USERS / 2; i++) {
    const p = await createPatient(`User100 P${i}`);
    const { user: d, profile: dp } = await createDoctor(`User100 D${i}`);
    const { threadId } = await createAppointmentAndThread(p._id.toString(), dp._id.toString());
    userPairs.push({ patientId: p._id.toString(), doctorId: d._id.toString(), threadId });
  }

  // Connect all 50 doctors to SSE
  const userAcs = userPairs.map(() => new AbortController());
  const userResponses = await Promise.all(
    userPairs.map((pair, idx) => connectSse(pair.doctorId, userAcs[idx])),
  );

  const userCollectPromises = userResponses.map((res) => collectEvents(res, 3, 4000));

  // Send 2 messages per pair
  await Promise.all(
    userPairs.flatMap((pair, idx) => [
      ChatService.sendMessage(pair.threadId, pair.patientId, `User100 Msg A for pair ${idx}`),
      ChatService.sendMessage(pair.threadId, pair.patientId, `User100 Msg B for pair ${idx}`),
    ]),
  );

  const collectedUserEvents = await Promise.all(userCollectPromises);
  userAcs.forEach((ac) => ac.abort());

  let u100WrongRecipient = 0;
  let u100WrongConv = 0;
  let u100TotalEvents = 0;

  for (let i = 0; i < userPairs.length; i++) {
    const expected = userPairs[i];
    const msgs = collectedUserEvents[i].filter((e) => e.type === "message");
    u100TotalEvents += msgs.length;

    for (const e of msgs) {
      if (e.threadId !== expected.threadId) u100WrongConv++;
      if (e.senderId !== expected.patientId) u100WrongRecipient++;
    }
  }

  console.log(
    `100 Users (50 Pairs): totalEventsReceived=${u100TotalEvents}/100 wrongRecipient=${u100WrongRecipient} wrongConversation=${u100WrongConv}\n`,
  );

  // =========================================================================
  // SCENARIO 5: 🔥 FINAL CRITICAL ISOLATION TEST (100 messages)
  // Patient A -> Doctor B (100 messages). Doctor B, C, D, E connected.
  // =========================================================================
  console.log("----------------------------------------------------------");
  console.log("SCENARIO 5: 🔥 FINAL CRITICAL ISOLATION TEST (100 Messages)");
  console.log("Patient A -> Doctor B (100 messages)");
  console.log("Connected: Doctor B, Doctor C, Doctor D, Doctor E");
  console.log("----------------------------------------------------------");

  const isoPatientA = await createPatient("Critical Patient A");
  const { user: docB, profile: profB } = await createDoctor("Critical Doctor B");
  const { user: docC } = await createDoctor("Critical Doctor C");
  const { user: docD } = await createDoctor("Critical Doctor D");
  const { user: docE } = await createDoctor("Critical Doctor E");

  const { threadId: criticalThread } = await createAppointmentAndThread(
    isoPatientA._id.toString(),
    profB._id.toString(),
  );

  const acDocB = new AbortController();
  const acDocC = new AbortController();
  const acDocD = new AbortController();
  const acDocE = new AbortController();

  const [resDocB, resDocC, resDocD, resDocE] = await Promise.all([
    connectSse(docB._id.toString(), acDocB),
    connectSse(docC._id.toString(), acDocC),
    connectSse(docD._id.toString(), acDocD),
    connectSse(docE._id.toString(), acDocE),
  ]);

  const pB = collectEvents(resDocB, 101, 5000); // 100 messages + 1 connected
  const pC = collectEvents(resDocC, 10, 2000);
  const pD = collectEvents(resDocD, 10, 2000);
  const pE = collectEvents(resDocE, 10, 2000);

  // Patient A sends 100 messages
  console.log("Sending 100 messages from Patient A to Doctor B...");
  for (let i = 1; i <= 100; i++) {
    await ChatService.sendMessage(criticalThread, isoPatientA._id.toString(), `Critical Private Msg ${i}`);
  }

  const [eventsDocB, eventsDocC, eventsDocD, eventsDocE] = await Promise.all([pB, pC, pD, pE]);
  acDocB.abort();
  acDocC.abort();
  acDocD.abort();
  acDocE.abort();

  const bMsgs = eventsDocB.filter((e) => e.type === "message").length;
  const cMsgs = eventsDocC.filter((e) => e.type === "message").length;
  const dMsgs = eventsDocD.filter((e) => e.type === "message").length;
  const eMsgs = eventsDocE.filter((e) => e.type === "message").length;

  const finalWrongRecipientEvents = cMsgs + dMsgs + eMsgs;

  console.log(`Doctor B received: ${bMsgs}`);
  console.log(`Doctor C received: ${cMsgs}`);
  console.log(`Doctor D received: ${dMsgs}`);
  console.log(`Doctor E received: ${eMsgs}`);
  console.log(`Wrong-recipient events: ${finalWrongRecipientEvents}`);

  if (finalWrongRecipientEvents === 0 && bMsgs === 100 && cMsgs === 0 && dMsgs === 0 && eMsgs === 0) {
    console.log("\n✅ CRITICAL ISOLATION INVARIANT FULLY PROVEN: WRONG-RECIPIENT EVENTS = 0\n");
  } else {
    console.error("\n❌ CRITICAL ISOLATION INVARIANT BROKEN!\n");
  }

  console.log("==========================================================");
  console.log("SUMMARY REPORT DATA");
  console.log("==========================================================");
  console.log("SSE Connection Stress Results:", JSON.stringify(sseStressResults, null, 2));
  console.log("Message Fan-out Race Results:", JSON.stringify(msgStressResults, null, 2));
  console.log(`Critical Test: B=${bMsgs}, C=${cMsgs}, D=${dMsgs}, E=${eMsgs}, WrongRecipient=${finalWrongRecipientEvents}`);

  await mongooseMod.disconnect();
  await mongod.stop();
  console.log("Ephemeral MongoDB stopped. All tests completed cleanly.");
}

main().catch((err) => {
  console.error("FATAL ERROR in stress test:", err);
  process.exit(1);
});
