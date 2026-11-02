/**
 * Sunday free consult — preferred-specialty routing.
 *
 * A patient may optionally ask for a specialty (e.g. Gynecologist). Such a
 * request must only be visible to, notify, and be pickable by doctors whose
 * admin-verified `specialties` include it; requests without one stay open to
 * every verified doctor. Real local MongoDB (mongodb-memory-server) + the real
 * SundayConsultService, as in sunday-consult-concurrency.test.ts.
 */
import { MongoMemoryServer } from "mongodb-memory-server";
import { randomBytes } from "crypto";

jest.setTimeout(60000);

describe("Sunday free consult — preferred specialty routing", () => {
  let mongod: InstanceType<typeof MongoMemoryServer>;
  let mongooseMod: typeof import("mongoose");
  let UserModel: typeof import("@zindagi/database").UserModel;
  let DoctorProfileModel: typeof import("@zindagi/database").DoctorProfileModel;
  let SundayFreeRequestModel: typeof import("@zindagi/database").SundayFreeRequestModel;
  let AppointmentModel: typeof import("@zindagi/database").AppointmentModel;
  let VerificationStatuses: typeof import("@zindagi/shared").VerificationStatuses;
  let SundayAffordabilityChoices: typeof import("@zindagi/shared").SundayAffordabilityChoices;
  let SundayConsultService: typeof import("@/server/services/sunday-consult.service").SundayConsultService;
  let sundayFreeRequestSchema: typeof import("@zindagi/validators").sundayFreeRequestSchema;
  let counter = 0;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongod.getUri("sunday_specialty_test");
    process.env.FIELD_ENCRYPTION_KEY = randomBytes(32).toString("base64");

    const db = await import("@zindagi/database");
    UserModel = db.UserModel;
    DoctorProfileModel = db.DoctorProfileModel;
    SundayFreeRequestModel = db.SundayFreeRequestModel;
    AppointmentModel = db.AppointmentModel;
    mongooseMod = (await import("mongoose")).default;

    const shared = await import("@zindagi/shared");
    VerificationStatuses = shared.VerificationStatuses;
    SundayAffordabilityChoices = shared.SundayAffordabilityChoices;

    await db.connectDatabase();
    await AppointmentModel.init();
    await SundayFreeRequestModel.init();

    ({ SundayConsultService } = await import("@/server/services/sunday-consult.service"));
    ({ sundayFreeRequestSchema } = await import("@zindagi/validators"));
  });

  afterAll(async () => {
    await mongooseMod.disconnect();
    await mongod.stop();
  });

  function makePhone(roleTag: string, n: number) {
    return `+923${roleTag}${n.toString().padStart(8, "0")}`;
  }

  async function createPatient() {
    counter += 1;
    return UserModel.create({
      name: `Specialty Patient ${counter}`,
      email: `sunday-specialty-patient-${counter}-${Date.now()}@example.com`,
      phone: makePhone("5", counter),
      roles: ["patient"],
      isActive: true,
    });
  }

  async function createDoctor(
    specialties: string[],
    verificationStatus: "approved" | "pending" = VerificationStatuses.APPROVED,
  ) {
    counter += 1;
    const user = await UserModel.create({
      name: `Specialty Doctor ${counter}`,
      email: `sunday-specialty-doctor-${counter}-${Date.now()}@example.com`,
      phone: makePhone("6", counter),
      roles: ["doctor"],
      isActive: true,
    });
    return DoctorProfileModel.create({
      userId: user._id.toString(),
      isListed: true,
      verificationStatus,
      consultationFee: 0,
      specialties,
      coverageCities: ["Lahore"],
      sundayConsultEnabled: true,
    });
  }

  async function submit(preferredSpecialty?: string) {
    const patient = await createPatient();
    const result = await SundayConsultService.submitRequest(patient._id.toString(), {
      patientPhone: patient.phone!,
      history: [
        { key: "chief_complaint", answer: "Irregular cycle" },
        { key: "current_medications", answer: "None" },
        { key: "allergies", answer: "None" },
        { key: "chronic_conditions", answer: "None" },
        { key: "additional_info", answer: "None" },
      ],
      affordabilityChoice: SundayAffordabilityChoices.CANNOT_AFFORD,
      ...(preferredSpecialty ? { preferredSpecialty: preferredSpecialty as never } : {}),
    });
    if (result.kind !== "request") throw new Error(`expected request, got ${result.kind}`);
    return result;
  }

  async function boardIds(doctorUserId: string) {
    const rows = await SundayConsultService.listDoctorRequests(doctorUserId);
    return rows.map((row) => row.requestId);
  }

  type TestDoctor = { userId: { toString(): string } };
  let gynecologist: TestDoctor;
  let dermatologist: TestDoctor;

  beforeAll(async () => {
    gynecologist = await createDoctor(["Gynecologist"]);
    dermatologist = await createDoctor(["Dermatologist", "General Physician"]);
    // Pending doctors do not count toward requestable specialties.
    await createDoctor(["Cardiologist"], VerificationStatuses.PENDING);
  });

  test("requestable specialties = verified specialties of approved doctors", async () => {
    const specialties = await SundayConsultService.listRequestableSpecialties();
    expect(specialties).toEqual(["Dermatologist", "General Physician", "Gynecologist"]);
  });

  test("a specialty request is shown only to doctors verified in it", async () => {
    const gynRequest = await submit("Gynecologist");
    expect(gynRequest.preferredSpecialty).toBe("Gynecologist");

    const gynBoard = await boardIds(gynecologist.userId.toString());
    const dermBoard = await boardIds(dermatologist.userId.toString());
    expect(gynBoard).toContain(gynRequest.requestId);
    expect(dermBoard).not.toContain(gynRequest.requestId);

    const row = (await SundayConsultService.listDoctorRequests(gynecologist.userId.toString())).find(
      (r) => r.requestId === gynRequest.requestId,
    );
    expect(row?.preferredSpecialty).toBe("Gynecologist");
  });

  test("a request without a specialty is shown to every verified doctor", async () => {
    const anyRequest = await submit();
    expect(anyRequest.preferredSpecialty).toBeUndefined();
    expect(await boardIds(gynecologist.userId.toString())).toContain(anyRequest.requestId);
    expect(await boardIds(dermatologist.userId.toString())).toContain(anyRequest.requestId);
  });

  test("overdue specialty requests stay hidden from other specialties", async () => {
    const request = await submit("Dermatologist");
    await SundayFreeRequestModel.collection.updateOne(
      { _id: new mongooseMod.Types.ObjectId(request.requestId) },
      { $set: { sundayDateKey: "2020-01-05", createdAt: new Date("2020-01-01T00:00:00Z") } },
    );
    expect(await boardIds(dermatologist.userId.toString())).toContain(request.requestId);
    expect(await boardIds(gynecologist.userId.toString())).not.toContain(request.requestId);
  });

  test("a doctor outside the specialty cannot pick the request; a matching doctor can", async () => {
    const request = await submit("Gynecologist");

    await expect(
      SundayConsultService.claimRequest(dermatologist.userId.toString(), request.requestId, {
        startTimeLocal: "23:30",
      }),
    ).rejects.toMatchObject({ statusCode: 403 });

    const stillOpen = await SundayFreeRequestModel.findById(request.requestId).lean();
    expect(stillOpen?.status).toBe("requested");

    const picked = await SundayConsultService.claimRequest(
      gynecologist.userId.toString(),
      request.requestId,
      { startTimeLocal: "23:30" },
    );
    expect(picked.pickedByMe).toBe(true);
    expect(picked.preferredSpecialty).toBe("Gynecologist");
  });

  test("admin can open a specialty request to every doctor, once, while it waits", async () => {
    const request = await submit("Gynecologist");
    expect(await boardIds(dermatologist.userId.toString())).not.toContain(request.requestId);

    await SundayConsultService.openRequestToAllDoctors(request.requestId);

    expect(await boardIds(dermatologist.userId.toString())).toContain(request.requestId);
    expect(await boardIds(gynecologist.userId.toString())).toContain(request.requestId);
    await expect(
      SundayConsultService.openRequestToAllDoctors(request.requestId),
    ).rejects.toMatchObject({ statusCode: 409 });

    const picked = await SundayConsultService.claimRequest(
      dermatologist.userId.toString(),
      request.requestId,
      { startTimeLocal: "23:40" },
    );
    expect(picked.pickedByMe).toBe(true);
    await expect(
      SundayConsultService.openRequestToAllDoctors(request.requestId),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  test("sidebar badge count matches the doctor's board minus completed rows", async () => {
    for (const doctor of [gynecologist, dermatologist]) {
      const userId = doctor.userId.toString();
      const profile = await DoctorProfileModel.findOne({ userId }).lean();
      const board = await SundayConsultService.listDoctorRequests(userId);
      const open = board.filter((r) => r.status !== "completed").length;
      expect(open).toBeGreaterThan(0);
      expect(await SundayConsultService.countOpenDoctorRequests(profile!)).toBe(open);
    }
  });

  test("asking for a specialty no verified doctor holds is rejected", async () => {
    await expect(submit("Cardiologist")).rejects.toMatchObject({ statusCode: 400 });
  });

  test("validator treats an empty specialty as 'any doctor' and rejects unknown ones", () => {
    const base = {
      patientPhone: "03001234567",
      history: [
        { key: "chief_complaint", answer: "x" },
        { key: "current_medications", answer: "x" },
        { key: "allergies", answer: "x" },
        { key: "chronic_conditions", answer: "x" },
        { key: "additional_info", answer: "x" },
      ],
      affordabilityChoice: "cannot_afford",
    };
    const empty = sundayFreeRequestSchema.safeParse({ ...base, preferredSpecialty: "" });
    expect(empty.success).toBe(true);
    expect(empty.data?.preferredSpecialty).toBeUndefined();

    expect(sundayFreeRequestSchema.safeParse({ ...base, preferredSpecialty: "Gynecologist" }).success).toBe(true);
    expect(sundayFreeRequestSchema.safeParse({ ...base, preferredSpecialty: "Wizard" }).success).toBe(false);
  });
});
