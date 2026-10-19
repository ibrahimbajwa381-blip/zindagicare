import {
  connectDatabase,
  NutritionistProfileModel,
  UserModel,
} from "@zindagi/database";
import {
  AppError,
  Roles,
  VerificationStatuses,
  phoneLookupHash,
} from "@zindagi/shared";
import type { UpdateNutritionistProfileInput } from "@zindagi/validators";
import { normalizePakistaniPhone } from "@/lib/auth/phone";
import { resolveHospitalArea } from "@/lib/doctors/hospital-area";
import { mongoFilter } from "@/lib/mongo/query";
import { mapUserPii } from "@/server/lib/decrypt-pii";
import {
  deleteNutritionistAvatar,
  nutritionistAvatarStorageKeyFromUrl,
  isNutritionistAvatarUrlForUser,
} from "@/server/services/nutritionist-avatar.storage";
import { resolveNutritionistSlug } from "@/server/services/nutritionist-slug.service";
import { ensureNutritionistProfile } from "./nutritionist-verification.service";

export type NutritionistClinicDto = {
  name: string;
  city: string;
  area?: string;
  address?: string;
  geo?: { lng: number; lat: number };
};

export type NutritionistAvailabilityDto = {
  dayOfWeek: number;
  startTimeLocal: string;
  endTimeLocal: string;
};

export type NutritionistProfileDto = {
  id: string;
  user: {
    id: string;
    name: string;
    email?: string;
    phone?: string;
    avatarUrl?: string;
    memberSince: string;
  };
  slug?: string;
  licenseNumber?: string;
  licenseVerified: boolean;
  cnicLast4?: string;
  degree?: string;
  qualifications: string[];
  institute?: string;
  graduationYear?: number;
  experienceYears: number;
  bio?: string;
  languages: string[];
  consultationFee: number;
  videoConsultEnabled: boolean;
  primarySpecialty?: string;
  additionalSpecialties: string[];
  /** Admin-verified, patient-visible specialties. */
  specialties: string[];
  clinics: NutritionistClinicDto[];
  coverageCities: string[];
  weeklyAvailability: NutritionistAvailabilityDto[];
  ratingAvg: number;
  ratingCount: number;
  isListed: boolean;
  verification: {
    status: string;
    submittedAt?: string;
    verifiedAt?: string;
    rejectionReason?: string;
    platformAgreementAcceptedAt?: string;
    documents: { key: string; label: string; url: string }[];
  };
};

export const NUTRITIONIST_DOCUMENT_LABELS: Record<string, string> = {
  licenseCertificate: "Council / license certificate",
  degreeCertificate: "Degree certificate",
  cnicFront: "CNIC front",
  cnicBack: "CNIC back",
};

export function mapNutritionistDocuments(
  docs: Record<string, string | undefined> | null | undefined,
) {
  return Object.entries(NUTRITIONIST_DOCUMENT_LABELS)
    .map(([key, label]) => ({ key, label, url: docs?.[key] ?? "" }))
    .filter((d) => d.url);
}

type GeoLike = { coordinates?: number[] } | null | undefined;

function mapGeo(geo: GeoLike) {
  if (!geo?.coordinates || geo.coordinates.length !== 2) return undefined;
  return { lng: geo.coordinates[0]!, lat: geo.coordinates[1]! };
}

async function loadNutritionistUser(userId: string) {
  await connectDatabase();
  const user = await UserModel.findById(userId);
  if (!user || user.deletedAt || user.isActive === false) {
    throw new AppError("User not found", "NOT_FOUND", 404);
  }
  if (!user.roles?.includes(Roles.NUTRITIONIST)) {
    throw new AppError("Forbidden", "FORBIDDEN", 403);
  }
  return user;
}

export async function getNutritionistProfile(
  userId: string,
): Promise<NutritionistProfileDto> {
  const user = await loadNutritionistUser(userId);
  const profile = await ensureNutritionistProfile(userId);
  const pii = mapUserPii(user);
  const name = pii.name ?? "Nutritionist";

  return {
    id: profile._id.toString(),
    user: {
      id: user._id.toString(),
      name,
      email: pii.email,
      phone: pii.phone,
      avatarUrl: user.avatarUrl ?? undefined,
      memberSince: user.createdAt?.toISOString() ?? new Date().toISOString(),
    },
    slug: resolveNutritionistSlug(profile.slug, name),
    licenseNumber: profile.licenseNumber ?? undefined,
    licenseVerified: profile.licenseVerified ?? false,
    cnicLast4: profile.cnicLast4 ?? undefined,
    degree: profile.degree ?? undefined,
    qualifications: profile.qualifications ?? [],
    institute: profile.institute ?? undefined,
    graduationYear: profile.graduationYear ?? undefined,
    experienceYears: profile.experienceYears ?? 0,
    bio: profile.bio ?? undefined,
    languages: profile.languages ?? [],
    consultationFee: profile.consultationFee ?? 0,
    videoConsultEnabled: profile.videoConsultEnabled ?? false,
    primarySpecialty: profile.primarySpecialty ?? undefined,
    additionalSpecialties: profile.additionalSpecialties ?? [],
    specialties: profile.specialties ?? [],
    clinics: (profile.clinics ?? []).map((clinic) => ({
      name: clinic.name,
      city: clinic.city,
      area: clinic.area ?? undefined,
      address: clinic.address ?? undefined,
      geo: mapGeo(clinic.geo as GeoLike),
    })),
    coverageCities: profile.coverageCities ?? [],
    weeklyAvailability: (profile.weeklyAvailability ?? []).map((slot) => ({
      dayOfWeek: slot.dayOfWeek,
      startTimeLocal: slot.startTimeLocal,
      endTimeLocal: slot.endTimeLocal,
    })),
    ratingAvg: profile.ratingAvg ?? 0,
    ratingCount: profile.ratingCount ?? 0,
    isListed: profile.isListed ?? false,
    verification: {
      status: profile.verificationStatus ?? VerificationStatuses.PENDING,
      submittedAt: profile.verificationSubmittedAt?.toISOString(),
      verifiedAt: profile.verifiedAt?.toISOString(),
      rejectionReason: profile.rejectionReason ?? undefined,
      platformAgreementAcceptedAt:
        profile.platformAgreementAcceptedAt?.toISOString(),
      documents: mapNutritionistDocuments(
        profile.verificationDocuments as Record<string, string | undefined>,
      ),
    },
  };
}

