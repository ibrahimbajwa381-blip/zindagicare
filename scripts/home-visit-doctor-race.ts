import { MongoMemoryServer } from "mongodb-memory-server";
import { randomBytes } from "crypto";

async function main() {
  const mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri("doctor_race");
  process.env.FIELD_ENCRYPTION_KEY = randomBytes(32).toString("base64");

  const { connectDatabase, UserModel, DoctorProfileModel, HomeVisitModel } = await import("@zindagi/database");
  const mongooseMod = (await import("mongoose")).default;
  const { VerificationStatuses, HomeVisitServiceTypes, HomeVisitStatuses } = await import("@zindagi/shared");
  await connectDatabase();
  await HomeVisitModel.init();
  const { HomeVisitService } = await import("@/server/services/home-visit.service");

  let counter = 0;
  async function createPatient() {
    counter++;
    return UserModel.create({ name: `P${counter}`, email: `p${counter}-${Date.now()}@e.com`, phone: `+92300${counter.toString().padStart(7,"0")}`, roles: ["patient"], isActive: true });
  }
  async function createDoctor(iter: number) {
    counter++;
    const lng = 74.3587 + iter * 2; // geographically isolated per iteration
    const u = await UserModel.create({ name: `D${counter}`, email: `d${counter}-${Date.now()}@e.com`, phone: `+92331${counter.toString().padStart(7,"0")}`, roles: ["doctor"], isActive: true });
    await DoctorProfileModel.create({
      userId: u._id, isListed: true, verificationStatus: VerificationStatuses.APPROVED,
      consultationFee: 1500, specialties: ["General Physician"], coverageCities: ["Lahore"],
      homeVisitEnabled: true, homeVisitLocation: { area: "DHA", geo: { type: "Point", coordinates: [lng, 31.5204] } },
      weeklyAvailability: Array.from({ length: 7 }, (_, dayOfWeek) => ({ dayOfWeek, startTimeLocal: "00:00", endTimeLocal: "23:40" })),
    });
    return { user: u, lng };
  }

  const N = 5;
  const ITERATIONS = 25;
  let doubleBooked = 0, zero = 0, correct = 0;
  for (let iter = 0; iter < ITERATIONS; iter++) {
    const { user: doctor, lng } = await createDoctor(iter);
    const scheduledAt = new Date(Date.now() + 5 * 3600 * 1000);
    const visits = [];
    for (let i = 0; i < N; i++) {
      const patient = await createPatient();
      const v = await HomeVisitService.createRequest(patient._id.toString(), {
        serviceType: HomeVisitServiceTypes.DOCTOR_VISIT, scheduledAt: scheduledAt.toISOString(),
        addressLine: "addr", city: "Lahore", geo: { lng, lat: 31.5204 }, autoAssign: false,
      } as never);
      visits.push(v);
    }
    const results = await Promise.allSettled(visits.map((v) => HomeVisitService.autoAssignStaff(v.id)));
    const fulfilled = results.filter(r => r.status === "fulfilled").length;
    const finalDocs = await HomeVisitModel.find({ _id: { $in: visits.map(v=>v.id) } }).select("status assignedStaffId").lean();
    const assignedToThisDoctor = finalDocs.filter(d => d.status === HomeVisitStatuses.ASSIGNED && d.assignedStaffId?.toString() === doctor._id.toString()).length;
    let tag = "OK";
    if (assignedToThisDoctor > 1) { doubleBooked++; tag = "DOUBLE-BOOKED"; }
    else if (assignedToThisDoctor === 0) { zero++; tag = "ZERO"; }
    else correct++;
    console.log(`iter=${iter} N=${N} fulfilled=${fulfilled} assignedToThisDoctor=${assignedToThisDoctor} [${tag}]`);
  }
  console.log(`\nSUMMARY N=${N} over ${ITERATIONS} iters: correct=${correct} doubleBooked=${doubleBooked} zero=${zero}`);

  await mongooseMod.disconnect();
  await mongod.stop();
}
main().catch((e) => { console.error(e); process.exit(1); });
