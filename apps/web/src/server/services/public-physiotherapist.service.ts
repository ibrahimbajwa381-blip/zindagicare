import { connectDatabase, StaffProfileModel } from "@zindagi/database";
import {
  bestHomeCareReach,
  compareHomeCareReach,
  HOME_CARE_MATCH_RADIUS_KM,
  LAUNCH_CITY,
  homeCareReach,
  resolveCoverageRadiusKm,
  type HomeCareReach,
  resolvePhysioHomeVisitFee,
  Roles,
  VerificationStatuses,
} from "@zindagi/shared";
import { Types } from "mongoose";
import { citiesMatch, formatCityName, normalizeCityName } from "@/lib/geo/city-match";
import { haversineKm } from "@/lib/geo/distance";
import { nearestCity } from "@/lib/geo/nearest-city";
import { mongoFilter } from "@/lib/mongo/query";
import { CacheTags, cacheKey, cached } from "@/server/lib/cache";
import {
  mapPhysiotherapistPortfolio,
  type PhysiotherapistPortfolio,
} from "@/lib/physiotherapists/portfolio";
import { safeDisplayText } from "@/server/lib/decrypt-pii";
import { HomeVisitReviewService } from "./home-visit-review.service";
import { ensureCanonicalPhysiotherapistSlug } from "./physiotherapist-slug.service";

export type PublicPhysiotherapist = {
  /** User id — what home visits and bookings reference. */
  id: string;
  slug: string;
  name: string;
  avatarUrl?: string;
  qualification?: string;
  experienceYears?: number;
  specialties: string[];
  languages: string[];
  bio?: string;
  headline?: string;
  /** Full portfolio — only populated by `get()` (profile page), not directory listings. */
  portfolio?: PhysiotherapistPortfolio;
  city: string;
  area?: string;
  homeVisitEnabled: boolean;
  /** Per-visit fee in PKR — the physio's own fee, or the platform rate. */
  homeVisitFee: number;
  isAvailable: boolean;
  /** Distance from the patient's pin, when a location was supplied. */
  distanceKm?: number;
  /** True when the patient's pin is within the home-visit match radius. */
  withinRadius?: boolean;
  /** True when the physio serves the city the patient's pin falls in. */
  inPatientCity?: boolean;
  /** The provider's own preferred coverage radius (km) around their nearest service area. */
  coverageRadiusKm: number;
  /**
   * Search tier relative to the patient's pin (inside the provider's own radius, within 15 km,
   * 30 km, same city, or farther). Only ranks results — every tier is bookable; outside their
   * own radius the patient is told travel and charges may need confirming.
   */
  reach?: HomeCareReach;
  /** Average visible patient rating (one decimal); only set by `list()` when reviewed. */
  ratingAvg?: number;
  /** Number of visible patient reviews; only set by `list()`. */
  reviewCount?: number;
};

type PopulatedUser = {
  _id: Types.ObjectId;
  name?: string;
  avatarUrl?: string;
  isActive?: boolean;
  deletedAt?: Date;
};

const PUBLIC_FILTER = {
  staffType: Roles.PHYSIOTHERAPIST,
  verificationStatus: VerificationStatuses.APPROVED,
  deletedAt: { $exists: false },
};

/** Account fields that decide whether a physiotherapist is publicly listed. */
const USER_VISIBILITY_FIELDS = "isActive deletedAt";

function isListedUser(user: PopulatedUser | null): user is PopulatedUser {
  if (!user?._id) return false;
  return !user.deletedAt && user.isActive !== false;
}

