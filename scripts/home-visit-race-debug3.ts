import { MongoMemoryServer } from "mongodb-memory-server";
import { randomBytes } from "crypto";

async function main() {
  const mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri("race_debug3");
  process.env.FIELD_ENCRYPTION_KEY = randomBytes(32).toString("base64");

  const { connectDatabase, UserModel, StaffProfileModel, HomeVisitModel } = await import("@zindagi/database");
  const mongooseMod = (await import("mongoose")).default;
  const { Roles, HomeVisitServiceTypes, HomeVisitStatuses } = await import("@zindagi/shared");
  await connectDatabase();
  await HomeVisitModel.init();
  const { HomeVisitService } = await import("@/server/services/home-visit.service");

  let counter = 0;
  async function createPatient() {
    counter++;
    return UserModel.create({ name: `P${counter}`, email: `p${counter}-${Date.now()}@e.com`, phone: `+92300${counter.toString().padStart(7,"0")}`, roles: ["patient"], isActive: true });
  }
  async function createNurse() {
    counter++;
    const u = await UserModel.create({ name: `N${counter}`, email: `n${counter}-${Date.now()}@e.com`, phone: `+92321${counter.toString().padStart(7,"0")}`, roles: [Roles.NURSE], isActive: true });
    await StaffProfileModel.create({
      userId: u._id, staffType: Roles.NURSE, homeVisitEnabled: true, isAvailable: true, verificationStatus: "approved",
      serviceAreas: [{ city: "Lahore", area: "DHA", geo: { type: "Point", coordinates: [74.3587, 31.5204] }, radiusKm: 15 }],
    });
    return u;
  }

  async function round(iter: number) {
    const nurse = await createNurse();
    const scheduledAt = new Date(Date.now() + (iter + 1) * 20 * 3600 * 1000);
    const visits = [];
    for (let i = 0; i < 100; i++) {
      const patient = await createPatient();
      const v = await HomeVisitService.createRequest(patient._id.toString(), {
        serviceType: HomeVisitServiceTypes.NURSE, scheduledAt: scheduledAt.toISOString(),
        addressLine: "addr", city: "Lahore", geo: { lng: 74.3587, lat: 31.5204 }, autoAssign: false,
      } as never);
      visits.push(v);
    }
    const results = await Promise.allSettled(visits.map((v) => HomeVisitService.autoAssignStaff(v.id)));
    const fulfilledIdx = results.findIndex(r => r.status === "fulfilled");
    const winnerVisitId = fulfilledIdx >= 0 ? visits[fulfilledIdx].id : null;

    const finalDocs = await HomeVisitModel.find({ _id: { $in: visits.map(v=>v.id) } }).select("_id status assignedStaffId").sort({_id:1}).lean();
    const winnerDoc = finalDocs.find(d => d._id.toString() === winnerVisitId);
    const anyAssigned = finalDocs.filter(d => d.status === HomeVisitStatuses.ASSIGNED);
    console.log(`iter=${iter} winnerVisitId=${winnerVisitId} winnerDoc.status=${winnerDoc?.status} winnerDoc.assignedStaffId=${winnerDoc?.assignedStaffId?.toString() ?? "none"} nurseId=${nurse._id.toString()} totalAssignedDocs=${anyAssigned.length} lowestIdInBatch=${finalDocs[0]._id.toString()} isWinnerLowestId=${winnerVisitId === finalDocs[0]._id.toString()}`);
  }

  for (let i = 0; i < 5; i++) await round(i);

  await mongooseMod.disconnect();
  await mongod.stop();
}
main().catch((e) => { console.error(e); process.exit(1); });
