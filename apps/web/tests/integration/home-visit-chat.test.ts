/**
 * Patient ↔ staff chat for home visits (nurse, physiotherapist, doctor visits):
 * opens on assignment, writable until the visit completes (or 72h after the
 * slot), read-only after, and never visible to anyone else.
 *
 * Real local MongoDB (mongodb-memory-server, ephemeral) + real HomeVisitService
 * assignment path and real ChatService. Only notification delivery is mocked.
 */
import { MongoMemoryServer } from "mongodb-memory-server";
import { randomBytes } from "crypto";

jest.mock("@/lib/auth", () => ({ auth: async () => null }));
jest.mock("@/lib/notifications/home-visit-notifications", () => ({
  notifyAdminsHomeVisitRequested: jest.fn(async () => {}),
  notifyPatientHomeVisitPaymentConfirmed: jest.fn(async () => {}),
  notifyPatientHomeVisitStatus: jest.fn(async () => {}),
  notifyStaffHomeVisitAssigned: jest.fn(async () => {}),
}));
// push.service loads web-push at module scope (see home-visit-assign-race.test.ts).
jest.mock("@/server/services/push.service", () => ({
  sendExpoPushToUser: jest.fn(),
  sendWebPushToUser: jest.fn(),
}));

jest.setTimeout(60000);

