import { connectDatabase, StaffProfileModel } from "@zindagi/database";
import {
  HOME_CARE_MATCH_RADIUS_KM,
  LAUNCH_CITY,
  resolveNurseHomeVisitFee,
  Roles,
  VerificationStatuses,
} from "@zindagi/shared";
import { Types } from "mongoose";
import { citiesMatch, formatCityName, normalizeCityName } from "@/lib/geo/city-match";
import { haversineKm } from "@/lib/geo/distance";
import { mongoFilter } from "@/lib/mongo/query";
import { CacheTags, cacheKey, cached } from "@/server/lib/cache";
import {
  mapNursePortfolio,
  type NursePortfolio,
} from "@/lib/nurses/portfolio";
import { safeDisplayText } from "@/server/lib/decrypt-pii";
import { HomeVisitReviewService } from "./home-visit-review.service";
import { ensureCanonicalNurseSlug } from "./nurse-slug.service";

export type PublicNurse = {
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
  portfolio?: NursePortfolio;
  city: string;
  area?: string;
  homeVisitEnabled: boolean;
  /** Per-visit fee in PKR — the nurse's own fee, or the platform rate. */
  homeVisitFee: number;
  isAvailable: boolean;
  /** Distance from the patient's pin, when a location was supplied. */
  distanceKm?: number;
  /** True when the patient's pin is within the home-visit match radius. */
  withinRadius?: boolean;
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
  staffType: Roles.NURSE,
  verificationStatus: VerificationStatuses.APPROVED,
  deletedAt: { $exists: false },
};

/** Account fields that decide whether a nurse is publicly listed. */
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
): Promise<PublicNurse | null> {
  const user = staff.userId as PopulatedUser | null;
  if (!isListedUser(user)) return null;

  const name = safeDisplayText(user.name);
  if (!name) return null;

  const slug = await ensureCanonicalNurseSlug(
    staff._id.toString(),
    name,
    staff.slug as string | undefined,
  );

  const areas = (staff.serviceAreas ?? []) as {
    city?: string;
    area?: string;
    geo?: { coordinates?: number[] };
  }[];
  // Show the service area in the filtered city, falling back to the primary one.
  const area =
    (city && areas.find((a) => citiesMatch(a.city ?? LAUNCH_CITY, city))) || areas[0];

  let distanceKm: number | undefined;
  if (origin) {
    for (const a of areas) {
      const coords = a.geo?.coordinates;
      if (!coords || coords.length < 2) continue;
      const d = haversineKm(origin.lng, origin.lat, coords[0], coords[1]);
      if (distanceKm === undefined || d < distanceKm) distanceKm = d;
    }
  }

  const languages = staff.languages as string[] | undefined;
  const portfolio = mapNursePortfolio(staff as never);

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
    homeVisitFee: resolveNurseHomeVisitFee(staff.homeVisitFee as number | undefined),
    isAvailable: staff.isAvailable !== false,
    distanceKm,
    withinRadius:
      distanceKm === undefined ? undefined : distanceKm <= HOME_CARE_MATCH_RADIUS_KM,
  };
}

export class PublicNurseService {
  /**
   * Verified nurses, optionally narrowed to a city and/or specialty (all cities
   * when `city` is omitted). With `near`, results are sorted nearest-first and `nearbyOnly`
   * keeps only those within the home-visit radius who take home visits.
   */
  static async list(options: {
    city?: string;
    specialty?: string;
    near?: { lng: number; lat: number };
    nearbyOnly?: boolean;
  } = {}): Promise<PublicNurse[]> {
    // Location searches are per-visitor coordinates — not worth caching.
    if (options.near) return PublicNurseService.load(options);
    return cached(
      cacheKey("nurses", options.city, options.specialty),
      { ttl: 300, tags: [CacheTags.NURSES] },
      () => PublicNurseService.load(options),
    );
  }

  private static async load(options: {
    city?: string;
    specialty?: string;
    near?: { lng: number; lat: number };
    nearbyOnly?: boolean;
  }): Promise<PublicNurse[]> {
    await connectDatabase();
    const city = options.city?.trim();
    const specialty = options.specialty?.trim().toLowerCase();

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
        .map((doc) => mapStaff(doc as never, options.near, false, city)),
    );

    let rows = mapped.filter((row): row is PublicNurse => row !== null);

    const ratings = await HomeVisitReviewService.ratingsByStaff(rows.map((r) => r.id));
    rows = rows.map((r) => {
      const rating = ratings.get(r.id);
      return { ...r, ratingAvg: rating?.ratingAvg, reviewCount: rating?.total ?? 0 };
    });

    if (options.near) {
      if (options.nearbyOnly) {
        rows = rows.filter((r) => r.homeVisitEnabled && r.isAvailable && r.withinRadius);
      }
      rows.sort(
        (a, b) => (a.distanceKm ?? Number.POSITIVE_INFINITY) - (b.distanceKm ?? Number.POSITIVE_INFINITY),
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
   * Cities offered in the directory filter: every city served by a nurse the
   * directory would list, deduplicated case-insensitively and title-cased for display.
   */
  static async listCities(): Promise<string[]> {
    return cached(cacheKey("nurses-cities"), { ttl: 600, tags: [CacheTags.NURSES] }, () =>
      PublicNurseService.loadCities(),
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

  /** Look up by public slug or by User id (used by ?nurse= deep links). */
  static async get(slugOrId: string): Promise<PublicNurse | null> {
    return cached(cacheKey("nurse", slugOrId), { ttl: 300, tags: [CacheTags.NURSES] }, () =>
      PublicNurseService.loadOne(slugOrId),
    );
  }

  private static async loadOne(slugOrId: string): Promise<PublicNurse | null> {
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
