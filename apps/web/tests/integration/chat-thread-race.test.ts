/**
 * Concurrent chat-thread creation (real local MongoDB via mongodb-memory-server).
 *
 * The only guard against duplicate doctor–patient threads is the unique
 * `directKey` / `appointmentId` indexes. Mongoose builds them in the
 * background after connecting, so on a fresh (or index-less) database,
 * simultaneous "open chat" requests could each insert a thread. These tests
 * recreate that window by dropping the indexes before the burst.
 */
import { MongoMemoryServer } from "mongodb-memory-server";
import { randomBytes } from "crypto";

jest.setTimeout(60000);

describe("chat thread creation under concurrency", () => {
  let mongod: InstanceType<typeof MongoMemoryServer>;
  let db: typeof import("@zindagi/database");
  let shared: typeof import("@zindagi/shared");
  let ChatService: typeof import("@/server/services/chat.service").ChatService;
  let mongooseMod: typeof import("mongoose");
  let counter = 0;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongod.getUri("chat_thread_race");
    process.env.FIELD_ENCRYPTION_KEY = randomBytes(32).toString("base64");
    db = await import("@zindagi/database");
    shared = await import("@zindagi/shared");
    mongooseMod = (await import("mongoose")).default;
    await db.connectDatabase();
    ChatService = (await import("@/server/services/chat.service")).ChatService;
  });

  afterAll(async () => {
    await mongooseMod.disconnect();
    await mongod.stop();
  });

  async function pairWithPaidAppointment() {
    const n = counter++;
    const patient = await db.UserModel.create({
      name: `Race Patient ${n}`,
      email: `race-p-${n}-${Date.now()}@test.local`,
      roles: [shared.Roles.PATIENT],
    });
    const doctor = await db.UserModel.create({
      name: `Race Doctor ${n}`,
      email: `race-d-${n}-${Date.now()}@test.local`,
      roles: [shared.Roles.DOCTOR],
    });
    const profile = await db.DoctorProfileModel.create({
      userId: doctor._id,
      pmdcNumber: `PMDC-RACE-${n}-${Date.now()}`,
      verificationStatus: shared.VerificationStatuses.APPROVED,
      isListed: true,
      specialties: ["General Physician"],
      consultationFee: 1500,
    });
    const appointment = await db.AppointmentModel.create({
      patientId: patient._id,
      doctorId: profile._id,
      type: shared.AppointmentTypes.ONLINE,
      status: shared.AppointmentStatuses.CONFIRMED,
      scheduledStart: new Date(Date.now() - 3600000),
      scheduledEnd: new Date(Date.now() + 3600000),
    });
    const payment = await db.PaymentModel.create({
      userId: patient._id,
      appointmentId: appointment._id,
      amount: 1500,
      status: shared.PaymentStatuses.PAID,
      provider: "jazzcash",
      externalTransactionId: `race-txn-${n}-${Date.now()}`,
    });
    await db.AppointmentModel.updateOne({ _id: appointment._id }, { $set: { paymentId: payment._id } });
    return { patientId: patient._id.toString(), doctorUserId: doctor._id.toString(), appointment };
  }

  /** Simulates a database where the unique indexes don't exist yet. */
  async function dropThreadIndexes() {
    await db.ChatThreadModel.init();
    await db.ChatThreadModel.collection.dropIndexes();
    const names = (await db.ChatThreadModel.collection.indexes()).map((i) => i.name);
    expect(names).toEqual(["_id_"]);
  }

  const threadsBetween = (a: string, b: string) =>
    db.ChatThreadModel.countDocuments({ participantIds: { $all: [a, b] }, deletedAt: null });

  test("10 simultaneous 'open chat' requests before the unique index exists create exactly one thread", async () => {
    await dropThreadIndexes();
    const { patientId, doctorUserId } = await pairWithPaidAppointment();

    const results = await Promise.all(
      Array.from({ length: 10 }, () => ChatService.getOrCreateDirectThread(patientId, doctorUserId)),
    );

    expect(new Set(results.map((r) => r.id)).size).toBe(1);
    expect(await threadsBetween(patientId, doctorUserId)).toBe(1);
  });

  test("simultaneous appointment-thread setup (booking/payment hooks) also converges on one thread", async () => {
    await dropThreadIndexes();
    const { patientId, doctorUserId, appointment } = await pairWithPaidAppointment();

    const ids = await Promise.all(
      Array.from({ length: 10 }, () => ChatService.ensureAppointmentThread(appointment._id.toString())),
    );

    expect(new Set(ids.map(String)).size).toBe(1);
    expect(await threadsBetween(patientId, doctorUserId)).toBe(1);
  });

  test("the unique indexes are restored by the first thread creation", async () => {
    await dropThreadIndexes();
    const { patientId, doctorUserId } = await pairWithPaidAppointment();
    await ChatService.getOrCreateDirectThread(patientId, doctorUserId);
    const indexes = await db.ChatThreadModel.collection.indexes();
    const unique = indexes.filter((i) => i.unique).map((i) => Object.keys(i.key)[0]).sort();
    expect(unique).toEqual(["appointmentId", "directKey"]);
  });

  test("mixed burst: patient and doctor open the chat at the same time from both sides", async () => {
    await dropThreadIndexes();
    const { patientId, doctorUserId } = await pairWithPaidAppointment();

    const results = await Promise.all(
      Array.from({ length: 12 }, (_, i) =>
        i % 2
          ? ChatService.getOrCreateDirectThread(patientId, doctorUserId)
          : ChatService.getOrCreateDirectThread(doctorUserId, patientId),
      ),
    );

    expect(new Set(results.map((r) => r.id)).size).toBe(1);
    expect(await threadsBetween(patientId, doctorUserId)).toBe(1);
  });

  /** Inserts threads the way past races did: same pair, same keys, no index to stop them. */
  async function insertLegacyDuplicates(patientId: string, doctorUserId: string, appointmentId: unknown, n: number) {
    const directKey = [patientId, doctorUserId].sort().join(":");
    const docs = Array.from({ length: n }, (_, i) => ({
      type: shared.ChatThreadTypes.DIRECT,
      directKey,
      appointmentId,
      participantIds: [patientId, doctorUserId],
      createdAt: new Date(Date.now() - (n - i) * 1000),
    }));
    await db.ChatThreadModel.collection.insertMany(
      docs.map((d) => ({ ...d, participantIds: d.participantIds.map((id) => new mongooseMod.Types.ObjectId(id)) })),
    );
  }

  test("opening a chat merges past duplicates so they stop blocking the unique index", async () => {
    await dropThreadIndexes();
    const { patientId, doctorUserId, appointment } = await pairWithPaidAppointment();
    await insertLegacyDuplicates(patientId, doctorUserId, appointment._id, 3);
    await expect(db.ChatThreadModel.createIndexes()).rejects.toThrow(/E11000/);

    const result = await ChatService.getOrCreateDirectThread(patientId, doctorUserId);

    expect(await threadsBetween(patientId, doctorUserId)).toBe(1);
    const merged = await db.ChatThreadModel.find({ participantIds: { $all: [patientId, doctorUserId] }, deletedAt: { $ne: null } }).lean();
    expect(merged).toHaveLength(2);
    for (const t of merged) {
      expect(t.directKey).toBeUndefined();
      expect(t.appointmentId).toBeUndefined();
    }
    expect(String(result.id)).not.toBe(String(merged[0]!._id));
    await expect(db.ChatThreadModel.createIndexes()).resolves.toBeUndefined();
  });

  test("normal case (indexes present): a 25-request burst returns one thread", async () => {
    await db.ChatThreadModel.createIndexes();
    const { patientId, doctorUserId } = await pairWithPaidAppointment();

    const results = await Promise.all(
      Array.from({ length: 25 }, () => ChatService.getOrCreateDirectThread(patientId, doctorUserId)),
    );

    expect(new Set(results.map((r) => r.id)).size).toBe(1);
    expect(await threadsBetween(patientId, doctorUserId)).toBe(1);
  });

  // Keep last: it leaves the module's retry cooldown armed.
  test("if old duplicates block the index: chat still works, log has no ids, the build isn't retried on every request", async () => {
    await dropThreadIndexes();
    const blocked = await pairWithPaidAppointment();
    // A duplicate set nobody has opened since, so nothing merges it.
    await insertLegacyDuplicates(blocked.patientId, blocked.doctorUserId, blocked.appointment._id, 2);

    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    const buildSpy = jest.spyOn(db.ChatThreadModel, "createIndexes");
    try {
      const a = await pairWithPaidAppointment();
      const first = await ChatService.getOrCreateDirectThread(a.patientId, a.doctorUserId);
      expect(first.id).toBeTruthy();
      expect(buildSpy).toHaveBeenCalledTimes(1);

      const logged = JSON.stringify(errorSpy.mock.calls);
      expect(logged).toContain("unique thread indexes unavailable");
      expect(logged).toContain("11000");
      expect(logged).not.toContain(blocked.patientId);
      expect(logged).not.toContain(blocked.doctorUserId);

      const b = await pairWithPaidAppointment();
      await ChatService.getOrCreateDirectThread(b.patientId, b.doctorUserId);
      expect(buildSpy).toHaveBeenCalledTimes(1); // within the 5-minute cooldown
    } finally {
      buildSpy.mockRestore();
      errorSpy.mockRestore();
    }
  });
});