describe("Home visit chat (real local MongoDB)", () => {
  let mongod: InstanceType<typeof MongoMemoryServer>;
  let mongooseMod: typeof import("mongoose");
  let db: typeof import("@zindagi/database");
  let shared: typeof import("@zindagi/shared");
  let ChatService: typeof import("@/server/services/chat.service").ChatService;
  let HomeVisitService: typeof import("@/server/services/home-visit.service").HomeVisitService;

  const HOUR = 3_600_000;
  const LAHORE = { lng: 74.3587, lat: 31.5204 };
  let counter = 0;
  const nextEmail = () => `hv-chat-${Date.now()}-${counter++}@test.local`;
  const nextPhone = () => `+92304${Math.floor(1000000 + Math.random() * 9000000)}`;

  async function createUser(roles: import("@zindagi/shared").Role[], name: string) {
    const user = await db.UserModel.create({
      name,
      email: nextEmail(),
      phone: nextPhone(),
      roles,
      isActive: true,
    });
    return user._id.toString();
  }

  async function createStaff(staffType: "nurse" | "physiotherapist", specialties: string[] = []) {
    const userId = await createUser([staffType], `HV ${staffType}`);
    await db.StaffProfileModel.create({
      userId,
      staffType,
      homeVisitEnabled: true,
      isAvailable: true,
      verificationStatus: "approved",
      specialties,
      serviceAreas: [
        { city: "Lahore", area: "DHA", geo: { type: "Point", coordinates: [LAHORE.lng, LAHORE.lat] }, radiusKm: 15 },
      ],
    });
    return userId;
  }

  /** Visit created through the real request + manual-assignment path. */
  async function assignedVisit(patientId: string, staffId: string, serviceType: string) {
    const visit = (await HomeVisitService.createRequest(patientId, {
      serviceType,
      scheduledAt: new Date(Date.now() + 24 * HOUR + counter++ * 3 * HOUR).toISOString(),
      addressLine: "House 12, Street 5, DHA Phase 5",
      city: "Lahore",
      geo: LAHORE,
      autoAssign: false,
    } as never)) as { id: string };
    await HomeVisitService.assignStaff(visit.id, { staffId } as never);
    return visit.id;
  }

  const setStatus = (visitId: string, set: Record<string, unknown>) =>
    db.HomeVisitModel.updateOne({ _id: visitId }, { $set: set });

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongod.getUri("home_visit_chat");
    process.env.FIELD_ENCRYPTION_KEY = randomBytes(32).toString("base64");
    process.env.AUTH_SECRET = "test-secret-at-least-32-chars-long-12345";

    db = await import("@zindagi/database");
    shared = await import("@zindagi/shared");
    mongooseMod = (await import("mongoose")).default;
    await db.connectDatabase();
    // Build unique indexes now so fixture collisions fail every run, not by timing.
    await db.AppointmentModel.init();
    ({ ChatService } = await import("@/server/services/chat.service"));
    ({ HomeVisitService } = await import("@/server/services/home-visit.service"));
  });

  afterAll(async () => {
    await mongooseMod.disconnect();
    await mongod.stop();
  });

  test("assigning a nurse opens the chat in both inboxes, without an appointment", async () => {
    const patientId = await createUser(["patient"], "HV Patient");
    const nurseId = await createStaff("nurse", ["Wound care"]);
    await assignedVisit(patientId, nurseId, shared.HomeVisitServiceTypes.WOUND_CARE);

    const [patientThread] = await ChatService.listThreads(patientId);
    expect(patientThread).toMatchObject({
      isClosed: false,
      otherParticipant: { id: nurseId, role: "doctor", subtitle: "Wound care" },
    });
    expect(patientThread.appointmentId).toBeUndefined();

    const [nurseThread] = await ChatService.listThreads(nurseId);
    expect(nurseThread).toMatchObject({ id: patientThread.id, otherParticipant: { id: patientId, role: "patient" } });

    await ChatService.sendMessage(patientThread.id, patientId, "Please bring dressings");
    await ChatService.sendMessage(patientThread.id, nurseId, "On my way");
    expect(await ChatService.totalUnreadCount(patientId)).toBe(1);
    expect((await ChatService.listContacts(nurseId)).map((c) => c.id)).toEqual([patientId]);
  });

  test("chat stays writable en route and turns read-only once the visit completes", async () => {
    const patientId = await createUser(["patient"], "HV Patient");
    const physioId = await createStaff("physiotherapist");
    const visitId = await assignedVisit(patientId, physioId, shared.HomeVisitServiceTypes.PHYSIOTHERAPY);
    const opened = await ChatService.getOrCreateDirectThread(patientId, physioId);
    expect(opened.otherParticipant.subtitle).toBe("Physiotherapist");

    await setStatus(visitId, { status: shared.HomeVisitStatuses.EN_ROUTE });
    await expect(ChatService.sendMessage(opened.id, physioId, "Leaving now")).resolves.toBeDefined();

    await setStatus(visitId, { status: shared.HomeVisitStatuses.COMPLETED, completedAt: new Date() });
    const [thread] = await ChatService.listThreads(patientId);
    expect(thread).toMatchObject({ id: opened.id, isClosed: true });
    await expect(ChatService.sendMessage(opened.id, patientId, "Thanks")).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  test("an assigned visit left open turns read-only 72h after its slot", async () => {
    const patientId = await createUser(["patient"], "HV Patient");
    const nurseId = await createStaff("nurse");
    const visitId = await assignedVisit(patientId, nurseId, shared.HomeVisitServiceTypes.NURSE);
    await setStatus(visitId, { scheduledAt: new Date(Date.now() - 73 * HOUR) });

    const [thread] = await ChatService.listThreads(nurseId);
    expect(thread.isClosed).toBe(true);
  });

  test("requested (unassigned) and cancelled visits give no chat", async () => {
    const patientId = await createUser(["patient"], "HV Patient");
    const nurseId = await createStaff("nurse");
    const visitId = await assignedVisit(patientId, nurseId, shared.HomeVisitServiceTypes.NURSE);
    await setStatus(visitId, { status: shared.HomeVisitStatuses.CANCELLED });

    expect(await ChatService.listThreads(patientId)).toEqual([]);
    await expect(ChatService.getOrCreateDirectThread(patientId, nurseId)).rejects.toMatchObject({
      statusCode: 403,
    });
    expect(await ChatService.ensureHomeVisitThread(visitId)).toBeNull();
  });

  test("other staff cannot see, open or write to the chat", async () => {
    const patientId = await createUser(["patient"], "HV Patient");
    const nurseId = await createStaff("nurse");
    const otherNurseId = await createStaff("nurse");
    await assignedVisit(patientId, nurseId, shared.HomeVisitServiceTypes.NURSE);
    const [thread] = await ChatService.listThreads(patientId);

    expect(await ChatService.listThreads(otherNurseId)).toEqual([]);
    await expect(ChatService.getOrCreateDirectThread(otherNurseId, patientId)).rejects.toMatchObject({
      statusCode: 403,
    });
    await expect(ChatService.sendMessage(thread.id, otherNurseId, "Hi")).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  test("a doctor's home visit shares the thread with their consult and keeps its appointment", async () => {
    const patientId = await createUser(["patient"], "HV Patient");
    const doctorId = await createUser(["doctor"], "HV Doctor");
    const profile = await db.DoctorProfileModel.create({
      userId: doctorId,
      pmdcNumber: `PMDC-HV-${counter++}`,
      verificationStatus: shared.VerificationStatuses.APPROVED,
      isListed: true,
      specialties: ["General Physician"],
      consultationFee: 1500,
    });
    const appointment = await db.AppointmentModel.create({
      patientId,
      doctorId: profile._id,
      type: shared.AppointmentTypes.CLINIC,
      status: shared.AppointmentStatuses.COMPLETED,
      scheduledStart: new Date(Date.now() - 48 * HOUR),
      scheduledEnd: new Date(Date.now() - 47 * HOUR),
    });
    const consultThread = await ChatService.getOrCreateDirectThread(patientId, doctorId);
    expect(consultThread.isClosed).toBe(true);

    const visit = await db.HomeVisitModel.create({
      patientId,
      serviceType: shared.HomeVisitServiceTypes.DOCTOR_VISIT,
      status: shared.HomeVisitStatuses.ASSIGNED,
      assignedStaffId: doctorId,
      scheduledAt: new Date(Date.now() + 24 * HOUR),
      address: { line: "House 1", city: "Lahore", geo: { type: "Point", coordinates: [LAHORE.lng, LAHORE.lat] } },
      pricing: { total: 3000 },
    });

    expect(await ChatService.ensureHomeVisitThread(visit._id.toString())).toBe(consultThread.id);
    const [thread] = await ChatService.listThreads(patientId);
    expect(thread).toMatchObject({
      id: consultThread.id,
      isClosed: false,
      appointmentId: appointment._id.toString(),
    });
  });
});
