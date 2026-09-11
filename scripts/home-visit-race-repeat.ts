import { MongoMemoryServer } from "mongodb-memory-server";
import { randomBytes } from "crypto";

async function main() {
  const mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri("race_repeat");
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

  const ITERATIONS = 8;
  const N = 100;
  const outcomes: number[] = [];
  for (let iter = 0; iter < ITERATIONS; iter++) {
    const nurse = await createNurse();
    const scheduledAt = new Date(Date.now() + (iter + 1) * 20 * 3600 * 1000);
    const visits = [];
    for (let i = 0; i < N; i++) {
      const patient = await createPatient();
      const v = await HomeVisitService.createRequest(patient._id.toString(), {
        serviceType: HomeVisitServiceTypes.NURSE, scheduledAt: scheduledAt.toISOString(),
        addressLine: "addr", city: "Lahore", geo: { lng: 74.3587, lat: 31.5204 }, autoAssign: false,
      } as never);
      visits.push(v);
    }
    const results = await Promise.allSettled(visits.map((v) => HomeVisitService.autoAssignStaff(v.id)));
    const fulfilledCount = results.filter(r => r.status === "fulfilled").length;
    const finalDocs = await HomeVisitModel.find({ _id: { $in: visits.map(v=>v.id) } }).select("status assignedStaffId").lean();
    const assignedCount = finalDocs.filter(d => d.status === HomeVisitStatuses.ASSIGNED && d.assignedStaffId?.toString() === nurse._id.toString()).length;
    outcomes.push(assignedCount);
    console.log(`iter=${iter} fulfilled=${fulfilledCount} assignedCount=${assignedCount} MISMATCH=${fulfilledCount !== assignedCount}`);
  }
  console.log("ALL OUTCOMES:", outcomes);
  console.log("Any zero:", outcomes.some(o => o === 0), "Any >1:", outcomes.some(o => o > 1));

  await mongooseMod.disconnect();
  await mongod.stop();
}
main().catch((e) => { console.error(e); process.exit(1); });
