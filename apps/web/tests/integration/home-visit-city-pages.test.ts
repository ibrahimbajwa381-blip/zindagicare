/**
 * City home-visit landing pages (/home-services/[city]) — loader -> MongoDB -> sitemap, llms.txt
 * and page metadata. Runs against an ephemeral mongodb-memory-server seeded with providers that
 * must and must not produce a city page, so only the listing/home-visit filters decide.
 */
import { randomBytes } from "crypto";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import {
  connectDatabase,
  DoctorProfileModel,
  StaffProfileModel,
  UserModel,
} from "@zindagi/database";
import { VerificationStatuses } from "@zindagi/shared";

jest.mock("@/server/api/resolve-session", () => ({ resolveSession: jest.fn() }));

// First run downloads the MongoDB binary; the 5s Jest default is too tight.
jest.setTimeout(60000);

let counter = 0;

async function createUser(role: string, name: string, isActive = true) {
  counter += 1;
  return UserModel.create({
    name,
    email: `city-page-${counter}@example.com`,
    roles: [role],
    isActive,
  });
}

async function seedDoctor(opts: {
  name: string;
  cities: string[];
  homeVisitEnabled: boolean;
  status?: (typeof VerificationStatuses)[keyof typeof VerificationStatuses];
  homeVisitFee?: number;
}) {
  const user = await createUser("doctor", opts.name);
  await DoctorProfileModel.create({
    userId: user._id,
    isListed: true,
    verificationStatus: opts.status ?? VerificationStatuses.APPROVED,
    consultationFee: 1500,
    specialties: ["General Physician"],
    coverageCities: opts.cities,
    homeVisitEnabled: opts.homeVisitEnabled,
    homeVisitFee: opts.homeVisitFee ?? 0,
  });
}

async function seedStaff(opts: {
  staffType: "nurse" | "physiotherapist";
  name: string;
  city: string;
  homeVisitEnabled: boolean;
  homeVisitFee?: number;
  userActive?: boolean;
}) {
  const user = await createUser(opts.staffType, opts.name, opts.userActive ?? true);
  await StaffProfileModel.create({
    userId: user._id,
    staffType: opts.staffType,
    verificationStatus: VerificationStatuses.APPROVED,
    verifiedAt: new Date(),
    homeVisitEnabled: opts.homeVisitEnabled,
    isAvailable: true,
    homeVisitFee: opts.homeVisitFee,
    serviceAreas: [
      {
        city: opts.city,
        area: "Area",
        radiusKm: 15,
        geo: { type: "Point", coordinates: [73, 31] },
      },
    ],
  });
}

