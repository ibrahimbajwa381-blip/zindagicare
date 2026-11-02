import {
  connectDatabase,
  DoctorProfileModel,
} from "@zindagi/database";
import { VerificationStatuses, resolveDisplaySpecialty, withDoctorTitle } from "@zindagi/shared";
import { resolveDoctorPortrait } from "@/features/marketing/data/demo-doctor-images";
import type {
  FeaturedDoctorCard,
  PublicDoctorProfile,
} from "@/features/marketing/types/doctor-public";
import { resolveDoctorSlug } from "@/lib/doctors/profile-path";
import { mapDoctorPortfolio, toPublicDoctorPortfolio } from "@/lib/doctors/portfolio";
import { mongoFilter } from "@/lib/mongo/query";
import {
  ensureCanonicalDoctorSlug,
} from "@/server/services/doctor-slug.service";
import { OnlineConsultService } from "@/server/services/online-consult.service";
import type { WeeklyWindow } from "@/lib/consult/slot-utils";
import { CacheTags, cacheKey, cached } from "@/server/lib/cache";

export type PublicDoctorDirectoryEntry = {
  slug: string;
  name: string;
  specialty: string;
  city?: string;
  hospital?: string;
  consultationFee: number;
  avatarUrl?: string;
  updatedAt?: string;
  /** Cities the doctor visits patients at home in — empty when home visits are off. */
  homeVisitCities: string[];
  homeVisitFee: number;
};

const PUBLIC_DOCTOR_FILTER = {
  isListed: true,
  verificationStatus: VerificationStatuses.APPROVED,
  deletedAt: null,
} as const;

function mapHospitals(
  hospitals?: { name?: string; city?: string; area?: string; address?: string }[] | null,
) {
  return (hospitals ?? [])
    .filter((h) => h.name && h.city)
    .map((h) => ({
      name: h.name!,
      city: h.city!,
      area: h.area ?? undefined,
      address: h.address ?? undefined,
    }));
}

async function mapProfileDoc(
  doc: Record<string, unknown> & { _id: { toString(): string } },
  availability?: { availableSlots: number; isFull: boolean },
): Promise<PublicDoctorProfile> {
  const user = doc.userId as { name?: string; avatarUrl?: string } | null | undefined;
  const name = user?.name ?? "Doctor";
  const portfolio = mapDoctorPortfolio(doc as Parameters<typeof mapDoctorPortfolio>[0]);
  const slug = await ensureCanonicalDoctorSlug(
    doc._id.toString(),
    name,
    doc.slug as string | undefined,
  );

  return {
    doctorId: doc._id.toString(),
    slug,
    name: withDoctorTitle(name),
    avatarUrl: resolveDoctorPortrait(name, user?.avatarUrl),
    specialties: (doc.specialties as string[] | undefined) ?? [],
    bio: (doc.bio as string | undefined) ?? undefined,
    experienceYears: (doc.experienceYears as number | undefined) ?? 0,
    languages: (doc.languages as string[] | undefined) ?? ["English", "Urdu"],
    medicalDegree: (doc.medicalDegree as string | undefined) ?? undefined,
    qualifications: (doc.qualifications as string[] | undefined) ?? [],
    medicalCollege: (doc.medicalCollege as string | undefined) ?? undefined,
    graduationYear: (doc.graduationYear as number | undefined) ?? undefined,
    hospitals: mapHospitals(
      doc.hospitals as
        | { name?: string; city?: string; area?: string; address?: string }[]
        | undefined,
    ),
    pmdcVerified: (doc.pmdcVerified as boolean | undefined) ?? false,
    consultationFee: (doc.consultationFee as number | undefined) ?? 0,
    ratingAvg: (doc.ratingAvg as number | undefined) ?? 0,
    ratingCount: (doc.ratingCount as number | undefined) ?? 0,
    availableSlots: availability?.availableSlots ?? 0,
    isFull: availability?.isFull ?? true,
    videoConsultEnabled: (doc.videoConsultEnabled as boolean | undefined) ?? false,
    weeklyAvailability: (
      (doc.weeklyAvailability as
        | { dayOfWeek?: number; startTimeLocal?: string; endTimeLocal?: string }[]
        | undefined) ?? []
    )
      .filter(
        (w): w is { dayOfWeek: number; startTimeLocal: string; endTimeLocal: string } =>
          typeof w.dayOfWeek === "number" &&
          typeof w.startTimeLocal === "string" &&
          typeof w.endTimeLocal === "string",
      )
      .map((w) => ({
        dayOfWeek: w.dayOfWeek,
        startTimeLocal: w.startTimeLocal,
        endTimeLocal: w.endTimeLocal,
      })),
    portfolio: toPublicDoctorPortfolio(portfolio),
    faqsHidden: portfolio.hiddenSections.includes("faqs"),
  };
}

