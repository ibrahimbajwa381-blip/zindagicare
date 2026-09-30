/**
 * DOC-001..DOC-009 — Doctor Discovery backend integration tests.
 *
 * Real integration tests: route -> OnlineConsultService -> MongoDB -> response.
 * No mocking of DoctorProfileModel/UserModel/database connection.
 *
 * Runs against an ephemeral local MongoDB (mongodb-memory-server — never
 * Atlas, never production) seeded in beforeAll with a known dataset:
 * 6 approved+listed doctors spread over three cities and three specialties,
 * plus two fixtures that discovery must never return — an unverified
 * (pending) doctor and a restricted+unlisted doctor, both sharing the exact
 * city/specialty of a listed doctor so only the verification/listing filter
 * can exclude them. The suite therefore needs no external database or
 * out-of-band fixture script.
 */
import { NextRequest } from "next/server";
import fs from "fs";
import path from "path";
import { randomBytes } from "crypto";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { connectDatabase, DoctorProfileModel, UserModel } from "@zindagi/database";
import { VerificationStatuses, type VerificationStatus } from "@zindagi/shared";

// The route module chain (with-api-handler -> resolve-session -> @/lib/auth)
// pulls in next-auth, which is ESM-only and Jest can't parse. The discovery
// route runs with { public: true }, so resolveSession is never actually
// called on this path — mocking it here only avoids the unrelated import
// failure, it does not change what's under test (matches the existing
// convention in tests/unit/api/doctor-auth.test.ts).
jest.mock("@/server/api/resolve-session", () => ({
  resolveSession: jest.fn(),
}));

// First run downloads the MongoDB binary; the 5s Jest default is too tight.
jest.setTimeout(60000);

type SeedDoctor = {
  name: string;
  city: string;
  specialty: string;
  verificationStatus: VerificationStatus;
  isListed: boolean;
};

const APPROVED_LISTED_SEED: SeedDoctor[] = [
  { name: "Discovery Lahore Derm A", city: "Lahore", specialty: "Dermatologist" },
  { name: "Discovery Lahore GP", city: "Lahore", specialty: "General Physician" },
  { name: "Discovery Lahore Derm B", city: "Lahore", specialty: "Dermatologist" },
  { name: "Discovery Karachi Derm", city: "Karachi", specialty: "Dermatologist" },
  { name: "Discovery Karachi Peds", city: "Karachi", specialty: "Pediatrician" },
  { name: "Discovery Islamabad GP", city: "Islamabad", specialty: "General Physician" },
].map((d) => ({ ...d, verificationStatus: VerificationStatuses.APPROVED, isListed: true }));

// Same city/specialty as a listed doctor, so only the status/listing filter excludes them.
const UNVERIFIED_SEED: SeedDoctor = {
  name: "TEST-STRESS Unverified Doctor",
  city: "Lahore",
  specialty: "Dermatologist",
  verificationStatus: VerificationStatuses.PENDING,
  isListed: true,
};
const RESTRICTED_SEED: SeedDoctor = {
  name: "TEST-STRESS Restricted Doctor",
  city: "Lahore",
  specialty: "Dermatologist",
  verificationStatus: VerificationStatuses.RESTRICTED,
  isListed: false,
};

let seedCounter = 0;

async function seedDoctor(seed: SeedDoctor) {
  seedCounter += 1;
  const user = await UserModel.create({
    name: seed.name,
    email: `discovery-${seedCounter}@example.com`,
    phone: `+92300${seedCounter.toString().padStart(7, "0")}`,
    roles: ["doctor"],
    isActive: true,
  });
  const profile = await DoctorProfileModel.create({
    userId: user._id,
    isListed: seed.isListed,
    verificationStatus: seed.verificationStatus,
    consultationFee: 1500,
    specialties: [seed.specialty],
    coverageCities: [seed.city],
  });
  return { _id: profile._id.toString(), ...seed };
}

const ROUTE = "http://localhost/api/v1/consult/doctors";

function getRequest(query: Record<string, string | undefined> = {}) {
  const url = new URL(ROUTE);
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) url.searchParams.set(key, value);
  }
  return new NextRequest(url);
}

// Duplicate-key query strings can't be built with URLSearchParams.set (it
// overwrites), so build the raw string by hand for that one test.
function getRequestRawQuery(rawQuery: string) {
  return new NextRequest(new URL(`${ROUTE}?${rawQuery}`));
}

