import { MongoMemoryServer } from "mongodb-memory-server";
import { randomBytes } from "crypto";

async function main() {
  const mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri("race_debug2");
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

  const N = 100;
  const nurse = await createNurse();
  const scheduledAt = new Date(Date.now() + 5 * 3600 * 1000);
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
  const fulfilled = results.filter(r => r.status === "fulfilled").length;
  const rejMap = new Map<string, number>();
  results.forEach(r => { if (r.status === "rejected") { const m = (r.reason as {message?:string})?.message ?? String(r.reason); rejMap.set(m, (rejMap.get(m)??0)+1); }});
  console.log("fulfilled:", fulfilled, "rejections:", Object.fromEntries(rejMap));

  const finalDocs = await HomeVisitModel.find({ _id: { $in: visits.map(v=>v.id) } }).select("_id status assignedStaffId").sort({_id:1}).lean();
  const statusCounts = new Map<string, number>();
  finalDocs.forEach(d => statusCounts.set(d.status, (statusCounts.get(d.status)??0)+1));
  console.log("status breakdown:", Object.fromEntries(statusCounts));
  const assignedDocs = finalDocs.filter(d => d.status === HomeVisitStatuses.ASSIGNED);
  console.log("assigned docs:", assignedDocs.map(d => ({ id: d._id.toString(), staff: d.assignedStaffId?.toString() })));
  console.log("expected nurse id:", nurse._id.toString());

  await mongooseMod.disconnect();
  await mongod.stop();
}
main().catch((e) => { console.error(e); process.exit(1); });
