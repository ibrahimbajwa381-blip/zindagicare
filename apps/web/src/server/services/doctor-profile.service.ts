import {
  connectDatabase,
  DoctorProfileModel,
  SundaySlotTemplateModel,
  UserModel,
  type DoctorProfileDocument,
} from "@zindagi/database";
import {
  AppError,
  Roles,
  SUNDAY_CONSULT_CONFIG,
  VerificationStatuses,
  phoneLookupHash,
} from "@zindagi/shared";
import type { UpdateDoctorProfileInput } from "@zindagi/validators";

import type {
  DoctorProfileDto,
  SundayConsultDto,
  WeeklyAvailabilityDto,
} from "@/features/doctor/types";
import { formatDayOfWeek } from "@/features/doctor/types";
import { normalizePakistaniPhone } from "@/lib/auth/phone";
import { getNextSundayDate } from "@/lib/sunday/date-utils";
import { mongoFilter } from "@/lib/mongo/query";
import { SundayConsultService } from "./sunday-consult.service";
import { normalizePhoneDigits, toPakistaniLocalPhone } from "@zindagi/validators";
import { mapUserPii } from "@/server/lib/decrypt-pii";
import { isDoctorAvatarUrlForUser } from "@/server/services/doctor-avatar.storage";

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
  const pii = mapUserPii(user);

  return {
    id: profile._id.toString(),
    user: {
      id: user._id.toString(),
      name: pii.name,
      email: pii.email,
      phone: pii.phone,
      avatarUrl: user.avatarUrl ?? undefined,
      memberSince: user.createdAt?.toISOString() ?? new Date().toISOString(),
    },
    pmdcNumber: profile.pmdcNumber ?? undefined,
    pmdcVerified: profile.pmdcVerified ?? false,
    cnicLast4: profile.cnicLast4 ?? undefined,
    medicalDegree: profile.medicalDegree ?? undefined,
    qualifications: profile.qualifications ?? [],
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
    homeVisit: {
      enabled: profile.homeVisitEnabled ?? false,
      area: profile.homeVisitLocation?.area ?? undefined,
      geo:
        profile.homeVisitLocation?.geo?.coordinates?.length === 2
          ? {
              lng: profile.homeVisitLocation.geo.coordinates[0],
              lat: profile.homeVisitLocation.geo.coordinates[1],
            }
          : undefined,
    },
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

function computeMaxSundaySlots(
  startTimeLocal: string,
  endTimeLocal: string,
  slotDurationMins: number,
): number {
  const [startH, startM] = startTimeLocal.split(":").map(Number);
  const [endH, endM] = endTimeLocal.split(":").map(Number);
  const totalMins = endH * 60 + endM - (startH * 60 + startM);
  if (totalMins <= 0) return 1;
  return Math.min(
    Math.floor(totalMins / slotDurationMins),
    SUNDAY_CONSULT_CONFIG.defaultMaxSlots,
  );
}

async function upsertSundayTemplateFromProfileEdit(
  doctorProfileId: string,
  sundayConsult: NonNullable<UpdateDoctorProfileInput["sundayConsult"]>,
) {
  if (
    !sundayConsult.enabled ||
    !sundayConsult.startTimeLocal ||
    !sundayConsult.endTimeLocal
  ) {
    await SundaySlotTemplateModel.findOneAndUpdate(
      mongoFilter({ doctorId: doctorProfileId }),
      { $set: { isActive: false } },
    );
    return;
  }

  const slotDurationMins =
    sundayConsult.slotDurationMins ?? SUNDAY_CONSULT_CONFIG.defaultSlotDurationMins;
  const maxSlots = computeMaxSundaySlots(
    sundayConsult.startTimeLocal,
    sundayConsult.endTimeLocal,
    slotDurationMins,
  );

  await SundaySlotTemplateModel.findOneAndUpdate(
    mongoFilter({ doctorId: doctorProfileId }),
    {
      $set: {
        startTimeLocal: sundayConsult.startTimeLocal,
        endTimeLocal: sundayConsult.endTimeLocal,
        slotDurationMins,
        maxSlots,
        dayOfWeek: SUNDAY_CONSULT_CONFIG.dayOfWeek,
        timezone: SUNDAY_CONSULT_CONFIG.timezone,
        isActive: true,
      },
    },
    { upsert: true, new: true },
  );

  await SundayConsultService.materializeInstance(
    doctorProfileId,
    getNextSundayDate(),
  );
}

export async function updateDoctorProfile(
  userId: string,
  data: UpdateDoctorProfileInput,
): Promise<DoctorProfileDto> {
  await connectDatabase();

  const user = await UserModel.findById(userId);
  if (!user?.roles.includes(Roles.DOCTOR)) {
    throw new AppError("Forbidden", "FORBIDDEN", 403);
  }

  const profile = await DoctorProfileModel.findOne(mongoFilter({ userId: user._id }));
  if (!profile) {
    throw new AppError("Doctor profile not found", "NOT_FOUND", 404);
  }

  if (profile.verificationStatus === VerificationStatuses.PENDING) {
    throw new AppError(
      "Profile cannot be edited while pending admin review",
      "FORBIDDEN",
      403,
    );
  }

  if (profile.verificationStatus !== VerificationStatuses.APPROVED) {
    throw new AppError(
      "Use verification to resubmit your application",
      "FORBIDDEN",
      403,
    );
  }

  if (data.name !== undefined) {
    user.name = data.name.trim();
  }

  if (data.phone !== undefined) {
    const normalized = normalizePakistaniPhone(data.phone);
    const phoneLocal = toPakistaniLocalPhone(normalizePhoneDigits(data.phone));
    if (normalized !== user.phone && phoneLocal !== user.phone) {
      const existing = await UserModel.findOne({
        _id: { $ne: user._id },
        $or: [
          { phoneLookup: phoneLookupHash(normalized) },
          { phoneLookup: phoneLookupHash(phoneLocal) },
        ],
      });
      if (existing) {
        throw new AppError("Phone number already in use", "CONFLICT", 409, "phone");
      }
      user.phone = normalized;
    }
  }

  if (data.avatarUrl !== undefined) {
    if (!isDoctorAvatarUrlForUser(userId, data.avatarUrl)) {
      throw new AppError("Invalid profile photo", "VALIDATION_ERROR", 400);
    }
    user.avatarUrl = data.avatarUrl;
  }

  if (
    data.name !== undefined ||
    data.phone !== undefined ||
    data.avatarUrl !== undefined
  ) {
    await user.save();
  }

  if (data.bio !== undefined) {
    profile.bio = data.bio ?? undefined;
  }
  if (data.consultationFee !== undefined) {
    profile.consultationFee = data.consultationFee;
  }
  if (data.specialties !== undefined) {
    profile.specialties = data.specialties;
  }
  if (data.languages !== undefined) {
    profile.languages = data.languages;
  }
  if (data.hospitals !== undefined) {
    const hospitals = data.hospitals.map((h) => ({
      name: h.name.trim(),
      city: h.city.trim(),
      address: h.address?.trim() || undefined,
    }));
    profile.set("hospitals", hospitals);
    profile.coverageCities = [
      ...new Set(data.hospitals.map((hospital) => hospital.city.trim())),
    ];
  }
  if (data.weeklyAvailability !== undefined) {
    profile.set("weeklyAvailability", data.weeklyAvailability);
  }

  if (data.homeVisit !== undefined) {
    profile.homeVisitEnabled = data.homeVisit.enabled;
    if (data.homeVisit.enabled && data.homeVisit.geo) {
      profile.homeVisitLocation = {
        area: data.homeVisit.area?.trim(),
        geo: {
          type: "Point",
          coordinates: [data.homeVisit.geo.lng, data.homeVisit.geo.lat],
        },
      };
    } else if (!data.homeVisit.enabled) {
      profile.homeVisitLocation = undefined;
    }

    if (data.homeVisit.enabled) {
      profile.coverageCities = [
        ...new Set([
          ...(profile.coverageCities ?? []),
          ...(profile.hospitals ?? []).map((h) => h.city?.trim()).filter(Boolean),
        ]),
      ];
    }
  }

  await profile.save();

  if (data.sundayConsult !== undefined) {
    await upsertSundayTemplateFromProfileEdit(profile._id.toString(), data.sundayConsult);
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
  return status === VerificationStatuses.APPROVED;
}
