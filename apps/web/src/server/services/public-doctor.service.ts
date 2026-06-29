import {
  connectDatabase,
  DoctorProfileModel,
} from "@zindagi/database";
import { VerificationStatuses } from "@zindagi/shared";
import { resolveDoctorPortrait } from "@/features/marketing/data/demo-doctor-images";
import type {
  FeaturedDoctorCard,
  PublicDoctorProfile,
} from "@/features/marketing/types/doctor-public";
import { resolveDoctorSlug } from "@/lib/doctors/profile-path";
import { mongoFilter } from "@/lib/mongo/query";
import {
  ensureCanonicalDoctorSlug,
} from "@/server/services/doctor-slug.service";
import { OnlineConsultService } from "@/server/services/online-consult.service";
import type { WeeklyWindow } from "@/lib/consult/slot-utils";

const PUBLIC_DOCTOR_FILTER = {
  isListed: true,
  verificationStatus: VerificationStatuses.APPROVED,
  deletedAt: null,
} as const;

function mapHospitals(
  hospitals?: { name?: string; city?: string; address?: string }[] | null,
) {
  return (hospitals ?? [])
    .filter((h) => h.name && h.city)
    .map((h) => ({
      name: h.name!,
      city: h.city!,
      address: h.address ?? undefined,
    }));
}

async function mapProfileDoc(
  doc: Record<string, unknown> & { _id: { toString(): string } },
  availability?: { availableSlots: number; isFull: boolean },
): Promise<PublicDoctorProfile> {
  const user = doc.userId as { name?: string; avatarUrl?: string } | null | undefined;
  const name = user?.name ?? "Doctor";
  const slug = await ensureCanonicalDoctorSlug(
    doc._id.toString(),
    name,
    doc.slug as string | undefined,
  );

  return {
    doctorId: doc._id.toString(),
    slug,
    name,
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
      doc.hospitals as { name?: string; city?: string; address?: string }[] | undefined,
    ),
    pmdcVerified: (doc.pmdcVerified as boolean | undefined) ?? false,
    consultationFee: (doc.consultationFee as number | undefined) ?? 0,
    ratingAvg: (doc.ratingAvg as number | undefined) ?? 0,
    ratingCount: (doc.ratingCount as number | undefined) ?? 0,
    availableSlots: availability?.availableSlots ?? 0,
    isFull: availability?.isFull ?? true,
    videoConsultEnabled: (doc.videoConsultEnabled as boolean | undefined) ?? false,
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

    return {
      doctorId: doc._id.toString(),
      slug: resolveDoctorSlug(doc.slug, name),
      name,
      specialty: doc.specialties?.[0] ?? "General Physician",
      hospital: doc.hospitals?.[0]?.name ?? "Lahore",
      rating: doc.ratingAvg ?? 0,
      reviews: doc.ratingCount ?? 0,
      fee: doc.consultationFee ?? 0,
      pmdcVerified: doc.pmdcVerified ?? false,
      imageUrl: resolveDoctorPortrait(name, user?.avatarUrl),
    };
  });
}

const FEATURED_CACHE_MS = 60_000;
const featuredDoctorsCache = new Map<
  string,
  { at: number; data: FeaturedDoctorCard[] }
>();

async function getFeaturedDoctorsCached(limit: number): Promise<FeaturedDoctorCard[]> {
  const key = String(limit);
  const hit = featuredDoctorsCache.get(key);
  if (hit && Date.now() - hit.at < FEATURED_CACHE_MS) {
    return hit.data;
  }

  const data = await queryFeaturedDoctors(limit);
  featuredDoctorsCache.set(key, { at: Date.now(), data });
  return data;
}

export class PublicDoctorService {
  static async ensureConnected() {
    await connectDatabase();
  }

  static async getPublicDoctor(slugOrId: string): Promise<PublicDoctorProfile | null> {
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
      return await getFeaturedDoctorsCached(limit);
    } catch {
      return [];
    }
  }

  static async listPublicDoctorSlugs(): Promise<string[]> {
    await PublicDoctorService.ensureConnected();

    const doctors = await DoctorProfileModel.find(PUBLIC_DOCTOR_FILTER)
      .select("slug userId")
      .populate("userId", "name")
      .lean();

    return doctors.map((doc) => {
      const user = doc.userId as { name?: string } | null;
      const name = user?.name ?? "Doctor";
      return resolveDoctorSlug(doc.slug, name);
    });
  }
}