export async function updateNutritionistProfile(
  userId: string,
  data: UpdateNutritionistProfileInput,
): Promise<NutritionistProfileDto> {
  const user = await loadNutritionistUser(userId);
  const profile = await ensureNutritionistProfile(userId);

  if (data.name !== undefined) {
    user.name = data.name.trim();
  }

  if (data.phone !== undefined) {
    const normalized = normalizePakistaniPhone(data.phone);
    if (normalized !== user.phone) {
      const existing = await UserModel.findOne({
        _id: { $ne: user._id },
        phoneLookup: phoneLookupHash(normalized),
      });
      if (existing) {
        throw new AppError("Phone number already in use", "CONFLICT", 409, "phone");
      }
      user.phone = normalized;
    }
  }

  let previousAvatarUrl: string | undefined;
  if (data.avatarUrl !== undefined) {
    if (!isNutritionistAvatarUrlForUser(userId, data.avatarUrl)) {
      throw new AppError("Invalid profile photo", "VALIDATION_ERROR", 400);
    }
    if (user.avatarUrl && user.avatarUrl !== data.avatarUrl) {
      previousAvatarUrl = user.avatarUrl;
    }
    user.avatarUrl = data.avatarUrl;
  }

  await user.save();
  if (previousAvatarUrl) {
    const previousKey = nutritionistAvatarStorageKeyFromUrl(previousAvatarUrl);
    if (previousKey) {
      try {
        await deleteNutritionistAvatar(previousKey);
      } catch {
        // best-effort cleanup; ignore failures (e.g., file already removed)
      }
    }
  }

  if (data.bio !== undefined) profile.bio = data.bio ?? undefined;
  if (data.consultationFee !== undefined) {
    profile.consultationFee = data.consultationFee;
  }
  if (data.languages !== undefined) profile.languages = data.languages;
  if (data.videoConsultEnabled !== undefined) {
    profile.videoConsultEnabled = data.videoConsultEnabled;
  }

  if (data.primarySpecialty !== undefined) {
    profile.primarySpecialty = data.primarySpecialty;
    profile.additionalSpecialties = (data.additionalSpecialties ??
      []) as string[];
    // Patient-visible specialties must be re-verified by an admin after a change.
    const claimed = new Set([
      data.primarySpecialty,
      ...(data.additionalSpecialties ?? []),
    ]);
    profile.specialties = (profile.specialties ?? []).filter((s) =>
      claimed.has(s as never),
    );
  }

  if (data.clinics !== undefined) {
    profile.set(
      "clinics",
      data.clinics.map((clinic) => ({
        name: clinic.name,
        city: clinic.city,
        area: resolveHospitalArea(clinic, profile.clinics),
        address: clinic.address,
        geo: clinic.geo
          ? {
              type: "Point" as const,
              coordinates: [clinic.geo.lng, clinic.geo.lat] as [number, number],
            }
          : undefined,
      })),
    );
    const cities = [...new Set(data.clinics.map((c) => c.city.trim()))];
    profile.coverageCities = cities;
  }

  if (data.weeklyAvailability !== undefined) {
    profile.set("weeklyAvailability", data.weeklyAvailability);
  }

  await profile.save();

  return getNutritionistProfile(userId);
}

/** Verification documents are private — only the owner and admins may fetch them. */
export async function canNutritionistAccessDocument(
  userId: string,
  roles: string[],
  storageKey: string,
): Promise<boolean> {
  if (roles.includes(Roles.ADMIN) || roles.includes(Roles.SUPER_ADMIN)) {
    return true;
  }

  await connectDatabase();
  const profile = await NutritionistProfileModel.findOne(
    mongoFilter({ userId }),
  ).lean();
  if (!profile) return false;

  const docs = profile.verificationDocuments ?? {};
  const urls = Object.values(docs).filter(Boolean) as string[];
  const encodedKey = encodeURIComponent(storageKey);
  return urls.some(
    (url) => url.includes(encodedKey) || url.includes(storageKey),
  );
}

export function isNutritionistProfileEditable(status: string): boolean {
  return status === VerificationStatuses.APPROVED;
}

/** Resolve the caller's NutritionistProfile id — used by dashboard/earnings endpoints. */
export async function getNutritionistProfileIdForUser(
  userId: string,
): Promise<string> {
  await connectDatabase();
  const profile = await NutritionistProfileModel.findOne(mongoFilter({ userId }))
    .select("_id")
    .lean();
  if (!profile) {
    throw new AppError("Nutritionist profile not found", "NOT_FOUND", 404);
  }
  return profile._id.toString();
}
