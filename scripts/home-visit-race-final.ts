import { MongoMemoryServer } from "mongodb-memory-server";
import { randomBytes } from "crypto";

async function main() {
  const mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri("race_final");
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
  // Each iteration's nurse is placed ~2 degrees (~220km) away from every other
  // iteration's nurse so tie-breaking across iterations (identical distance=0
  // ties) can NEVER happen -- isolates each iteration's race completely.
  async function createNurse(iter: number) {
    counter++;
    const lng = 74.3587 + iter * 2;
    const lat = 31.5204;
    const u = await UserModel.create({ name: `N${counter}`, email: `n${counter}-${Date.now()}@e.com`, phone: `+92321${counter.toString().padStart(7,"0")}`, roles: [Roles.NURSE], isActive: true });
    await StaffProfileModel.create({
      userId: u._id, staffType: Roles.NURSE, homeVisitEnabled: true, isAvailable: true, verificationStatus: "approved",
      serviceAreas: [{ city: "Lahore", area: "DHA", geo: { type: "Point", coordinates: [lng, lat] }, radiusKm: 15 }],
    });
    return { user: u, lng, lat };
  }

  const ITERATIONS = 25;
  const N = 5;
  let doubleBookedCount = 0;
  let zeroAssignedCount = 0;
  let correctCount = 0;

  for (let iter = 0; iter < ITERATIONS; iter++) {
    const { user: nurse, lng, lat } = await createNurse(iter);
    const scheduledAt = new Date(Date.now() + 5 * 3600 * 1000); // same slot every iter is fine now -- nurses are geographically isolated
    const visits = [];
    for (let i = 0; i < N; i++) {
      const patient = await createPatient();
      const v = await HomeVisitService.createRequest(patient._id.toString(), {
        serviceType: HomeVisitServiceTypes.NURSE, scheduledAt: scheduledAt.toISOString(),
        addressLine: "addr", city: "Lahore", geo: { lng, lat }, autoAssign: false,
      } as never);
      visits.push(v);
    }
    const results = await Promise.allSettled(visits.map((v) => HomeVisitService.autoAssignStaff(v.id)));
    const fulfilledCount = results.filter(r => r.status === "fulfilled").length;
    const finalDocs = await HomeVisitModel.find({ _id: { $in: visits.map(v=>v.id) } }).select("status assignedStaffId").lean();
    const assignedToThisNurse = finalDocs.filter(d => d.status === HomeVisitStatuses.ASSIGNED && d.assignedStaffId?.toString() === nurse._id.toString()).length;
    const assignedToAnyone = finalDocs.filter(d => d.status === HomeVisitStatuses.ASSIGNED).length;

    let tag = "OK";
    if (assignedToThisNurse > 1) { doubleBookedCount++; tag = "DOUBLE-BOOKED"; }
    else if (assignedToThisNurse === 0) { zeroAssignedCount++; tag = "ZERO-ASSIGNED"; }
    else { correctCount++; }

    console.log(`iter=${iter} fulfilled=${fulfilledCount} assignedToThisNurse=${assignedToThisNurse} assignedToAnyone=${assignedToAnyone} [${tag}]`);
  }

  console.log(`\nSUMMARY over ${ITERATIONS} iterations of n=${N}: correct=${correctCount} doubleBooked=${doubleBookedCount} zeroAssigned=${zeroAssignedCount}`);

  await mongooseMod.disconnect();
  await mongod.stop();
}
main().catch((e) => { console.error(e); process.exit(1); });