type DiscoveryDoctor = {
  doctorId: string;
  slug: string;
  name: string;
  avatarUrl?: string;
  specialties: string[];
  ratingAvg: number;
  ratingCount: number;
  pmdcVerified: boolean;
  consultationFee: number;
  hospital?: string;
  medicalDegree?: string;
  qualifications: string[];
  availableSlots: number;
  isFull: boolean;
};

async function callDiscovery(query: Record<string, string | undefined> = {}) {
  const { GET } = await import("@/app/api/v1/consult/doctors/route");
  const res = await GET(getRequest(query));
  const body = await res.json();
  return { res, body };
}

describe("Doctor Discovery integration (real local MongoDB)", () => {
  let mongod: MongoMemoryServer;
  let approvedListed: {
    _id: string;
    city: string;
    specialty: string;
    allSpecialties: string[];
  }[] = [];

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongod.getUri("doctor_discovery_test");
    process.env.FIELD_ENCRYPTION_KEY = randomBytes(32).toString("base64");
    await connectDatabase();

    // Sequential so approvedListed[0] (the fixture most tests pivot on) is stable.
    for (const seed of [...APPROVED_LISTED_SEED, UNVERIFIED_SEED, RESTRICTED_SEED]) {
      await seedDoctor(seed);
    }

    // READ-ONLY snapshot of real, currently-approved-and-listed doctors to
    // drive assertions against actual data rather than assumed fixtures.
    const docs = await DoctorProfileModel.find({
      isListed: true,
      verificationStatus: VerificationStatuses.APPROVED,
    })
      .select("coverageCities specialties primarySpecialty")
      .lean();

    approvedListed = docs.flatMap((d) => {
      const cities = (d.coverageCities as string[] | undefined) ?? [];
      const specialties = (d.specialties as string[] | undefined) ?? [];
      if (!cities.length || !specialties.length) return [];
      return [
        {
          _id: d._id.toString(),
          city: cities[0],
          specialty: specialties[0],
          allSpecialties: specialties,
        },
      ];
    });

    if (approvedListed.length === 0) {
      throw new Error(
        "No approved+listed doctors found in the database — DOC-001..007 cannot run. " +
          "The seeded dataset in beforeAll should have created them.",
      );
    }
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongod?.stop();
  });

  // ---------------------------------------------------------------------
  // DOC-001 — Get doctors (default discovery, no filters)
  // ---------------------------------------------------------------------
  describe("DOC-001 — Get doctors", () => {
    test("returns 200 with success envelope and an array of doctors for the default city", async () => {
      const { res, body } = await callDiscovery();
      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.error).toBeNull();
      expect(Array.isArray(body.data)).toBe(true);
    });

    test("returned doctors expose only the intended public fields", async () => {
      const { body } = await callDiscovery();
      const doctors = body.data as DiscoveryDoctor[];
      expect(doctors.length).toBeGreaterThan(0);

      const requiredKeys = [
        "doctorId",
        "slug",
        "name",
        "specialties",
        "ratingAvg",
        "ratingCount",
        "pmdcVerified",
        "consultationFee",
        "qualifications",
        "availableSlots",
        "isFull",
      ];
      // avatarUrl/hospital/medicalDegree are optional and dropped by
      // JSON.stringify when undefined (no avatar uploaded / no hospital set).
      const allowedKeys = new Set([...requiredKeys, "avatarUrl", "hospital", "medicalDegree"]);

      for (const doc of doctors) {
        for (const key of requiredKeys) {
          expect(doc).toHaveProperty(key);
        }
        for (const key of Object.keys(doc)) {
          expect(allowedKeys.has(key)).toBe(true);
        }
      }
    });

    test("does not expose passwords, tokens, bank info, or internal DB fields", async () => {
      const { body } = await callDiscovery();
      const raw = JSON.stringify(body);
      const forbidden = [
        "passwordHash",
        '"password"',
        "authProviders",
        "emailLookup",
        "phoneLookup",
        "cnicHash",
        "cnicLast4",
        "bankAccount",
        "accountNumber",
        "iban",
        "pmdcNumber",
        "verificationDocuments",
        "googleId",
        "\"email\"",
        "\"phone\"",
        "commissionPercent",
        "onlineCommissionPercent",
      ];
      for (const field of forbidden) {
        expect(raw).not.toContain(field);
      }
    });

    test("every returned doctor corresponds to a real, currently approved+listed DB record", async () => {
      const { body } = await callDiscovery();
      const doctors = body.data as DiscoveryDoctor[];

      for (const doc of doctors) {
        const dbDoc = await DoctorProfileModel.findById(doc.doctorId).lean();
        expect(dbDoc).not.toBeNull();
        expect(dbDoc?.isListed).toBe(true);
        expect(dbDoc?.verificationStatus).toBe(VerificationStatuses.APPROVED);
      }
    });

    test("no pagination metadata is present (endpoint returns a plain array — not implemented)", async () => {
      const { body } = await callDiscovery();
      expect(body.meta).toBeUndefined();
      expect(body.data.page).toBeUndefined();
      expect(body.data.total).toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------
  // DOC-002 — Search doctor by name (NOT implemented server-side)
  // ---------------------------------------------------------------------
  describe("DOC-002 — Search doctor by name (backend gap, documented not faked)", () => {
    test("the endpoint has no name/search query parameter — an unrecognized param is silently ignored", async () => {
      const fixture = approvedListed[0];
      const { body: unfiltered } = await callDiscovery({ city: fixture.city });
      const { body: withNameParam } = await callDiscovery({
        city: fixture.city,
        name: "ZzNoSuchDoctorNameZz",
        search: "ZzNoSuchDoctorNameZz",
        q: "ZzNoSuchDoctorNameZz",
      });

      // Passing name/search/q has zero effect — same doctor set is returned
      // regardless of a name that doesn't exist among them.
      const idsA = (unfiltered.data as DiscoveryDoctor[]).map((d) => d.doctorId).sort();
      const idsB = (withNameParam.data as DiscoveryDoctor[]).map((d) => d.doctorId).sort();
      expect(idsB).toEqual(idsA);
    });
  });

  // ---------------------------------------------------------------------
  // DOC-003 — Search by specialty
  // ---------------------------------------------------------------------
  describe("DOC-003 — Search by specialty", () => {
    test("filtering by an existing specialty returns only doctors that actually have it", async () => {
      const fixture = approvedListed[0];
      const { res, body } = await callDiscovery({
        city: fixture.city,
        specialty: fixture.specialty,
      });
      expect(res.status).toBe(200);
      const doctors = body.data as DiscoveryDoctor[];
      expect(doctors.length).toBeGreaterThan(0);
      expect(doctors.some((d) => d.doctorId === fixture._id)).toBe(true);

      for (const doc of doctors) {
        expect(doc.specialties).toContain(fixture.specialty);
      }
    });

    test("doctors from unrelated specialties (in the same city) are excluded", async () => {
      // Find a doctor in the same city with a different specialty, if one exists.
      const fixture = approvedListed[0];
      const otherSpecialtyDoctor = approvedListed.find(
        (d) => d.city === fixture.city && d.specialty !== fixture.specialty,
      );
      if (!otherSpecialtyDoctor) {
        return; // no second specialty in this city among current data — nothing to assert
      }

      const { body } = await callDiscovery({
        city: fixture.city,
        specialty: fixture.specialty,
      });
      const doctors = body.data as DiscoveryDoctor[];
      expect(doctors.some((d) => d.doctorId === otherSpecialtyDoctor._id)).toBe(false);
    });
  });

  // ---------------------------------------------------------------------
  // DOC-004 — Search by city
  // ---------------------------------------------------------------------
  describe("DOC-004 — Search by city", () => {
    test("filtering by city returns only doctors covering that city", async () => {
      const fixture = approvedListed[0];
      const { res, body } = await callDiscovery({ city: fixture.city });
      expect(res.status).toBe(200);
      const doctors = body.data as DiscoveryDoctor[];
      expect(doctors.some((d) => d.doctorId === fixture._id)).toBe(true);

      // Response doesn't include city directly — verify each returned doctor
      // against the real DB record (read-only).
      for (const doc of doctors) {
        const dbDoc = await DoctorProfileModel.findById(doc.doctorId).select("coverageCities").lean();
        expect((dbDoc?.coverageCities as string[] | undefined) ?? []).toContain(fixture.city);
      }
    });

    test("doctors from an unrelated city are excluded", async () => {
      const fixture = approvedListed[0];
      const otherCityDoctor = approvedListed.find((d) => d.city !== fixture.city);
      if (!otherCityDoctor) return; // only one city present in current data

      const { body } = await callDiscovery({ city: fixture.city });
      const doctors = body.data as DiscoveryDoctor[];
      expect(doctors.some((d) => d.doctorId === otherCityDoctor._id)).toBe(false);
    });
  });

  // ---------------------------------------------------------------------
  // DOC-005 — City + specialty together (AND semantics)
  // ---------------------------------------------------------------------
  describe("DOC-005 — City + specialty together", () => {
    test("results satisfy BOTH filters; matching only one filter is excluded", async () => {
      const fixture = approvedListed[0];
      const { res, body } = await callDiscovery({
        city: fixture.city,
        specialty: fixture.specialty,
      });
      expect(res.status).toBe(200);
      const doctors = body.data as DiscoveryDoctor[];
      expect(doctors.some((d) => d.doctorId === fixture._id)).toBe(true);

      for (const doc of doctors) {
        expect(doc.specialties).toContain(fixture.specialty);
        const dbDoc = await DoctorProfileModel.findById(doc.doctorId).select("coverageCities").lean();
        expect((dbDoc?.coverageCities as string[] | undefined) ?? []).toContain(fixture.city);
      }

      // A doctor matching only the specialty but a different city must be excluded.
      const sameSpecialtyDifferentCity = approvedListed.find(
        (d) => d.specialty === fixture.specialty && d.city !== fixture.city,
      );
      if (sameSpecialtyDifferentCity) {
        expect(doctors.some((d) => d.doctorId === sameSpecialtyDifferentCity._id)).toBe(false);
      }

      // A doctor matching only the city but a different specialty must be excluded.
      const sameCityDifferentSpecialty = approvedListed.find(
        (d) => d.city === fixture.city && d.specialty !== fixture.specialty,
      );
      if (sameCityDifferentSpecialty) {
        expect(doctors.some((d) => d.doctorId === sameCityDifferentSpecialty._id)).toBe(false);
      }
    });
  });

  // ---------------------------------------------------------------------
  // DOC-006 — Empty search
  // ---------------------------------------------------------------------
  describe("DOC-006 — Empty search", () => {
    // Since listings went Pakistan-wide (commit 9883132), a missing or empty
    // city means "all cities" rather than defaulting to Lahore.
    test("no search params at all -> every approved+listed doctor across all cities", async () => {
      const { GET } = await import("@/app/api/v1/consult/doctors/route");
      const res = await GET(new NextRequest(new URL(ROUTE)));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      const ids = (body.data as DiscoveryDoctor[]).map((d) => d.doctorId).sort();
      expect(ids).toEqual(approvedListed.map((d) => d._id).sort());
    });

    test("empty-string city ('') is treated like no city (all cities), not a 500", async () => {
      const { res, body } = await callDiscovery({ city: "" });
      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      const ids = (body.data as DiscoveryDoctor[]).map((d) => d.doctorId).sort();
      expect(ids).toEqual(approvedListed.map((d) => d._id).sort());
    });

    test("whitespace-only city is taken literally and returns an empty list, not a 500", async () => {
      const { res, body } = await callDiscovery({ city: "   " });
      expect(res.status).toBe(200);
      expect(body.data).toEqual([]);
    });

    test("empty-string specialty is ignored (falls back to no specialty filter)", async () => {
      const fixture = approvedListed[0];
      const { body: withEmpty } = await callDiscovery({ city: fixture.city, specialty: "" });
      const { body: withNone } = await callDiscovery({ city: fixture.city });
      const idsA = (withEmpty.data as DiscoveryDoctor[]).map((d) => d.doctorId).sort();
      const idsB = (withNone.data as DiscoveryDoctor[]).map((d) => d.doctorId).sort();
      expect(idsA).toEqual(idsB);
    });

    test("whitespace-only specialty is ignored (trimmed to empty, falls back to no filter)", async () => {
      const fixture = approvedListed[0];
      const { res, body } = await callDiscovery({ city: fixture.city, specialty: "   " });
      expect(res.status).toBe(200);
      expect(body.data.length).toBeGreaterThan(0);
    });
  });

  // ---------------------------------------------------------------------
  // DOC-007 — Invalid specialty
  // ---------------------------------------------------------------------
  describe("DOC-007 — Invalid specialty", () => {
    test("a specialty that matches no canonical value returns an empty array, not 500", async () => {
      const fixture = approvedListed[0];
      const { res, body } = await callDiscovery({
        city: fixture.city,
        specialty: "SpecialtyThatDoesNotExist123",
      });
      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------
  // SECURITY — injection / robustness against malicious query input
  // ---------------------------------------------------------------------
  describe("Security — injection and malformed-input safety", () => {
    test("MongoDB operator-like strings as specialty/city do not crash or bypass filtering", async () => {
      const operatorLike = ["$ne", "$where", '{"$gt":""}', "$regex", "[$ne]=null"];
      for (const value of operatorLike) {
        const { res, body } = await callDiscovery({ city: value, specialty: value });
        expect(res.status).toBe(200);
        expect(body.success).toBe(true);
        expect(Array.isArray(body.data)).toBe(true);
        expect(body.data).toEqual([]); // no real doctor literally matches these strings
      }
    });

    test("regex-metacharacter strings are treated literally (no ReDoS, no regex used)", async () => {
      const regexLike = [".*", "(a+)+$", "^.*$", "a{1000}", "(.|\\n)*"];
      for (const value of regexLike) {
        const { res, body } = await callDiscovery({ specialty: value });
        expect(res.status).toBe(200);
        expect(Array.isArray(body.data)).toBe(true);
      }
    });

    test("very long strings do not crash the endpoint", async () => {
      const longValue = "a".repeat(5000);
      const { res, body } = await callDiscovery({ city: longValue, specialty: longValue });
      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data).toEqual([]);
    });

    test("null-byte and control characters do not crash the endpoint", async () => {
      const { res, body } = await callDiscovery({ city: "Lahore ", specialty: "Cardio logist" });
      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
    });

    test("duplicate query keys use only the first value (URLSearchParams semantics), no injection via arrays", async () => {
      const fixture = approvedListed[0];
      const res = await (await import("@/app/api/v1/consult/doctors/route")).GET(
        getRequestRawQuery(`city=${encodeURIComponent(fixture.city)}&city=SomeOtherCity`),
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      const doctors = body.data as DiscoveryDoctor[];
      // Should behave exactly like a single city=fixture.city request.
      expect(doctors.some((d) => d.doctorId === fixture._id)).toBe(true);
    });

    test("client cannot pass isListed/verificationStatus overrides to bypass server-side filtering", async () => {
      const fixture = approvedListed[0];
      const { res, body } = await callDiscovery({
        city: fixture.city,
        specialty: fixture.specialty,
        isListed: "false",
        verificationStatus: "pending",
        verified: "false",
      } as unknown as Record<string, string>);
      expect(res.status).toBe(200);
      const doctors = body.data as DiscoveryDoctor[];
      // Same result as without those extra params — they're not read by the route/schema.
      expect(doctors.some((d) => d.doctorId === fixture._id)).toBe(true);
    });
  });

  // ---------------------------------------------------------------------
  // DOC-008 — Unverified doctor excluded (live, using the seeded fixture)
  // ---------------------------------------------------------------------
  describe("DOC-008 — Unverified doctor excluded", () => {
    let unverifiedFixture: { _id: string; name: string; city: string; specialty: string } | null = null;

    beforeAll(async () => {
      // Identify the seeded unverified doctor by its actual DB state
      // (verificationStatus != approved), not by a hardcoded id.
      const doc = await DoctorProfileModel.findOne({
        verificationStatus: VerificationStatuses.PENDING,
      })
        .populate("userId", "name")
        .lean();

      if (!doc) {
        throw new Error(
          "DOC-008: no doctorprofiles record with verificationStatus=pending exists. " +
            "Expected the seeded 'TEST-STRESS Unverified Doctor' fixture to be present.",
        );
      }

      const user = doc.userId as { name?: string } | null;
      unverifiedFixture = {
        _id: doc._id.toString(),
        name: user?.name ?? "",
        city: (doc.coverageCities as string[] | undefined)?.[0] ?? "Lahore",
        specialty: (doc.specialties as string[] | undefined)?.[0] ?? "",
      };
    });

    test("the unverified doctor is NOT returned by the default discovery call", async () => {
      const { res, body } = await callDiscovery({ city: unverifiedFixture!.city });
      expect(res.status).toBe(200);
      const doctors = body.data as DiscoveryDoctor[];
      expect(doctors.some((d) => d.doctorId === unverifiedFixture!._id)).toBe(false);
    });

    test("the unverified doctor is NOT returned even when its exact specialty+city are requested", async () => {
      const { body } = await callDiscovery({
        city: unverifiedFixture!.city,
        specialty: unverifiedFixture!.specialty,
      });
      const doctors = body.data as DiscoveryDoctor[];
      expect(doctors.some((d) => d.doctorId === unverifiedFixture!._id)).toBe(false);
      // And no doctor named after the fixture appears anywhere in the payload.
      expect(JSON.stringify(doctors)).not.toContain(unverifiedFixture!.name);
    });

    test("searching by the unverified doctor's exact name cannot surface it (no server-side name search exists, so it can never be delivered to a name filter)", async () => {
      const { body } = await callDiscovery({
        city: unverifiedFixture!.city,
        name: unverifiedFixture!.name,
        search: unverifiedFixture!.name,
        q: unverifiedFixture!.name,
      });
      const doctors = body.data as DiscoveryDoctor[];
      expect(doctors.some((d) => d.doctorId === unverifiedFixture!._id)).toBe(false);
      expect(JSON.stringify(doctors)).not.toContain(unverifiedFixture!.name);
    });

    test("a genuinely approved+listed doctor in the same specialty/city is still returned normally", async () => {
      const genuineMatch = approvedListed.find(
        (d) => d.city === unverifiedFixture!.city && d.specialty === unverifiedFixture!.specialty,
      );
      if (!genuineMatch) return; // no approved doctor shares this exact combo — nothing to assert
      const { body } = await callDiscovery({
        city: unverifiedFixture!.city,
        specialty: unverifiedFixture!.specialty,
      });
      const doctors = body.data as DiscoveryDoctor[];
      expect(doctors.some((d) => d.doctorId === genuineMatch._id)).toBe(true);
    });

    test("IDOR: the unverified doctor's real profile id cannot be smuggled in to force inclusion", async () => {
      const { body } = await callDiscovery({
        city: unverifiedFixture!.city,
        doctorId: unverifiedFixture!._id,
        _id: unverifiedFixture!._id,
        includeUnverified: "true",
        verificationStatus: "pending",
      } as unknown as Record<string, string>);
      const doctors = body.data as DiscoveryDoctor[];
      expect(doctors.some((d) => d.doctorId === unverifiedFixture!._id)).toBe(false);
    });

    test("enforcement is server-side: the filter hardcodes verificationStatus=APPROVED, not derived from client input", () => {
      const source = fs.readFileSync(
        path.join(__dirname, "../../src/server/services/online-consult.service.ts"),
        "utf8",
      );
      const filterBlockMatch = source.match(
        /const filter: Record<string, unknown> = \{[\s\S]*?\};/,
      );
      expect(filterBlockMatch).not.toBeNull();
      const filterBlock = filterBlockMatch![0];
      expect(filterBlock).toMatch(/verificationStatus:\s*VerificationStatuses\.APPROVED/);
      expect(filterBlock).not.toMatch(/searchParams|query\./);
    });
  });

  // ---------------------------------------------------------------------
  // DOC-009 — Restricted/unlisted doctor excluded (live, using the seeded fixture)
  // ---------------------------------------------------------------------
  describe("DOC-009 — Restricted/unlisted doctor excluded", () => {
    let restrictedFixture: { _id: string; name: string; city: string; specialty: string } | null = null;

    beforeAll(async () => {
      const doc = await DoctorProfileModel.findOne({
        verificationStatus: VerificationStatuses.RESTRICTED,
        isListed: false,
      })
        .populate("userId", "name")
        .lean();

      if (!doc) {
        throw new Error(
          "DOC-009: no doctorprofiles record with verificationStatus=restricted or isListed=false exists. " +
            "Expected the seeded 'TEST-STRESS Restricted Doctor' fixture to be present.",
        );
      }

      const user = doc.userId as { name?: string } | null;
      restrictedFixture = {
        _id: doc._id.toString(),
        name: user?.name ?? "",
        city: (doc.coverageCities as string[] | undefined)?.[0] ?? "Lahore",
        specialty: (doc.specialties as string[] | undefined)?.[0] ?? "",
      };
    });

    test("the restricted/unlisted doctor is NOT returned by the default discovery call", async () => {
      const { res, body } = await callDiscovery({ city: restrictedFixture!.city });
      expect(res.status).toBe(200);
      const doctors = body.data as DiscoveryDoctor[];
      expect(doctors.some((d) => d.doctorId === restrictedFixture!._id)).toBe(false);
    });

    test("the restricted/unlisted doctor is NOT returned even when its exact specialty+city are requested", async () => {
      const { body } = await callDiscovery({
        city: restrictedFixture!.city,
        specialty: restrictedFixture!.specialty,
      });
      const doctors = body.data as DiscoveryDoctor[];
      expect(doctors.some((d) => d.doctorId === restrictedFixture!._id)).toBe(false);
      expect(JSON.stringify(doctors)).not.toContain(restrictedFixture!.name);
    });

    test("searching by the restricted doctor's exact name cannot surface it", async () => {
      const { body } = await callDiscovery({
        city: restrictedFixture!.city,
        name: restrictedFixture!.name,
        search: restrictedFixture!.name,
        q: restrictedFixture!.name,
      });
      const doctors = body.data as DiscoveryDoctor[];
      expect(doctors.some((d) => d.doctorId === restrictedFixture!._id)).toBe(false);
      expect(JSON.stringify(doctors)).not.toContain(restrictedFixture!.name);
    });

    test("a genuinely approved+listed doctor in the same specialty/city is still returned normally", async () => {
      const genuineMatch = approvedListed.find(
        (d) => d.city === restrictedFixture!.city && d.specialty === restrictedFixture!.specialty,
      );
      if (!genuineMatch) return;
      const { body } = await callDiscovery({
        city: restrictedFixture!.city,
        specialty: restrictedFixture!.specialty,
      });
      const doctors = body.data as DiscoveryDoctor[];
      expect(doctors.some((d) => d.doctorId === genuineMatch._id)).toBe(true);
    });

    test("IDOR: the restricted doctor's real profile id cannot be smuggled in to force inclusion", async () => {
      const { body } = await callDiscovery({
        city: restrictedFixture!.city,
        doctorId: restrictedFixture!._id,
        _id: restrictedFixture!._id,
        isListed: "true",
        verificationStatus: "approved",
      } as unknown as Record<string, string>);
      const doctors = body.data as DiscoveryDoctor[];
      expect(doctors.some((d) => d.doctorId === restrictedFixture!._id)).toBe(false);
    });

    test("enforcement is server-side: the filter hardcodes isListed=true, not derived from client input", () => {
      const source = fs.readFileSync(
        path.join(__dirname, "../../src/server/services/online-consult.service.ts"),
        "utf8",
      );
      const filterBlockMatch = source.match(
        /const filter: Record<string, unknown> = \{[\s\S]*?\};/,
      );
      expect(filterBlockMatch).not.toBeNull();
      const filterBlock = filterBlockMatch![0];
      expect(filterBlock).toMatch(/isListed:\s*true/);
      expect(filterBlock).not.toMatch(/searchParams|query\./);
    });

    test("auto-restriction (accountability escalation) also clears isListed in source, matching this fixture's shape", () => {
      const source = fs.readFileSync(
        path.join(__dirname, "../../src/server/services/doctor-accountability.service.ts"),
        "utf8",
      );
      expect(source).toMatch(/profile\.verificationStatus = VerificationStatuses\.RESTRICTED/);
      expect(source).toMatch(/profile\.isListed = false/);
    });
  });

  // ---------------------------------------------------------------------
  // Cross-cutting: full dataset (8 doctors incl. both fixtures) never leaks
  // sensitive fields, regardless of filter combination.
  // ---------------------------------------------------------------------
  describe("Sensitive field exposure across the full seeded dataset (6 approved + 2 fixtures)", () => {
    test("no combination of city/specialty ever exposes verificationStatus, accountability, or raw DB fields", async () => {
      const cities = ["Lahore", "Karachi", "Islamabad"];
      for (const city of cities) {
        const { body } = await callDiscovery({ city });
        const raw = JSON.stringify(body);
        for (const field of [
          "verificationStatus",
          "accountability",
          "pmdcNumber",
          "cnicHash",
          "bankAccount",
          "passwordHash",
          "deletedAt",
          "userId",
        ]) {
          expect(raw).not.toContain(field);
        }
      }
    });
  });
});
