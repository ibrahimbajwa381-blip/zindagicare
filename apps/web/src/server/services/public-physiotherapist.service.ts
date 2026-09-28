import { connectDatabase, StaffProfileModel } from "@zindagi/database";
import {
  HOME_CARE_MATCH_RADIUS_KM,
  LAUNCH_CITY,
  Roles,
  VerificationStatuses,
} from "@zindagi/shared";
import { Types } from "mongoose";
import { citiesMatch } from "@/lib/geo/city-match";
import { haversineKm } from "@/lib/geo/distance";
import { mongoFilter } from "@/lib/mongo/query";
import {
  mapPhysiotherapistPortfolio,
  type PhysiotherapistPortfolio,
} from "@/lib/physiotherapists/portfolio";
import { safeDisplayText } from "@/server/lib/decrypt-pii";
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
  isAvailable: boolean;
  /** Distance from the patient's pin, when a location was supplied. */
  distanceKm?: number;
  /** True when the patient's pin is within the home-visit match radius. */
  withinRadius?: boolean;
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

async function mapStaff(
  staff: Record<string, unknown> & { _id: Types.ObjectId },
  origin?: { lng: number; lat: number },
  includePortfolio = false,
): Promise<PublicPhysiotherapist | null> {
  const user = staff.userId as PopulatedUser | null;
  if (!user?._id || user.deletedAt || user.isActive === false) return null;

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
  }[];
  const area = areas[0];

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
    isAvailable: staff.isAvailable !== false,
    distanceKm,
    withinRadius:
      distanceKm === undefined ? undefined : distanceKm <= HOME_CARE_MATCH_RADIUS_KM,
  };
}

export class PublicPhysiotherapistService {
  /**
   * Verified physiotherapists in a city. With `near`, results are sorted nearest-first
   * and `nearbyOnly` keeps only those within the home-visit radius who take home visits.
   */
  static async list(options: {
    city?: string;
    near?: { lng: number; lat: number };
    nearbyOnly?: boolean;
  } = {}): Promise<PublicPhysiotherapist[]> {
    await connectDatabase();
    const city = options.city?.trim() || LAUNCH_CITY;

    const docs = await StaffProfileModel.find(PUBLIC_FILTER)
      .populate("userId", "name avatarUrl isActive deletedAt")
      .lean();

    const mapped = await Promise.all(
      docs
        .filter((doc) =>
          (doc.serviceAreas ?? []).some((a) => citiesMatch(a.city ?? LAUNCH_CITY, city)),
        )
        .map((doc) => mapStaff(doc as never, options.near)),
    );

    let rows = mapped.filter((row): row is PublicPhysiotherapist => row !== null);

    if (options.near) {
      if (options.nearbyOnly) {
        rows = rows.filter((r) => r.homeVisitEnabled && r.isAvailable && r.withinRadius);
      }
      rows.sort(
        (a, b) => (a.distanceKm ?? Number.POSITIVE_INFINITY) - (b.distanceKm ?? Number.POSITIVE_INFINITY),
      );
    } else {
      rows.sort((a, b) => (b.experienceYears ?? 0) - (a.experienceYears ?? 0));
    }

    return rows;
  }

  /** Look up by public slug or by User id (used by ?physio= deep links). */
  static async get(slugOrId: string): Promise<PublicPhysiotherapist | null> {
    await connectDatabase();
    const key = slugOrId.trim().toLowerCase();
    if (!key) return null;

    const filter = Types.ObjectId.isValid(key) && key.length === 24
      ? { ...PUBLIC_FILTER, userId: new Types.ObjectId(key) }
      : { ...PUBLIC_FILTER, slug: key };

    const doc = await StaffProfileModel.findOne(mongoFilter(filter))
      .populate("userId", "name avatarUrl isActive deletedAt")
      .lean();
    if (!doc) return null;
    return mapStaff(doc as never, undefined, true);
  }
}