async function mapStaff(
  staff: Record<string, unknown> & { _id: Types.ObjectId },
  origin?: { lng: number; lat: number },
  includePortfolio = false,
  city?: string,
  patientCity?: string,
): Promise<PublicPhysiotherapist | null> {
  const user = staff.userId as PopulatedUser | null;
  if (!isListedUser(user)) return null;

  const name = safeDisplayText(user.name);
  if (!name) return null;

  const slug = await ensureCanonicalPhysiotherapistSlug(
    staff._id.toString(),
    name,
    staff.slug as string | undefined,
  );

  const areas = (staff.serviceAreas ?? []) as {
    city?: string;
    area?: string;
    geo?: { coordinates?: number[] };
    radiusKm?: number;
  }[];
  // Show the service area in the filtered (or patient's) city, falling back to the primary one.
  const shownCity = city ?? patientCity;
  const area =
    (shownCity && areas.find((a) => citiesMatch(a.city ?? LAUNCH_CITY, shownCity))) || areas[0];

  const inPatientCity = patientCity
    ? areas.some((a) => citiesMatch(a.city ?? LAUNCH_CITY, patientCity))
    : undefined;

  let distanceKm: number | undefined;
  let coverageRadiusKm = resolveCoverageRadiusKm(areas[0]?.radiusKm);
  let withinOwnRadius = false;
  if (origin) {
    for (const a of areas) {
      const coords = a.geo?.coordinates;
      if (!coords || coords.length < 2) continue;
      const d = haversineKm(origin.lng, origin.lat, coords[0], coords[1]);
      const radius = resolveCoverageRadiusKm(a.radiusKm);
      if (d <= radius) withinOwnRadius = true;
      if (distanceKm === undefined || d < distanceKm) {
        distanceKm = d;
        coverageRadiusKm = radius;
      }
    }
  }

  const languages = staff.languages as string[] | undefined;
  const portfolio = mapPhysiotherapistPortfolio(staff as never);

  return {
    id: user._id.toString(),
    slug,
    name,
    avatarUrl: user.avatarUrl ?? undefined,
    qualification: safeDisplayText(staff.qualification as string | undefined),
    experienceYears: (staff.experienceYears as number | undefined) ?? undefined,
    specialties: (staff.specialties as string[] | undefined) ?? [],
    languages: languages?.length ? languages : ["English", "Urdu"],
    bio: (staff.bio as string | undefined) ?? undefined,
    headline: portfolio.headline,
    portfolio: includePortfolio ? portfolio : undefined,
    city: area?.city ?? LAUNCH_CITY,
    area: area?.area ?? undefined,
    homeVisitEnabled: Boolean(staff.homeVisitEnabled),
    homeVisitFee: resolvePhysioHomeVisitFee(staff.homeVisitFee as number | undefined),
    isAvailable: staff.isAvailable !== false,
    distanceKm,
    withinRadius:
      distanceKm === undefined ? undefined : distanceKm <= HOME_CARE_MATCH_RADIUS_KM,
    inPatientCity,
    coverageRadiusKm,
    reach: origin ? homeCareReach(distanceKm, inPatientCity ?? false, withinOwnRadius) : undefined,
  };
}

export class PublicPhysiotherapistService {
  /**
   * Verified physiotherapists, optionally narrowed to a city and/or specialty (all cities
   * when `city` is omitted). With `near`, bookable physios come first, ranked by reach
   * (own radius, then 15 km, then 30 km, then the patient's city, then anywhere) and distance. `nearbyOnly`
   * keeps the bookable physios in the closest reach tier that has any — it never drops
   * everyone just because nobody is close.
   */
  static async list(options: {
    city?: string;
    specialty?: string;
    near?: { lng: number; lat: number };
    nearbyOnly?: boolean;
  } = {}): Promise<PublicPhysiotherapist[]> {
    // Location searches are per-visitor coordinates — not worth caching.
    if (options.near) return PublicPhysiotherapistService.load(options);
    return cached(
      cacheKey("physiotherapists", options.city, options.specialty),
      { ttl: 300, tags: [CacheTags.PHYSIOTHERAPISTS] },
      () => PublicPhysiotherapistService.load(options),
    );
  }

