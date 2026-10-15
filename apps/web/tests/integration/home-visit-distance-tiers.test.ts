/**
 * Home visits beyond the 15 km match radius — doctors, nurses and physiotherapists.
 * Real local MongoDB + real services.
 *
 * Business rules:
 * - Search and matching rank providers: within 15 km, then within 30 km, then the patient's city.
 *   Physiotherapists additionally fall back to other cities; doctors and nurses are never
 *   auto-dispatched from another city (doctors must also list the city in coverage cities).
 * - Distance never blocks a booking or assignment; patients are warned instead.
 * - Non-distance checks (verified, taking home visits, free at that time) still apply.
 */
import { MongoMemoryServer } from "mongodb-memory-server";
import { randomBytes } from "crypto";

jest.setTimeout(60000);

/** Patient pin: central Lahore. One degree of latitude is ~111 km. */
const PATIENT = { lng: 74.3587, lat: 31.5204 };
const KM_PER_DEG_LAT = 111.19;
const north = (km: number): [number, number] => [PATIENT.lng, PATIENT.lat + km / KM_PER_DEG_LAT];
const KARACHI: [number, number] = [67.0011, 24.8607];

describe("Home-visit distance tiers (real local MongoDB)", () => {
  let mongod: InstanceType<typeof MongoMemoryServer>;
  let mongooseMod: typeof import("mongoose");
  let db: typeof import("@zindagi/database");
  let shared: typeof import("@zindagi/shared");
  let HomeVisitService: typeof import("@/server/services/home-visit.service").HomeVisitService;
  let PublicPhysiotherapistService: typeof import("@/server/services/public-physiotherapist.service").PublicPhysiotherapistService;
  let PublicNurseService: typeof import("@/server/services/public-nurse.service").PublicNurseService;
  let counter = 0;
  let slot = 0;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongod.getUri("home_visit_distance_tiers_test");
    process.env.FIELD_ENCRYPTION_KEY = randomBytes(32).toString("base64");

    db = await import("@zindagi/database");
    shared = await import("@zindagi/shared");
    mongooseMod = (await import("mongoose")).default;
    await db.connectDatabase();
    await db.UserModel.init();
    await db.StaffProfileModel.init();
    await db.DoctorProfileModel.init();
    await db.HomeVisitModel.init();

    ({ HomeVisitService } = await import("@/server/services/home-visit.service"));
    ({ PublicPhysiotherapistService } = await import(
      "@/server/services/public-physiotherapist.service"
    ));
    ({ PublicNurseService } = await import("@/server/services/public-nurse.service"));
  });

  afterAll(async () => {
    await mongooseMod.disconnect();
    await mongod.stop();
  });

  beforeEach(async () => {
    await Promise.all([
      db.UserModel.deleteMany({}),
      db.StaffProfileModel.deleteMany({}),
      db.DoctorProfileModel.deleteMany({}),
      db.HomeVisitModel.deleteMany({}),
    ]);
  });

  async function createPatient() {
    counter += 1;
    const user = await db.UserModel.create({
      name: `Distance Patient ${counter}`,
      email: `distance-patient-${counter}-${Date.now()}@example.com`,
      roles: ["patient"],
      isActive: true,
    });
    return user._id.toString();
  }

  async function createStaff(
    staffType: "physiotherapist" | "nurse",
    coordinates: [number, number],
    city: string,
    overrides: Record<string, unknown> = {},
  ) {
    counter += 1;
    const user = await db.UserModel.create({
      name: `Distance ${staffType} ${counter}`,
      email: `distance-${staffType}-${counter}-${Date.now()}@example.com`,
      roles: [staffType],
      isActive: true,
    });
    await db.StaffProfileModel.create({
      userId: user._id,
      staffType,
      verificationStatus: "approved",
      verifiedAt: new Date(),
      homeVisitEnabled: true,
      isAvailable: true,
      homeVisitFee: 3000,
      serviceAreas: [{ city, area: "Area", radiusKm: 15, geo: { type: "Point", coordinates } }],
      ...overrides,
    });
    return user._id.toString();
  }

  const createPhysio = (
    coordinates: [number, number],
    city = "Lahore",
    overrides: Record<string, unknown> = {},
  ) => createStaff("physiotherapist", coordinates, city, overrides);

  /** Staff override for a single service area with its own coverage radius. */
  const withRadius = (coordinates: [number, number], radiusKm: number, city = "Lahore") => ({
    serviceAreas: [{ city, area: "Area", radiusKm, geo: { type: "Point", coordinates } }],
  });

  const createNurse = (
    coordinates: [number, number],
    city = "Lahore",
    overrides: Record<string, unknown> = {},
  ) => createStaff("nurse", coordinates, city, overrides);

  async function createDoctor(
    coordinates: [number, number] | null,
    coverageCities = ["Lahore"],
    radiusKm?: number,
  ) {
    counter += 1;
    const user = await db.UserModel.create({
      name: `Distance Doctor ${counter}`,
      email: `distance-doctor-${counter}-${Date.now()}@example.com`,
      roles: ["doctor"],
      isActive: true,
    });
    await db.DoctorProfileModel.create({
      userId: user._id,
      isListed: true,
      verificationStatus: shared.VerificationStatuses.APPROVED,
      consultationFee: 1500,
      specialties: ["General Physician"],
      coverageCities,
      homeVisitEnabled: true,
      ...(coordinates
        ? { homeVisitLocation: { area: "Area", geo: { type: "Point", coordinates }, radiusKm } }
        : {}),
    });
    return user._id.toString();
  }

  function nextSlot() {
    slot += 1;
    return new Date(Date.now() + slot * 5 * 60 * 60 * 1000);
  }

  function physioBooking(scheduledAt: Date, overrides: Record<string, unknown> = {}) {
    return booking(shared.HomeVisitServiceTypes.PHYSIOTHERAPY, scheduledAt, overrides);
  }

  function booking(serviceType: string, scheduledAt: Date, overrides: Record<string, unknown> = {}) {
    return {
      serviceType,
      scheduledAt: scheduledAt.toISOString(),
      addressLine: "House 12, Street 5, Gulberg",
      city: "Lahore",
      geo: PATIENT,
      autoAssign: false,
      ...overrides,
    } as never;
  }

  async function visitDoc(id: string) {
    const doc = await db.HomeVisitModel.findById(id).lean();
    if (!doc) throw new Error("visit missing");
    return doc;
  }

  describe("physiotherapists: direct booking", () => {
    it.each([
      ["beyond 15 km", 20],
      ["beyond 30 km", 45],
    ])("books and assigns a physio %s", async (_label, km) => {
      const patientId = await createPatient();
      const physioId = await createPhysio(north(km));

      const result = await HomeVisitService.createRequest(
        patientId,
        physioBooking(nextSlot(), { preferredStaffId: physioId }),
      );

      const doc = await visitDoc(result.id);
      expect(doc.status).toBe(shared.HomeVisitStatuses.ASSIGNED);
      expect(doc.assignedStaffId?.toString()).toBe(physioId);
      // The real distance is recorded so the patient can be told the physio is far away.
      expect(doc.pricing?.distance).toBeGreaterThan(km - 1);
      expect(doc.pricing?.distance).toBeLessThan(km + 1);
      expect(doc.pricing?.base).toBe(3000);
    });

    it("books a physio in another city", async () => {
      const patientId = await createPatient();
      const physioId = await createPhysio(KARACHI, "Karachi");

      const result = await HomeVisitService.createRequest(
        patientId,
        physioBooking(nextSlot(), { preferredStaffId: physioId }),
      );

      const doc = await visitDoc(result.id);
      expect(doc.address?.city).toBe("Lahore");
      expect(doc.status).toBe(shared.HomeVisitStatuses.ASSIGNED);
      expect(doc.assignedStaffId?.toString()).toBe(physioId);
      expect(doc.pricing?.distance).toBeGreaterThan(900);
    });

    it("books a physio whose location is unknown instead of rejecting", async () => {
      const physioId = await createPhysio(north(5), "Lahore", {
        serviceAreas: [{ city: "Lahore", area: "Area", radiusKm: 15 }],
      });

      await expect(
        HomeVisitService.assertPhysiotherapistBookable(physioId, PATIENT.lng, PATIENT.lat, nextSlot()),
      ).resolves.toEqual({ homeVisitFee: 3000 });
    });

    it("still refuses a far physio who isn't taking home visits", async () => {
      const physioId = await createPhysio(north(45), "Lahore", { homeVisitEnabled: false });
      await expect(
        HomeVisitService.assertPhysiotherapistBookable(physioId, PATIENT.lng, PATIENT.lat, nextSlot()),
      ).rejects.toMatchObject({ statusCode: 400, message: expect.stringContaining("isn't taking") });
    });

    it("still refuses a far physio who is already booked at that time", async () => {
      const physioId = await createPhysio(north(45));
      const when = nextSlot();
      await HomeVisitService.createRequest(
        await createPatient(),
        physioBooking(when, { preferredStaffId: physioId }),
      );

      await expect(
        HomeVisitService.createRequest(
          await createPatient(),
          physioBooking(when, { preferredStaffId: physioId }),
        ),
      ).rejects.toMatchObject({ statusCode: 409 });
    });

    it("lets an admin assign a far physio without the manual override", async () => {
      const patientId = await createPatient();
      const physioId = await createPhysio(north(45));
      const result = await HomeVisitService.createRequest(patientId, physioBooking(nextSlot()));

      const assigned = await HomeVisitService.assignStaff(result.id, {
        staffId: physioId,
        override: false,
      });
      expect(assigned.staffId).toBe(physioId);
      expect(assigned.distanceKm).toBeGreaterThan(30);
    });
  });

  describe("physiotherapists: automatic matching", () => {
    const match = () =>
      HomeVisitService.findNearestAvailablePhysiotherapist(PATIENT.lng, PATIENT.lat, nextSlot());

    it("prefers a physio within 15 km", async () => {
      await createPhysio(north(20));
      const near = await createPhysio(north(5));
      await createPhysio(KARACHI, "Karachi");

      expect(await match()).toMatchObject({ userId: near, reach: shared.HomeCareReaches.IN_RADIUS });
    });

    it("expands to 30 km when nobody is within 15 km", async () => {
      await createPhysio(north(45));
      const extended = await createPhysio(north(20));

      expect(await match()).toMatchObject({
        userId: extended,
        reach: shared.HomeCareReaches.EXTENDED,
      });
    });

    it("prefers the patient's city over a closer physio in another city beyond 30 km", async () => {
      // Kasur-labelled physio is closer, but the Lahore one serves the patient's city.
      await createPhysio(north(35), "Kasur");
      const sameCity = await createPhysio(north(45), "Lahore");

      expect(await match()).toMatchObject({
        userId: sameCity,
        reach: shared.HomeCareReaches.SAME_CITY,
      });
    });

    it("falls back to a physio in another city rather than leaving the visit unmatched", async () => {
      const other = await createPhysio(KARACHI, "Karachi");
      expect(await match()).toMatchObject({ userId: other, reach: shared.HomeCareReaches.FAR });
    });

    it("skips a busy nearby physio and moves to the next tier", async () => {
      const near = await createPhysio(north(5));
      const extended = await createPhysio(north(20));
      const when = nextSlot();
      await HomeVisitService.createRequest(
        await createPatient(),
        physioBooking(when, { preferredStaffId: near }),
      );

      const result = await HomeVisitService.findNearestAvailablePhysiotherapist(
        PATIENT.lng,
        PATIENT.lat,
        when,
      );
      expect(result?.userId).toBe(extended);
    });

    it("auto-assigns a booking beyond 30 km through the normal booking flow", async () => {
      const patientId = await createPatient();
      const physioId = await createPhysio(north(45));

      const result = await HomeVisitService.createRequest(
        patientId,
        physioBooking(nextSlot(), { autoAssign: true }),
      );

      const doc = await visitDoc(result.id);
      expect(doc.status).toBe(shared.HomeVisitStatuses.ASSIGNED);
      expect(doc.assignedStaffId?.toString()).toBe(physioId);
      expect(doc.pricing?.distance).toBeGreaterThan(30);
    });

    it("never invents a match when no physio is free", async () => {
      await createPhysio(north(5), "Lahore", { isAvailable: false });
      expect(await match()).toBeNull();
    });
  });

  describe("physiotherapists: directory search", () => {
    const near = { lng: PATIENT.lng, lat: PATIENT.lat };

    it("lists everyone, ranked own radius → 30 km → same city → other cities", async () => {
      const other = await createPhysio(KARACHI, "Karachi");
      const sameCity = await createPhysio(north(45), "Lahore");
      const extended = await createPhysio(north(20));
      const close = await createPhysio(north(5));

      const rows = await PublicPhysiotherapistService.list({ near });
      expect(rows.map((r) => r.id)).toEqual([close, extended, sameCity, other]);
      expect(rows.map((r) => r.reach)).toEqual([
        shared.HomeCareReaches.IN_RADIUS,
        shared.HomeCareReaches.EXTENDED,
        shared.HomeCareReaches.SAME_CITY,
        shared.HomeCareReaches.FAR,
      ]);
    });

    it("nearby-only expands to 30 km, then the same city, then anywhere", async () => {
      const sameCity = await createPhysio(north(45), "Lahore");
      const extended = await createPhysio(north(20));
      expect((await PublicPhysiotherapistService.list({ near, nearbyOnly: true })).map((r) => r.id)).toEqual([
        extended,
      ]);

      await db.StaffProfileModel.deleteOne({ userId: extended });
      expect((await PublicPhysiotherapistService.list({ near, nearbyOnly: true })).map((r) => r.id)).toEqual([
        sameCity,
      ]);

      await db.StaffProfileModel.deleteOne({ userId: sameCity });
      const other = await createPhysio(KARACHI, "Karachi");
      expect((await PublicPhysiotherapistService.list({ near, nearbyOnly: true })).map((r) => r.id)).toEqual([
        other,
      ]);
    });

    it("ranks physios who can't take a visit after bookable ones", async () => {
      await createPhysio(north(2), "Lahore", { isAvailable: false });
      const bookable = await createPhysio(north(20));

      const rows = await PublicPhysiotherapistService.list({ near });
      expect(rows[0]?.id).toBe(bookable);
    });
  });

  describe("nurses", () => {
    const near = { lng: PATIENT.lng, lat: PATIENT.lat };
    const match = (when = nextSlot()) =>
      HomeVisitService.findNearestAvailableStaff(PATIENT.lng, PATIENT.lat, when);

    it.each([
      ["beyond 15 km", 20],
      ["beyond 30 km", 45],
    ])("books and assigns a chosen nurse %s", async (_label, km) => {
      const nurseId = await createNurse(north(km));
      const result = await HomeVisitService.createRequest(
        await createPatient(),
        booking(shared.HomeVisitServiceTypes.NURSE, nextSlot(), { preferredStaffId: nurseId }),
      );

      const doc = await visitDoc(result.id);
      expect(doc.status).toBe(shared.HomeVisitStatuses.ASSIGNED);
      expect(doc.assignedStaffId?.toString()).toBe(nurseId);
      expect(doc.pricing?.distance).toBeGreaterThan(km - 1);
    });

    it("books a chosen nurse in another city", async () => {
      const nurseId = await createNurse(KARACHI, "Karachi");
      const result = await HomeVisitService.createRequest(
        await createPatient(),
        booking(shared.HomeVisitServiceTypes.NURSE, nextSlot(), { preferredStaffId: nurseId }),
      );
      expect((await visitDoc(result.id)).assignedStaffId?.toString()).toBe(nurseId);
    });

    it("still refuses a far nurse who is already booked at that time", async () => {
      const nurseId = await createNurse(north(45));
      const when = nextSlot();
      await HomeVisitService.createRequest(
        await createPatient(),
        booking(shared.HomeVisitServiceTypes.NURSE, when, { preferredStaffId: nurseId }),
      );
      await expect(
        HomeVisitService.assertNurseBookable(nurseId, PATIENT.lng, PATIENT.lat, when),
      ).rejects.toMatchObject({ statusCode: 409 });
    });

    it("auto-matches 15 km, then 30 km, then the whole city", async () => {
      const sameCity = await createNurse(north(45), "Lahore");
      await createNurse(north(35), "Kasur"); // closer, but another city
      expect(await match()).toMatchObject({
        userId: sameCity,
        reach: shared.HomeCareReaches.SAME_CITY,
      });

      const extended = await createNurse(north(20));
      expect(await match()).toMatchObject({
        userId: extended,
        reach: shared.HomeCareReaches.EXTENDED,
      });

      const close = await createNurse(north(5));
      expect(await match()).toMatchObject({
        userId: close,
        reach: shared.HomeCareReaches.IN_RADIUS,
      });
    });

    it("a small coverage radius never excludes a nurse — they just rank lower", async () => {
      const nurseId = await createNurse(north(10), "Lahore", {
        serviceAreas: [
          { city: "Lahore", area: "Area", radiusKm: 2, geo: { type: "Point", coordinates: north(10) } },
        ],
      });
      expect(await match()).toMatchObject({ userId: nurseId, reach: shared.HomeCareReaches.NEAR });
    });

    it("never auto-dispatches a nurse from another city", async () => {
      await createNurse(KARACHI, "Karachi");
      expect(await match()).toBeNull();
    });

    it("admin auto-assign reaches a nurse beyond 30 km in the patient's city", async () => {
      const nurseId = await createNurse(north(45));
      const result = await HomeVisitService.createRequest(
        await createPatient(),
        booking(shared.HomeVisitServiceTypes.NURSE, nextSlot()),
      );

      const assigned = await HomeVisitService.autoAssignStaff(result.id);
      expect(assigned).toMatchObject({ staffId: nurseId, reach: shared.HomeCareReaches.SAME_CITY });
      expect(assigned.distanceKm).toBeGreaterThan(30);
    });

    it("admin can assign a nurse in another city without the manual override", async () => {
      const nurseId = await createNurse(KARACHI, "Karachi");
      const result = await HomeVisitService.createRequest(
        await createPatient(),
        booking(shared.HomeVisitServiceTypes.NURSE, nextSlot()),
      );
      const assigned = await HomeVisitService.assignStaff(result.id, {
        staffId: nurseId,
        override: false,
      });
      expect(assigned.staffId).toBe(nurseId);
    });

    it("admin candidate list starts from the closest tier with someone free", async () => {
      await createNurse(north(45));
      const extended = await createNurse(north(20));
      const result = await HomeVisitService.createRequest(
        await createPatient(),
        booking(shared.HomeVisitServiceTypes.NURSE, nextSlot()),
      );

      const lists = await HomeVisitService.listStaffForVisit(result.id);
      expect(lists.tier).toBe(shared.HomeCareReaches.EXTENDED);
      expect(lists.nearby.map((c) => c.id)).toEqual([extended]);
      expect(lists.all).toHaveLength(2);
    });

    it("directory ranks everyone and nearby-only stops at the patient's city", async () => {
      const other = await createNurse(KARACHI, "Karachi");
      const sameCity = await createNurse(north(45), "Lahore");
      const extended = await createNurse(north(20));

      const rows = await PublicNurseService.list({ near });
      expect(rows.map((r) => r.id)).toEqual([extended, sameCity, other]);

      expect((await PublicNurseService.list({ near, nearbyOnly: true })).map((r) => r.id)).toEqual([
        extended,
      ]);
      await db.StaffProfileModel.deleteMany({ userId: { $in: [extended, sameCity] } });
      expect(await PublicNurseService.list({ near, nearbyOnly: true })).toEqual([]);
    });
  });

  describe("doctors", () => {
    const match = (city = "Lahore") =>
      HomeVisitService.findNearestAvailableDoctor(PATIENT.lng, PATIENT.lat, city, nextSlot());

    it("matches 15 km, then 30 km, then any doctor covering the city", async () => {
      const cityWide = await createDoctor(north(45));
      expect(await match()).toMatchObject({
        userId: cityWide,
        reach: shared.HomeCareReaches.SAME_CITY,
      });

      const extended = await createDoctor(north(20));
      expect(await match()).toMatchObject({
        userId: extended,
        reach: shared.HomeCareReaches.EXTENDED,
      });

      const close = await createDoctor(north(5));
      expect(await match()).toMatchObject({
        userId: close,
        reach: shared.HomeCareReaches.IN_RADIUS,
      });
    });

    it("matches a doctor covering the city even without a saved location", async () => {
      const doctorId = await createDoctor(null);
      expect(await match()).toMatchObject({
        userId: doctorId,
        distanceKm: null,
        reach: shared.HomeCareReaches.SAME_CITY,
      });
    });

    it("never matches a doctor who doesn't cover the patient's city", async () => {
      await createDoctor(north(5), ["Karachi"]);
      expect(await match()).toBeNull();
    });

    it("auto-assigns a doctor beyond 30 km through the normal flow", async () => {
      const doctorId = await createDoctor(north(45));
      const result = await HomeVisitService.createRequest(
        await createPatient(),
        booking(shared.HomeVisitServiceTypes.DOCTOR_VISIT, nextSlot()),
      );

      const assigned = await HomeVisitService.autoAssignStaff(result.id);
      expect(assigned).toMatchObject({ staffId: doctorId, role: "doctor" });
      expect(assigned.distanceKm).toBeGreaterThan(30);
      expect((await visitDoc(result.id)).status).toBe(shared.HomeVisitStatuses.ASSIGNED);
    });

    it("admin assigns a far doctor without the override, but coverage city still applies", async () => {
      const far = await createDoctor(north(45));
      const elsewhere = await createDoctor(north(5), ["Karachi"]);
      const result = await HomeVisitService.createRequest(
        await createPatient(),
        booking(shared.HomeVisitServiceTypes.DOCTOR_VISIT, nextSlot()),
      );

      await expect(
        HomeVisitService.assignStaff(result.id, { staffId: elsewhere, override: true }),
      ).rejects.toMatchObject({ statusCode: 400 });

      const assigned = await HomeVisitService.assignStaff(result.id, {
        staffId: far,
        override: false,
      });
      expect(assigned.staffId).toBe(far);
    });
  });

  describe("coverage-radius preference", () => {
    const near = { lng: PATIENT.lng, lat: PATIENT.lat };

    it("ranks a nurse whose own radius covers the patient above a closer one whose doesn't", async () => {
      // 10 km away but only travels 5 km.
      await createNurse(north(10), "Lahore", withRadius(north(10), 5));
      // 25 km away and happy to travel 30 km.
      const willing = await createNurse(north(25), "Lahore", withRadius(north(25), 30));

      expect(
        await HomeVisitService.findNearestAvailableStaff(PATIENT.lng, PATIENT.lat, nextSlot()),
      ).toMatchObject({ userId: willing, reach: shared.HomeCareReaches.IN_RADIUS, coverageRadiusKm: 30 });
    });

    it("then expands 15 km → 30 km → city for providers outside their own radius", async () => {
      const ids = {
        near: await createPhysio(north(10), "Lahore", withRadius(north(10), 5)),
        extended: await createPhysio(north(20), "Lahore", withRadius(north(20), 5)),
        city: await createPhysio(north(45), "Lahore", withRadius(north(45), 5)),
        inRadius: await createPhysio(north(28), "Lahore", withRadius(north(28), 40)),
      };

      const rows = await PublicPhysiotherapistService.list({ near });
      expect(rows.map((r) => r.id)).toEqual([ids.inRadius, ids.near, ids.extended, ids.city]);
      expect(rows.map((r) => r.reach)).toEqual([
        shared.HomeCareReaches.IN_RADIUS,
        shared.HomeCareReaches.NEAR,
        shared.HomeCareReaches.EXTENDED,
        shared.HomeCareReaches.SAME_CITY,
      ]);
      expect(rows[0]?.coverageRadiusKm).toBe(40);
    });

    it("books a patient-selected nurse and physio outside their own radius", async () => {
      const nurseId = await createNurse(north(10), "Lahore", withRadius(north(10), 2));
      const physioId = await createPhysio(north(20), "Lahore", withRadius(north(20), 5));

      const nurseVisit = await HomeVisitService.createRequest(
        await createPatient(),
        booking(shared.HomeVisitServiceTypes.NURSE, nextSlot(), { preferredStaffId: nurseId }),
      );
      const physioVisit = await HomeVisitService.createRequest(
        await createPatient(),
        physioBooking(nextSlot(), { preferredStaffId: physioId }),
      );

      expect((await visitDoc(nurseVisit.id)).assignedStaffId?.toString()).toBe(nurseId);
      expect((await visitDoc(physioVisit.id)).assignedStaffId?.toString()).toBe(physioId);
    });

    it("still enforces the time slot for a provider inside their own radius", async () => {
      const nurseId = await createNurse(north(5), "Lahore", withRadius(north(5), 20));
      const when = nextSlot();
      await HomeVisitService.createRequest(
        await createPatient(),
        booking(shared.HomeVisitServiceTypes.NURSE, when, { preferredStaffId: nurseId }),
      );
      await expect(
        HomeVisitService.assertNurseBookable(nurseId, PATIENT.lng, PATIENT.lat, when),
      ).rejects.toMatchObject({ statusCode: 409 });
      expect(
        await HomeVisitService.findNearestAvailableStaff(PATIENT.lng, PATIENT.lat, when),
      ).toBeNull();
    });

    it("prefers a doctor whose travel radius covers the patient, within the city only", async () => {
      await createDoctor(north(20)); // default 15 km radius — outside it
      const willing = await createDoctor(north(35), ["Lahore"], 40);
      await createDoctor(north(1), ["Karachi"], 50); // covers the pin, but not the city

      expect(
        await HomeVisitService.findNearestAvailableDoctor(
          PATIENT.lng,
          PATIENT.lat,
          "Lahore",
          nextSlot(),
        ),
      ).toMatchObject({ userId: willing, reach: shared.HomeCareReaches.IN_RADIUS, coverageRadiusKm: 40 });
    });

    it("keeps physios as the only provider auto-matched from another city", async () => {
      await createNurse(KARACHI, "Karachi", withRadius(KARACHI, 50, "Karachi"));
      await createDoctor(KARACHI, ["Karachi"], 50);
      const physio = await createPhysio(KARACHI, "Karachi", withRadius(KARACHI, 50, "Karachi"));
      const when = nextSlot();

      expect(await HomeVisitService.findNearestAvailableStaff(PATIENT.lng, PATIENT.lat, when)).toBeNull();
      expect(
        await HomeVisitService.findNearestAvailableDoctor(PATIENT.lng, PATIENT.lat, "Lahore", when),
      ).toBeNull();
      expect(
        await HomeVisitService.findNearestAvailablePhysiotherapist(PATIENT.lng, PATIENT.lat, when),
      ).toMatchObject({ userId: physio, reach: shared.HomeCareReaches.FAR });
    });

    it("saves a doctor's coverage radius and keeps it on later saves without one", async () => {
      const doctorId = await createDoctor(north(5));
      const { updateDoctorProfile } = await import("@/server/services/doctor-profile.service");

      const saved = await updateDoctorProfile(doctorId, {
        homeVisit: { enabled: true, area: "Gulberg", geo: { lng: north(5)[0], lat: north(5)[1] }, radiusKm: 25 },
      } as never);
      expect(saved.homeVisit.radiusKm).toBe(25);

      // A later save without a radius keeps the stored preference.
      const kept = await updateDoctorProfile(doctorId, {
        homeVisit: { enabled: true, area: "Gulberg", geo: { lng: north(6)[0], lat: north(6)[1] } },
      } as never);
      expect(kept.homeVisit.radiusKm).toBe(25);
    });

    it("defaults a doctor without a saved radius to 15 km", async () => {
      const doctorId = await createDoctor(north(5));
      const { getDoctorProfile } = await import("@/server/services/doctor-profile.service");
      expect((await getDoctorProfile(doctorId)).homeVisit.radiusKm).toBe(
        shared.HOME_CARE_MATCH_RADIUS_KM,
      );
    });
  });
});
