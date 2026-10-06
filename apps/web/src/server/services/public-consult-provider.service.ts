import {
  connectDatabase,
  HerbalistProfileModel,
  NutritionistProfileModel,
  ReviewModel,
} from "@zindagi/database";
import { VerificationStatuses } from "@zindagi/shared";
import { Types } from "mongoose";
import { citiesMatch, formatCityName, normalizeCityName } from "@/lib/geo/city-match";
import { mongoFilter } from "@/lib/mongo/query";
import { safeDisplayText } from "@/server/lib/decrypt-pii";
import { ensureCanonicalHerbalistSlug } from "./herbalist-slug.service";
import { ensureCanonicalNutritionistSlug } from "./nutritionist-slug.service";

/** Video-consult providers that are built like doctors (own profile collection per role). */
export type ConsultProviderRole = "herbalist" | "nutritionist";

export type PublicConsultProviderClinic = { name: string; city: string; address?: string };

export type PublicConsultProviderWeeklyWindow = {
  dayOfWeek: number;
  startTimeLocal: string;
  endTimeLocal: string;
};

export type PublicConsultProvider = {
  role: ConsultProviderRole;
  /** Provider profile id — what appointments and reviews reference. */
  id: string;
  userId: string;
  slug: string;
  name: string;
  avatarUrl?: string;
  specialties: string[];
  bio?: string;
  experienceYears: number;
  languages: string[];
  degree?: string;
  qualifications: string[];
  institute?: string;
  graduationYear?: number;
  clinics: PublicConsultProviderClinic[];
  /** Primary city (first clinic, else first coverage city). */
  city: string;
  coverageCities: string[];
  consultationFee: number;
  videoConsultEnabled: boolean;
  weeklyAvailability: PublicConsultProviderWeeklyWindow[];
  /** Average visible patient rating (one decimal); undefined when unreviewed. */
  ratingAvg?: number;
  reviewCount: number;
};

type ProviderModel = typeof HerbalistProfileModel;

const ROLE_CONFIG: Record<
  ConsultProviderRole,
  {
    Model: ProviderModel;
    ensureSlug: (profileId: string, name: string, stored?: string | null) => Promise<string>;
  }
> = {
  herbalist: { Model: HerbalistProfileModel, ensureSlug: ensureCanonicalHerbalistSlug },
  nutritionist: {
    Model: NutritionistProfileModel as unknown as ProviderModel,
    ensureSlug: ensureCanonicalNutritionistSlug,
  },
};

/** Same listing rule as doctors: approved, listed by admin, not deleted. */
const PUBLIC_FILTER = {
  isListed: true,
  verificationStatus: VerificationStatuses.APPROVED,
  deletedAt: { $exists: false },
};

type PopulatedUser = {
  _id: Types.ObjectId;
  name?: string;
  avatarUrl?: string;
  isActive?: boolean;
  deletedAt?: Date;
};

const USER_FIELDS = "name avatarUrl isActive deletedAt";

function isListedUser(user: PopulatedUser | null): user is PopulatedUser {
  if (!user?._id) return false;
  return !user.deletedAt && user.isActive !== false;
}

/** Visible review ratings per provider profile, computed from the reviews themselves. */
async function ratingsByProfile(
  profileIds: string[],
): Promise<Map<string, { ratingAvg: number; total: number }>> {
  if (!profileIds.length) return new Map();
  const rows = await ReviewModel.aggregate<{ _id: Types.ObjectId; avg: number; total: number }>([
    {
      $match: {
        doctorId: { $in: profileIds.map((id) => new Types.ObjectId(id)) },
        isVisible: true,
        deletedAt: null,
      },
    },
    { $group: { _id: "$doctorId", avg: { $avg: "$rating" }, total: { $sum: 1 } } },
  ]);
  return new Map(
    rows.map((r) => [r._id.toString(), { ratingAvg: Math.round(r.avg * 10) / 10, total: r.total }]),
  );
}

