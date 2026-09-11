import { MongoMemoryServer } from "mongodb-memory-server";
import { randomBytes } from "crypto";

async function main() {
  const mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri("debug_zero");
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
  const nurseUser = await UserModel.create({ name: "Nurse", email: `nurse-${Date.now()}@e.com`, phone: "+923219999999", roles: [Roles.NURSE], isActive: true });
  await StaffProfileModel.create({
    userId: nurseUser._id, staffType: Roles.NURSE, homeVisitEnabled: true, isAvailable: true, verificationStatus: "approved",
    serviceAreas: [{ city: "Lahore", area: "DHA", geo: { type: "Point", coordinates: [74.3587, 31.5204] }, radiusKm: 15 }],
  });

  const scheduledAt = new Date(Date.now() + 5 * 3600 * 1000);
  const N = 100;
  const visits = [];
  for (let i = 0; i < N; i++) {
    const patient = await createPatient();
    const v = await HomeVisitService.createRequest(patient._id.toString(), {
      serviceType: HomeVisitServiceTypes.NURSE, scheduledAt: scheduledAt.toISOString(),
      addressLine: "addr", city: "Lahore", geo: { lng: 74.3587, lat: 31.5204 }, autoAssign: false,
    } as never);
    visits.push(v);
  }
  console.log("Visit _ids sorted:", visits.map(v => v.id).sort().slice(0,3), "...");

  const results = await Promise.allSettled(visits.map((v) => HomeVisitService.autoAssignStaff(v.id)));
  results.forEach((r, i) => {
    if (r.status === "fulfilled") console.log(`visit[${i}]=${visits[i].id} FULFILLED staffId=${(r.value as {staffId:string}).staffId}`);
  });
  const rejReasons = new Map<string, number>();
  results.forEach((r) => {
    if (r.status === "rejected") {
      const msg = (r.reason as { message?: string })?.message ?? String(r.reason);
      rejReasons.set(msg, (rejReasons.get(msg) ?? 0) + 1);
    }
  });
  console.log("Rejection reasons:", Object.fromEntries(rejReasons));

  const finalDocs = await HomeVisitModel.find({ _id: { $in: visits.map(v=>v.id) } }).select("_id status assignedStaffId").sort({_id:1}).lean();
  const assigned = finalDocs.filter(d => d.status === HomeVisitStatuses.ASSIGNED);
  console.log("Total assigned in DB:", assigned.length);
  console.log("Assigned doc ids:", assigned.map(d => d._id.toString()));
  console.log("Lowest _id overall:", finalDocs[0]._id.toString(), "its status:", finalDocs[0].status);

  await mongooseMod.disconnect();
  await mongod.stop();
}
main().catch((e) => { console.error(e); process.exit(1); });