async function queryFeaturedDoctors(limit: number): Promise<FeaturedDoctorCard[]> {
  await connectDatabase();

  const doctors = await DoctorProfileModel.find(PUBLIC_DOCTOR_FILTER)
    .populate("userId", "name avatarUrl")
    .sort({ ratingAvg: -1, ratingCount: -1 })
    .limit(limit)
    .lean();

  return doctors.map((doc) => {
    const user = doc.userId as { name?: string; avatarUrl?: string } | null;
    const name = user?.name ?? "Doctor";
    const verified = doc.specialties ?? [];
    const primary = resolveDisplaySpecialty({
      primarySpecialty: doc.primarySpecialty,
      specialties: verified,
    });

    return {
      doctorId: doc._id.toString(),
      slug: resolveDoctorSlug(doc.slug, name),
      name,
      // Primary first, then every other verified specialty.
      specialty: [primary, ...verified.filter((s) => s !== primary)].join(" · "),
      hospital: doc.hospitals?.[0]?.name ?? "",
      rating: doc.ratingAvg ?? 0,
      reviews: doc.ratingCount ?? 0,
      fee: doc.consultationFee ?? 0,
      pmdcVerified: doc.pmdcVerified ?? false,
      imageUrl: resolveDoctorPortrait(name, user?.avatarUrl),
      medicalDegree: doc.medicalDegree ?? undefined,
      qualifications: doc.qualifications ?? [],
    };
  });
}

export class PublicDoctorService {
  static async ensureConnected() {
    await connectDatabase();
  }

  static async getPublicDoctor(slugOrId: string): Promise<PublicDoctorProfile | null> {
    return cached(
      cacheKey("doctor", slugOrId),
      { ttl: 300, tags: [CacheTags.DOCTORS, CacheTags.DOCTOR_AVAILABILITY] },
      () => PublicDoctorService.loadPublicDoctor(slugOrId),
    );
  }

  private static async loadPublicDoctor(slugOrId: string): Promise<PublicDoctorProfile | null> {
    await PublicDoctorService.ensureConnected();

    const normalized = slugOrId.trim().toLowerCase();

    let doc = await DoctorProfileModel.findOne(
      mongoFilter({ slug: normalized, ...PUBLIC_DOCTOR_FILTER }),
    )
      .populate("userId", "name avatarUrl")
      .lean();

    if (!doc && /^[a-f0-9]{24}$/i.test(slugOrId)) {
      doc = await DoctorProfileModel.findOne(
        mongoFilter({ _id: slugOrId, ...PUBLIC_DOCTOR_FILTER }),
      )
        .populate("userId", "name avatarUrl")
        .lean();
    }

    if (!doc) {
      const candidates = await DoctorProfileModel.find(PUBLIC_DOCTOR_FILTER)
        .select("slug userId")
        .populate("userId", "name")
        .lean();

      const matched = candidates.find((candidate) => {
        const user = candidate.userId as { name?: string } | null;
        const name = user?.name ?? "Doctor";
        return resolveDoctorSlug(candidate.slug, name) === normalized;
      });

      if (matched) {
        doc = await DoctorProfileModel.findOne(
          mongoFilter({ _id: matched._id, ...PUBLIC_DOCTOR_FILTER }),
        )
          .populate("userId", "name avatarUrl")
          .lean();
      }
    }

    if (!doc) return null;

    const weeklyAvailability = (doc.weeklyAvailability ?? []) as WeeklyWindow[];
    const availability =
      doc.videoConsultEnabled && weeklyAvailability.length > 0
        ? await OnlineConsultService.getDoctorAvailabilitySummary(
            doc._id.toString(),
            weeklyAvailability,
          )
        : undefined;

    return mapProfileDoc(doc, availability);
  }

  static async getFeaturedDoctors(limit = 6): Promise<FeaturedDoctorCard[]> {
    try {
      return await cached(
        cacheKey("doctors-featured", limit),
        { ttl: 900, tags: [CacheTags.DOCTORS] },
        () => queryFeaturedDoctors(limit),
      );
    } catch {
      return [];
    }
  }

  /** Slug, photo and last edit of every public doctor, for the sitemap and llms.txt. */
  static async listPublicDoctorDirectory(): Promise<PublicDoctorDirectoryEntry[]> {
    return cached(cacheKey("doctor-directory"), { ttl: 900, tags: [CacheTags.DOCTORS] }, () =>
      PublicDoctorService.loadPublicDoctorDirectory(),
    );
  }

  private static async loadPublicDoctorDirectory(): Promise<PublicDoctorDirectoryEntry[]> {
    await PublicDoctorService.ensureConnected();

    const doctors = await DoctorProfileModel.find(PUBLIC_DOCTOR_FILTER)
      .select(
        "slug userId specialties primarySpecialty hospitals consultationFee updatedAt homeVisitEnabled coverageCities homeVisitFee",
      )
      .populate("userId", "name avatarUrl")
      .lean();

    return doctors.map((doc) => {
      const user = doc.userId as { name?: string; avatarUrl?: string } | null;
      const name = user?.name ?? "Doctor";
      return {
        slug: resolveDoctorSlug(doc.slug, name),
        name: withDoctorTitle(name),
        specialty: resolveDisplaySpecialty({
          primarySpecialty: doc.primarySpecialty,
          specialties: doc.specialties ?? [],
        }),
        city: doc.hospitals?.[0]?.city ?? undefined,
        hospital: doc.hospitals?.[0]?.name ?? undefined,
        consultationFee: doc.consultationFee ?? 0,
        avatarUrl: resolveDoctorPortrait(name, user?.avatarUrl),
        updatedAt: (doc.updatedAt as Date | undefined)?.toISOString(),
        homeVisitCities: doc.homeVisitEnabled ? (doc.coverageCities ?? []) : [],
        homeVisitFee: doc.homeVisitFee ?? 0,
      };
    });
  }
}