async function mapProfile(
  role: ConsultProviderRole,
  doc: Record<string, unknown> & { _id: Types.ObjectId },
): Promise<PublicConsultProvider | null> {
  const user = doc.userId as PopulatedUser | null;
  if (!isListedUser(user)) return null;
  const name = safeDisplayText(user.name);
  if (!name) return null;

  const slug = await ROLE_CONFIG[role].ensureSlug(
    doc._id.toString(),
    name,
    doc.slug as string | undefined,
  );

  const clinics = ((doc.clinics as { name?: string; city?: string; address?: string }[]) ?? [])
    .filter((c) => c.name && c.city)
    .map((c) => ({
      name: safeDisplayText(c.name) ?? "",
      city: formatCityName(c.city!),
      address: safeDisplayText(c.address),
    }))
    .filter((c) => c.name);
  const coverageCities = ((doc.coverageCities as string[] | undefined) ?? []).map(formatCityName);
  const specialties = (doc.specialties as string[] | undefined) ?? [];
  const primary = doc.primarySpecialty as string | undefined;

  return {
    role,
    id: doc._id.toString(),
    userId: user._id.toString(),
    slug,
    name,
    avatarUrl: user.avatarUrl ?? undefined,
    // Admin-verified specialties, primary first; fall back to the self-declared primary.
    specialties: specialties.length
      ? [...specialties].sort((a, b) => Number(b === primary) - Number(a === primary))
      : primary
        ? [primary]
        : [],
    bio: safeDisplayText(doc.bio as string | undefined),
    experienceYears: (doc.experienceYears as number | undefined) ?? 0,
    languages: (doc.languages as string[] | undefined)?.length
      ? (doc.languages as string[])
      : ["English", "Urdu"],
    degree: safeDisplayText(doc.degree as string | undefined),
    qualifications: (doc.qualifications as string[] | undefined) ?? [],
    institute: safeDisplayText(doc.institute as string | undefined),
    graduationYear: (doc.graduationYear as number | undefined) ?? undefined,
    clinics,
    city: clinics[0]?.city ?? coverageCities[0] ?? "Lahore",
    coverageCities,
    consultationFee: (doc.consultationFee as number | undefined) ?? 0,
    videoConsultEnabled: Boolean(doc.videoConsultEnabled),
    weeklyAvailability: (
      (doc.weeklyAvailability as
        | { dayOfWeek?: number; startTimeLocal?: string; endTimeLocal?: string }[]
        | undefined) ?? []
    )
      .filter(
        (w): w is PublicConsultProviderWeeklyWindow =>
          typeof w.dayOfWeek === "number" &&
          typeof w.startTimeLocal === "string" &&
          typeof w.endTimeLocal === "string",
      )
      .map((w) => ({
        dayOfWeek: w.dayOfWeek,
        startTimeLocal: w.startTimeLocal,
        endTimeLocal: w.endTimeLocal,
      })),
    reviewCount: 0,
  };
}

function servesCity(provider: PublicConsultProvider, city: string): boolean {
  return [...provider.clinics.map((c) => c.city), ...provider.coverageCities].some((c) =>
    citiesMatch(c, city),
  );
}

export class PublicConsultProviderService {
  /**
   * Listed herbalists or nutritionists, optionally narrowed to a city and/or specialty.
   * Sorted most-reviewed first, then higher rating, then more experience.
   */
  static async list(
    role: ConsultProviderRole,
    options: { city?: string; specialty?: string; limit?: number } = {},
  ): Promise<PublicConsultProvider[]> {
    await connectDatabase();
    const city = options.city?.trim();
    const specialty = options.specialty?.trim().toLowerCase();

    const docs = await ROLE_CONFIG[role].Model.find(mongoFilter(PUBLIC_FILTER))
      .populate("userId", USER_FIELDS)
      .lean();

    const mapped = await Promise.all(docs.map((doc) => mapProfile(role, doc as never)));
    let rows = mapped
      .filter((row): row is PublicConsultProvider => row !== null)
      .filter((row) => !city || servesCity(row, city))
      .filter(
        (row) => !specialty || row.specialties.some((s) => s.trim().toLowerCase() === specialty),
      );

    const ratings = await ratingsByProfile(rows.map((r) => r.id));
    rows = rows.map((r) => {
      const rating = ratings.get(r.id);
      return { ...r, ratingAvg: rating?.ratingAvg, reviewCount: rating?.total ?? 0 };
    });

    rows.sort(
      (a, b) =>
        b.reviewCount - a.reviewCount ||
        (b.ratingAvg ?? 0) - (a.ratingAvg ?? 0) ||
        b.experienceYears - a.experienceYears,
    );

    return options.limit ? rows.slice(0, options.limit) : rows;
  }

  /** Cities offered in the directory filter, deduplicated case-insensitively. */
  static async listCities(role: ConsultProviderRole): Promise<string[]> {
    const rows = await PublicConsultProviderService.list(role);
    const byKey = new Map<string, string>();
    for (const row of rows) {
      for (const city of [...row.clinics.map((c) => c.city), ...row.coverageCities]) {
        const key = normalizeCityName(city);
        if (city && !byKey.has(key)) byKey.set(key, formatCityName(city));
      }
    }
    return [...byKey.values()].sort((a, b) => a.localeCompare(b));
  }

  /** Look up by public slug or by profile id. */
  static async get(
    role: ConsultProviderRole,
    slugOrId: string,
  ): Promise<PublicConsultProvider | null> {
    await connectDatabase();
    const key = slugOrId.trim().toLowerCase();
    if (!key) return null;

    const filter =
      Types.ObjectId.isValid(key) && key.length === 24
        ? { ...PUBLIC_FILTER, _id: new Types.ObjectId(key) }
        : { ...PUBLIC_FILTER, slug: key };

    const doc = await ROLE_CONFIG[role].Model.findOne(mongoFilter(filter))
      .populate("userId", USER_FIELDS)
      .lean();
    if (!doc) return null;
    const provider = await mapProfile(role, doc as never);
    if (!provider) return null;

    const rating = (await ratingsByProfile([provider.id])).get(provider.id);
    return { ...provider, ratingAvg: rating?.ratingAvg, reviewCount: rating?.total ?? 0 };
  }

  /** Visible review rating for one provider profile (listed or not) — for their own dashboard. */
  static async getRating(profileId: string): Promise<{ ratingAvg: number; total: number }> {
    await connectDatabase();
    return (await ratingsByProfile([profileId])).get(profileId) ?? { ratingAvg: 0, total: 0 };
  }

  /** Slugs for the sitemap. */
  static async listSlugs(role: ConsultProviderRole): Promise<string[]> {
    const rows = await PublicConsultProviderService.list(role);
    return rows.map((r) => r.slug);
  }
}
