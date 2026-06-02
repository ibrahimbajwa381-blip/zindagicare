import {
  connectDatabase,
  DoctorProfileModel,
  SundaySlotTemplateModel,
  UserModel,
  type DoctorProfileDocument,
} from "@zindagi/database";
import { AppError, Roles, VerificationStatuses } from "@zindagi/shared";

import type {
  DoctorProfileDto,
  SundayConsultDto,
  WeeklyAvailabilityDto,
} from "@/features/doctor/types";
import { formatDayOfWeek } from "@/features/doctor/types";
import { mongoFilter } from "@/lib/mongo/query";

export type { DoctorProfileDto, SundayConsultDto, WeeklyAvailabilityDto };
export { formatDayOfWeek };

async function buildSundayConsultDto(
  doctorProfileId: string,
  profileDefaults?: { durationMins?: number; maxSlots?: number },
): Promise<SundayConsultDto> {
  const template = await SundaySlotTemplateModel.findOne(
    mongoFilter({
      doctorId: doctorProfileId,
      isActive: true,
    }),
  ).lean();

  if (!template) {
    return {
      enabled: false,
      slotDurationMins: profileDefaults?.durationMins ?? 10,
    };
  }

  return {
    enabled: true,
    startTimeLocal: template.startTimeLocal,
    endTimeLocal: template.endTimeLocal,
    slotDurationMins: template.slotDurationMins,
    maxSlots: template.maxSlots,
  };
}

function mapProfileToDto(
  profile: DoctorProfileDocument,
  user: {
    _id: { toString(): string };
    name: string;
    email?: string | null;
    phone?: string | null;
    avatarUrl?: string | null;
    createdAt?: Date;
  },
  sundayConsult: SundayConsultDto,
): DoctorProfileDto {
  return {
    id: profile._id.toString(),
    user: {
      id: user._id.toString(),
      name: user.name,
      email: user.email ?? undefined,
      phone: user.phone ?? undefined,
      avatarUrl: user.avatarUrl ?? undefined,
      memberSince: user.createdAt?.toISOString() ?? new Date().toISOString(),
    },
    pmdcNumber: profile.pmdcNumber ?? undefined,
    pmdcVerified: profile.pmdcVerified ?? false,
    cnicLast4: profile.cnicLast4 ?? undefined,
    medicalDegree: profile.medicalDegree ?? undefined,
    medicalCollege: profile.medicalCollege ?? undefined,
    graduationYear: profile.graduationYear ?? undefined,
    experienceYears: profile.experienceYears ?? 0,
    specialties: profile.specialties ?? [],
    bio: profile.bio ?? undefined,
    languages: profile.languages ?? ["English", "Urdu"],
    hospitals: (profile.hospitals ?? []).map((h) => ({
      name: h.name,
      city: h.city,
      address: h.address ?? undefined,
    })),
    consultationFee: profile.consultationFee ?? 0,
    weeklyAvailability: (profile.weeklyAvailability ?? []).map((slot) => ({
      dayOfWeek: slot.dayOfWeek,
      startTimeLocal: slot.startTimeLocal,
      endTimeLocal: slot.endTimeLocal,
    })),
    sundayConsult,
    verificationStatus: profile.verificationStatus,
    verificationSubmittedAt: profile.verificationSubmittedAt?.toISOString(),
    rejectionReason: profile.rejectionReason ?? undefined,
    isListed: profile.isListed ?? false,
    slug: profile.slug ?? undefined,
    verifiedAt: profile.verifiedAt?.toISOString(),
    documents: {
      pmdcCertificate: profile.verificationDocuments?.pmdcCertificate ?? undefined,
      cnicFront: profile.verificationDocuments?.cnicFront ?? undefined,
      cnicBack: profile.verificationDocuments?.cnicBack ?? undefined,
      degreeCertificate: profile.verificationDocuments?.degreeCertificate ?? undefined,
    },
  };
}

export async function getDoctorProfile(userId: string): Promise<DoctorProfileDto> {
  await connectDatabase();

  const user = await UserModel.findById(userId).lean();
  if (!user?.roles.includes(Roles.DOCTOR)) {
    throw new AppError("Forbidden", "FORBIDDEN", 403);
  }

  const profile = await DoctorProfileModel.findOne(mongoFilter({ userId: user._id }));
  if (!profile) {
    throw new AppError("Doctor profile not found", "NOT_FOUND", 404);
  }

  const sundayConsult = await buildSundayConsultDto(profile._id.toString(), {
    durationMins: profile.sundaySlotDefaults?.durationMins,
    maxSlots: profile.sundaySlotDefaults?.maxSlots,
  });

  return mapProfileToDto(profile, user, sundayConsult);
}

export async function getDoctorProfileForAdmin(
  doctorProfileId: string,
): Promise<DoctorProfileDto> {
  await connectDatabase();

  const profile = await DoctorProfileModel.findById(doctorProfileId);
  if (!profile) {
    throw new AppError("Doctor profile not found", "NOT_FOUND", 404);
  }

  const user = await UserModel.findById(profile.userId).lean();
  if (!user) {
    throw new AppError("User not found", "NOT_FOUND", 404);
  }

  const sundayConsult = await buildSundayConsultDto(profile._id.toString(), {
    durationMins: profile.sundaySlotDefaults?.durationMins,
    maxSlots: profile.sundaySlotDefaults?.maxSlots,
  });

  return mapProfileToDto(profile, user, sundayConsult);
}

export async function canDoctorAccessDocument(
  userId: string,
  roles: string[],
  storageKey: string,
): Promise<boolean> {
  if (roles.includes(Roles.ADMIN) || roles.includes(Roles.SUPER_ADMIN)) {
    return true;
  }

  await connectDatabase();
  const profile = await DoctorProfileModel.findOne({ userId }).lean();
  if (!profile) return false;

  const docs = profile.verificationDocuments ?? {};
  const urls = Object.values(docs).filter(Boolean) as string[];
  const encodedKey = encodeURIComponent(storageKey);
  return urls.some((url) => url.includes(encodedKey) || url.includes(storageKey));
}

export function isDoctorProfileEditable(status: string): boolean {
  return (
    status !== VerificationStatuses.PENDING &&
    status !== VerificationStatuses.APPROVED
  );
}
