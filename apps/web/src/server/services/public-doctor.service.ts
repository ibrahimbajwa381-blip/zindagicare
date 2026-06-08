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
import { nameToDoctorSlug } from "@/lib/doctors/profile-path";
import { mongoFilter } from "@/lib/mongo/query";
import { OnlineConsultService } from "@/server/services/online-consult.service";

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
  const slug = (doc.slug as string | undefined)?.trim() || nameToDoctorSlug(name);

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

    if (!doc) return null;

    const consultDoctors = await OnlineConsultService.listConsultDoctors();
    const availability = consultDoctors.find((d) => d.doctorId === doc!._id.toString());

    return mapProfileDoc(doc, availability);
  }

  static async getFeaturedDoctors(limit = 6): Promise<FeaturedDoctorCard[]> {
    let doctors: Awaited<ReturnType<typeof OnlineConsultService.listConsultDoctors>>;
    try {
      doctors = await OnlineConsultService.listConsultDoctors();
    } catch {
      return [];
    }

    return doctors.slice(0, limit).map((doc) => ({
      doctorId: doc.doctorId,
      slug: doc.slug ?? nameToDoctorSlug(doc.name),
      name: doc.name,
      specialty: doc.specialties[0] ?? "General Physician",
      hospital: doc.hospital ?? "Lahore",
      rating: doc.ratingAvg,
      reviews: doc.ratingCount,
      fee: doc.consultationFee,
      pmdcVerified: doc.pmdcVerified,
      imageUrl: doc.avatarUrl,
    }));
  }
}