describe("Home-visit city pages (real local MongoDB)", () => {
  let mongod: MongoMemoryServer;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongod.getUri("home_visit_city_pages_test");
    process.env.FIELD_ENCRYPTION_KEY = randomBytes(32).toString("base64");
    await connectDatabase();

    // Should produce pages / appear on them.
    await seedDoctor({
      name: "Faisal Home Doc",
      cities: ["faisalabad "], // messy free text must still land on /faisalabad
      homeVisitEnabled: true,
      homeVisitFee: 4000,
    });
    await seedStaff({
      staffType: "physiotherapist",
      name: "Lahore Physio",
      city: "Lahore",
      homeVisitEnabled: true,
      homeVisitFee: 2500,
    });
    await seedStaff({
      staffType: "nurse",
      name: "Multan Nurse",
      city: "Multan",
      homeVisitEnabled: true,
      homeVisitFee: 2000,
    });

    // Must never produce a page.
    await seedDoctor({ name: "Quetta Clinic Only", cities: ["Quetta"], homeVisitEnabled: false });
    await seedDoctor({
      name: "Hyderabad Pending",
      cities: ["Hyderabad"],
      homeVisitEnabled: true,
      status: VerificationStatuses.PENDING,
    });
    await seedStaff({
      staffType: "nurse",
      name: "Peshawar No Visits",
      city: "Peshawar",
      homeVisitEnabled: false,
    });
    await seedStaff({
      staffType: "nurse",
      name: "Sialkot Deactivated",
      city: "Sialkot",
      homeVisitEnabled: true,
      userActive: false,
    });
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongod?.stop();
  });

  describe("listHomeVisitCities", () => {
    test("main cities come first and always exist, even with no listed provider", async () => {
      const { listHomeVisitCities } = await import("@/lib/seo/home-visit-cities");
      const cities = await listHomeVisitCities();

      expect(
        cities
          .slice(0, 3)
          .map((c) => c.slug)
          .sort(),
      ).toEqual(["faisalabad", "karachi", "lahore"]);
      expect(cities.slice(0, 3).every((c) => c.isMain)).toBe(true);

      const karachi = cities.find((c) => c.slug === "karachi")!;
      expect(karachi.doctors.length + karachi.nurses.length + karachi.physiotherapists.length).toBe(
        0,
      );
    });

    test("other cities appear only with a listed, approved provider who takes home visits", async () => {
      const { listHomeVisitCities } = await import("@/lib/seo/home-visit-cities");
      const slugs = (await listHomeVisitCities()).map((c) => c.slug);

      expect(slugs).toContain("multan");
      for (const excluded of ["quetta", "hyderabad", "peshawar", "sialkot"]) {
        expect(slugs).not.toContain(excluded);
      }
      // No duplicate pages from case/whitespace variants.
      expect(new Set(slugs).size).toBe(slugs.length);
    });

    test("providers are attached to the right city", async () => {
      const { getHomeVisitCity } = await import("@/lib/seo/home-visit-cities");

      const faisalabad = await getHomeVisitCity("faisalabad");
      expect(faisalabad?.name).toBe("Faisalabad");
      expect(faisalabad?.doctors.map((d) => d.name)).toEqual(["Dr. Faisal Home Doc"]);
      expect(faisalabad?.doctors[0]?.homeVisitFee).toBe(4000);

      const lahore = await getHomeVisitCity("lahore");
      expect(lahore?.physiotherapists.map((p) => p.name)).toEqual(["Lahore Physio"]);

      const multan = await getHomeVisitCity("multan");
      expect(multan?.isMain).toBe(false);
      expect(multan?.nurses.map((n) => n.name)).toEqual(["Multan Nurse"]);

      expect(await getHomeVisitCity("quetta")).toBeUndefined();
    });
  });

  test("sitemap lists every city page and nothing else under /home-services/", async () => {
    const { default: sitemap } = await import("@/app/sitemap");
    const urls = (await sitemap()).map((e) => new URL(e.url).pathname);
    const cityUrls = urls.filter((u) => u.startsWith("/home-services/")).sort();

    expect(cityUrls).toEqual([
      "/home-services/faisalabad",
      "/home-services/karachi",
      "/home-services/lahore",
      "/home-services/multan",
    ]);
  });

  test("llms.txt has a home-visits-by-city section with correct, non-zero claims", async () => {
    const { GET } = await import("@/app/llms.txt/route");
    const text = await (await GET()).text();

    expect(text).toContain("## Home visits by city");
    expect(text).toMatch(/\[Doctor home visit in Karachi\]\([^)]*\/home-services\/karachi\)/);
    expect(text).toContain("Our care team assigns a verified provider to every request in Karachi");
    expect(text).toContain("1 verified provider currently takes home visits in Multan");
    expect(text).not.toMatch(/\b0 verified/);
    // Quetta's doctor is still in the doctor list — just never offered as a home-visit city.
    const citySection = text.slice(
      text.indexOf("## Home visits by city"),
      text.indexOf("## Doctors"),
    );
    expect(citySection).not.toContain("Quetta");
    // Section sits before the doctor list.
    expect(text.indexOf("## Home visits by city")).toBeLessThan(text.indexOf("## Doctors"));
  });

  test("page metadata targets the city and unknown cities are not indexed", async () => {
    const { generateMetadata } = await import("@/app/(marketing)/home-services/[city]/page");

    const karachi = await generateMetadata({ params: Promise.resolve({ city: "karachi" }) });
    expect(String(karachi.title)).toContain("Doctor Home Visit in Karachi");
    expect(karachi.description).toContain("Rs. 3,500");
    expect(karachi.alternates?.canonical).toEqual(
      expect.stringContaining("/home-services/karachi"),
    );

    const quetta = await generateMetadata({ params: Promise.resolve({ city: "quetta" }) });
    expect(quetta.robots).toEqual({ index: false });
  });

  test("page 404s for a city with no coverage", async () => {
    const { default: Page } = await import("@/app/(marketing)/home-services/[city]/page");
    await expect(Page({ params: Promise.resolve({ city: "quetta" }) })).rejects.toThrow();
  });
});
