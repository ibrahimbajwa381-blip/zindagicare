/**
 * Chat access derived from consults (care core): one rule for paid and Sunday
 * free, any provider type, independent of account roles.
 *
 * Real local MongoDB (mongodb-memory-server, ephemeral) + real ChatService.
 */
import { MongoMemoryServer } from "mongodb-memory-server";
import { randomBytes } from "crypto";

jest.setTimeout(60000);

jest.mock("@/lib/auth", () => ({ auth: async () => null }));

describe("Chat access from consults (real local MongoDB)", () => {
  let mongod: InstanceType<typeof MongoMemoryServer>;
  let mongooseMod: typeof import("mongoose");
  let db: typeof import("@zindagi/database");
  let shared: typeof import("@zindagi/shared");
  let ChatService: typeof import("@/server/services/chat.service").ChatService;

  let counter = 0;
  const nextEmail = () => `care-chat-${Date.now()}-${counter++}@test.local`;
  const nextPhone = () => `+92302${Math.floor(1000000 + Math.random() * 9000000)}`;
  const HOUR = 3_600_000;
  // Fixed base + per-call offset: (doctorId, scheduledStart) is unique.
  const slotBase = Date.now();
  let slot = 0;

  async function createPatient() {
    const user = await db.UserModel.create({
      name: "Care Patient",
      email: nextEmail(),
      phone: nextPhone(),
      roles: [shared.Roles.PATIENT],
    });
    return user._id.toString();
  }

  async function createDoctor() {
    const user = await db.UserModel.create({
      name: "Care Doctor",
      email: nextEmail(),
      phone: nextPhone(),
      roles: [shared.Roles.DOCTOR],
    });
    const profile = await db.DoctorProfileModel.create({
      userId: user._id,
      pmdcNumber: `PMDC-${Date.now()}-${counter++}`,
      verificationStatus: shared.VerificationStatuses.APPROVED,
      isListed: true,
      specialties: ["General Physician"],
      consultationFee: 1500,
    });
    return { userId: user._id.toString(), profileId: profile._id.toString() };
  }

  async function book(
    patientId: string,
    profileId: string,
    overrides: Record<string, unknown> = {},
  ) {
    const appointment = await db.AppointmentModel.create({
      patientId,
      doctorId: profileId,
      type: shared.AppointmentTypes.SUNDAY_FREE,
      status: shared.AppointmentStatuses.CONFIRMED,
      scheduledStart: new Date(slotBase - HOUR - ++slot),
      scheduledEnd: new Date(slotBase + HOUR),
      ...overrides,
    });
    return appointment._id.toString();
  }

  async function bookPaidOnline(patientId: string, profileId: string) {
    const appointmentId = await book(patientId, profileId, {
      type: shared.AppointmentTypes.ONLINE,
    });
    const payment = await db.PaymentModel.create({
      userId: patientId,
      appointmentId,
      amount: 1500,
      status: shared.PaymentStatuses.PAID,
      provider: "jazzcash",
      externalTransactionId: `care-txn-${counter++}`,
    });
    await db.AppointmentModel.updateOne(
      { _id: appointmentId },
      { $set: { paymentId: payment._id } },
    );
    return appointmentId;
  }

  const complete = (appointmentId: string) =>
    db.AppointmentModel.updateOne(
      { _id: appointmentId },
      { $set: { status: shared.AppointmentStatuses.COMPLETED } },
    );

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongod.getUri("care_chat_access");
    process.env.FIELD_ENCRYPTION_KEY = randomBytes(32).toString("base64");
    process.env.AUTH_SECRET = "test-secret-at-least-32-chars-long-12345";

    db = await import("@zindagi/database");
    shared = await import("@zindagi/shared");
    mongooseMod = (await import("mongoose")).default;
    await db.connectDatabase();
    // Build unique indexes now so fixture collisions fail every run, not by timing.
    await db.AppointmentModel.init();
    ({ ChatService } = await import("@/server/services/chat.service"));
  });

  afterAll(async () => {
    await mongooseMod.disconnect();
    await mongod.stop();
  });

  test("legacy doctor+patient account that booked another doctor keeps the chat in its inbox", async () => {
    // Regression: the inbox only checked the doctor side for any account holding
    // the doctor role, so a doctor's own booking vanished seconds after opening.
    const booker = await createDoctor();
    await db.UserModel.collection.updateOne(
      { _id: new mongooseMod.Types.ObjectId(booker.userId) },
      { $set: { roles: [shared.Roles.DOCTOR, shared.Roles.PATIENT] } },
    );
    const treating = await createDoctor();
    await bookPaidOnline(booker.userId, treating.profileId);

    const opened = await ChatService.getOrCreateDirectThread(booker.userId, treating.profileId);
    await ChatService.sendMessage(opened.id, treating.userId, "Hello");

    const threads = await ChatService.listThreads(booker.userId);
    expect(threads.map((t) => t.id)).toEqual([opened.id]);
    expect(threads[0].otherParticipant).toMatchObject({ id: treating.userId, role: "doctor" });
    expect(await ChatService.totalUnreadCount(booker.userId)).toBe(1);
    expect((await ChatService.listContacts(booker.userId)).map((c) => c.id)).toEqual([
      treating.userId,
    ]);
  });

  test("Sunday free consult chats like a paid one and turns read-only when completed", async () => {
    const patientId = await createPatient();
    const doctor = await createDoctor();
    const appointmentId = await book(patientId, doctor.profileId);

    const opened = await ChatService.getOrCreateDirectThread(patientId, doctor.userId);
    expect(opened.isClosed).toBe(false);
    await ChatService.sendMessage(opened.id, patientId, "Before the call");

    await complete(appointmentId);

    const [thread] = await ChatService.listThreads(patientId);
    expect(thread).toMatchObject({ id: opened.id, isClosed: true });
    await expect(ChatService.sendMessage(opened.id, doctor.userId, "After")).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  test("completed paid consult closes the chat; a new booking reopens the same thread", async () => {
    const patientId = await createPatient();
    const doctor = await createDoctor();
    const first = await bookPaidOnline(patientId, doctor.profileId);
    const opened = await ChatService.getOrCreateDirectThread(doctor.userId, patientId);

    await complete(first);
    expect((await ChatService.listThreads(doctor.userId))[0].isClosed).toBe(true);

    await bookPaidOnline(patientId, doctor.profileId);
    const reopened = await ChatService.getOrCreateDirectThread(patientId, doctor.userId);
    expect(reopened).toMatchObject({ id: opened.id, isClosed: false });
    await expect(ChatService.sendMessage(opened.id, patientId, "Follow-up")).resolves.toBeDefined();
  });

  test("an unfinished consult turns read-only 72h after its scheduled end", async () => {
    const patientId = await createPatient();
    const doctor = await createDoctor();
    await book(patientId, doctor.profileId, {
      scheduledStart: new Date(Date.now() - 74 * HOUR),
      scheduledEnd: new Date(Date.now() - 73 * HOUR),
    });

    const opened = await ChatService.getOrCreateDirectThread(patientId, doctor.userId);
    expect(opened.isClosed).toBe(true);
  });

  test("herbalist consults use the same chat through the provider registry", async () => {
    const patientId = await createPatient();
    const herbalistUser = await db.UserModel.create({
      name: "Care Herbalist",
      email: nextEmail(),
      phone: nextPhone(),
      roles: [shared.Roles.HERBALIST],
    });
    const profile = await db.HerbalistProfileModel.create({
      userId: herbalistUser._id,
      verificationStatus: shared.VerificationStatuses.APPROVED,
      isListed: true,
      specialties: ["Herbal Medicine"],
    });
    await book(patientId, profile._id.toString(), {
      providerRole: "herbalist",
      providerProfileId: profile._id,
    });

    const opened = await ChatService.getOrCreateDirectThread(patientId, profile._id.toString());
    expect(opened.otherParticipant).toMatchObject({
      id: herbalistUser._id.toString(),
      subtitle: "Herbal Medicine",
    });
    expect((await ChatService.listThreads(herbalistUser._id.toString())).map((t) => t.id)).toEqual([
      opened.id,
    ]);
  });

  test("users without a shared consult cannot open or write to a chat", async () => {
    const patientId = await createPatient();
    const doctor = await createDoctor();
    const outsider = await createDoctor();
    await book(patientId, doctor.profileId);
    const opened = await ChatService.getOrCreateDirectThread(patientId, doctor.userId);

    await expect(
      ChatService.getOrCreateDirectThread(outsider.userId, patientId),
    ).rejects.toMatchObject({ statusCode: 403 });
    await expect(
      ChatService.sendMessage(opened.id, outsider.userId, "Hi"),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(await ChatService.listThreads(outsider.userId)).toEqual([]);
  });
});