  private static async load(options: {
    city?: string;
    specialty?: string;
    near?: { lng: number; lat: number };
    nearbyOnly?: boolean;
  }): Promise<PublicPhysiotherapist[]> {
    await connectDatabase();
    const city = options.city?.trim();
    const specialty = options.specialty?.trim().toLowerCase();
    const patientCity = options.near ? nearestCity(options.near) : undefined;

    const docs = await StaffProfileModel.find(PUBLIC_FILTER)
      .populate("userId", `name avatarUrl ${USER_VISIBILITY_FIELDS}`)
      .lean();

    const mapped = await Promise.all(
      docs
        .filter(
          (doc) =>
            !city ||
            (doc.serviceAreas ?? []).some((a) => citiesMatch(a.city ?? LAUNCH_CITY, city)),
        )
        .filter(
          (doc) =>
            !specialty ||
            (doc.specialties ?? []).some((s) => s.trim().toLowerCase() === specialty),
        )
        .map((doc) => mapStaff(doc as never, options.near, false, city, patientCity)),
    );

    let rows = mapped.filter((row): row is PublicPhysiotherapist => row !== null);

    const ratings = await HomeVisitReviewService.ratingsByStaff(rows.map((r) => r.id));
    rows = rows.map((r) => {
      const rating = ratings.get(r.id);
      return { ...r, ratingAvg: rating?.ratingAvg, reviewCount: rating?.total ?? 0 };
    });

    if (options.near) {
      const bookable = (r: PublicPhysiotherapist) => r.homeVisitEnabled && r.isAvailable;
      if (options.nearbyOnly) {
        const eligible = rows.filter(bookable);
        const tier = bestHomeCareReach(eligible as { reach: HomeCareReach }[]);
        rows = eligible.filter((r) => r.reach === tier);
      }
      rows.sort(
        (a, b) =>
          Number(bookable(b)) - Number(bookable(a)) ||
          compareHomeCareReach(a as { reach: HomeCareReach }, b as { reach: HomeCareReach }),
      );
    } else {
      // Most-reviewed first, then higher rating, then more experience.
      rows.sort(
        (a, b) =>
          (b.reviewCount ?? 0) - (a.reviewCount ?? 0) ||
          (b.ratingAvg ?? 0) - (a.ratingAvg ?? 0) ||
          (b.experienceYears ?? 0) - (a.experienceYears ?? 0),
      );
    }

    return rows;
  }

  /**
   * Cities offered in the directory filter: every city served by a physiotherapist the
   * directory would list, deduplicated case-insensitively and title-cased for display.
   */
  static async listCities(): Promise<string[]> {
    return cached(cacheKey("physiotherapists-cities"), { ttl: 600, tags: [CacheTags.PHYSIOTHERAPISTS] }, () =>
      PublicPhysiotherapistService.loadCities(),
    );
  }

  private static async loadCities(): Promise<string[]> {
    await connectDatabase();
    const docs = await StaffProfileModel.find(PUBLIC_FILTER)
      .select("serviceAreas.city userId")
      .populate("userId", USER_VISIBILITY_FIELDS)
      .lean();

    const byKey = new Map<string, string>();
    for (const doc of docs) {
      if (!isListedUser(doc.userId as unknown as PopulatedUser | null)) continue;
      for (const a of doc.serviceAreas ?? []) {
        const city = a.city?.trim();
        if (city && !byKey.has(normalizeCityName(city))) {
          byKey.set(normalizeCityName(city), formatCityName(city));
        }
      }
    }
    return [...byKey.values()].sort((a, b) => a.localeCompare(b));
  }

  /** Look up by public slug or by User id (used by ?physio= deep links). */
  static async get(slugOrId: string): Promise<PublicPhysiotherapist | null> {
    return cached(cacheKey("physiotherapist", slugOrId), { ttl: 300, tags: [CacheTags.PHYSIOTHERAPISTS] }, () =>
      PublicPhysiotherapistService.loadOne(slugOrId),
    );
  }

  private static async loadOne(slugOrId: string): Promise<PublicPhysiotherapist | null> {
    await connectDatabase();
    const key = slugOrId.trim().toLowerCase();
    if (!key) return null;

    const filter = Types.ObjectId.isValid(key) && key.length === 24
      ? { ...PUBLIC_FILTER, userId: new Types.ObjectId(key) }
      : { ...PUBLIC_FILTER, slug: key };

    const doc = await StaffProfileModel.findOne(mongoFilter(filter))
      .populate("userId", `name avatarUrl ${USER_VISIBILITY_FIELDS}`)
      .lean();
    if (!doc) return null;
    return mapStaff(doc as never, undefined, true);
  }
}
