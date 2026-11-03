/**
 * Admin verdict on a Sunday consult: saved encrypted, returned in the admin
 * list, and clearing the note on a later save removes it.
 */
import { MongoMemoryServer } from "mongodb-memory-server";
import { randomBytes } from "crypto";
import { Types } from "mongoose";

jest.setTimeout(60000);

describe("SundayConsultService.setAdminOutcome", () => {
  let mongod: InstanceType<typeof MongoMemoryServer>;
  let mongooseMod: typeof import("mongoose");
  let SundayFreeRequestModel: typeof import("@zindagi/database").SundayFreeRequestModel;
  let SundayConsultService: typeof import("@/server/services/sunday-consult.service").SundayConsultService;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongod.getUri("sunday_admin_outcome_test");
    process.env.FIELD_ENCRYPTION_KEY = randomBytes(32).toString("base64");

    const db = await import("@zindagi/database");
    SundayFreeRequestModel = db.SundayFreeRequestModel;
    mongooseMod = (await import("mongoose")).default;
    await db.connectDatabase();
    ({ SundayConsultService } = await import("@/server/services/sunday-consult.service"));
  });

  afterAll(async () => {
    await mongooseMod.disconnect();
    await mongod.stop();
  });

  it("saves outcome + note, lists them, and clears the note when omitted", async () => {
    const request = await SundayFreeRequestModel.create({
      patientId: new Types.ObjectId(),
      patientPhone: "03001234567",
      sundayDateKey: "2026-11-01",
      status: "completed",
    });
    const requestId = request._id.toString();
    const adminId = new Types.ObjectId().toString();

    await SundayConsultService.setAdminOutcome(
      adminId,
      requestId,
      "not_completed",
      "Patient did not appear",
    );

    const raw = await SundayFreeRequestModel.collection.findOne({ _id: request._id });
    expect(raw?.adminNotes).not.toBe("Patient did not appear"); // encrypted at rest

    let [row] = await SundayConsultService.listAdminRequests("2026-11-01");
    expect(row.adminOutcome).toBe("not_completed");
    expect(row.adminNote).toBe("Patient did not appear");
    expect(row.adminOutcomeAt).toBeDefined();

    await SundayConsultService.setAdminOutcome(adminId, requestId, "well_completed");
    [row] = await SundayConsultService.listAdminRequests("2026-11-01");
    expect(row.adminOutcome).toBe("well_completed");
    expect(row.adminNote).toBeUndefined();
  });

  it("404s for an unknown request", async () => {
    await expect(
      SundayConsultService.setAdminOutcome(
        new Types.ObjectId().toString(),
        new Types.ObjectId().toString(),
        "well_completed",
      ),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});
