import bcrypt from "bcryptjs";
import {
  AppointmentModel,
  connectDatabase,
  HerbalistProfileModel,
  UserModel,
  type HerbalistProfileDocument,
} from "@zindagi/database";
import {
  AppError,
  AppointmentStatuses,
  Roles,
  VerificationStatuses,
  emailLookupHash,
  normalizeAdditionalSpecialties,
} from "@zindagi/shared";
import type {
  AdminCreateHerbalistInput,
  AdminUpdateHerbalistInput,
} from "@zindagi/validators";
import type { HydratedDocument } from "mongoose";
import { normalizePakistaniPhone } from "@/lib/auth/phone";
import { resolveHospitalArea } from "@/lib/doctors/hospital-area";
import { mongoFilter, mongoObjectIds } from "@/lib/mongo/query";
import { mapUserPii } from "@/server/lib/decrypt-pii";
import { HERBALIST_PROVIDER_ROLE } from "./herbalist-dashboard.service";
import {
  mapHerbalistDocuments,
  type HerbalistProfileDto,
} from "./herbalist-profile.service";
import { generateUniqueHerbalistSlug } from "./herbalist-slug.service";
import {
  deleteHerbalistAvatar,
  herbalistAvatarStorageKeyFromUrl,
  isHerbalistAvatarUrlForUser,
} from "./herbalist-avatar.storage";
import { resolveHerbalistSlug } from "@/lib/herbalists/profile-path";

export type AdminHerbalistRow = {
  id: string;
  userId: string;
  name: string;
  email?: string;
  phone?: string;
  avatarUrl?: string;
  slug?: string;
  licenseNumber?: string;
  primarySpecialty?: string;
  specialties: string[];
  experienceYears: number;
  consultationFee: number;
  city?: string;
  verificationStatus: string;
  verificationSubmittedAt?: string;
  verifiedAt?: string;
  rejectionReason?: string;
  isListed: boolean;
  isActive: boolean;
  videoConsultEnabled: boolean;
  onlineCommissionPercent: number | null;
  ratingAvg: number;
  ratingCount: number;
  completedConsults: number;
  createdAt: string;
};

export type AdminHerbalistDetail = AdminHerbalistRow & {
  degree?: string;
  qualifications: string[];
  institute?: string;
  graduationYear?: number;
  cnicLast4?: string;
  bio?: string;
  languages: string[];
  additionalSpecialties: string[];
  clinics: { name: string; city: string; area?: string; address?: string }[];
  coverageCities: string[];
  weeklyAvailability: {
    dayOfWeek: number;
    startTimeLocal: string;
    endTimeLocal: string;
  }[];
  platformAgreementAcceptedAt?: string;
  documents: { key: string; label: string; url: string }[];
};

type LeanHerbalistProfile = Record<string, never>;

async function loadProfileWithUser(profileId: string) {
  await connectDatabase();
  const profile = await HerbalistProfileModel.findById(profileId).lean();
  if (!profile || profile.deletedAt) {
    throw new AppError("Herbalist not found", "NOT_FOUND", 404);
  }
  const user = await UserModel.findById(profile.userId).lean();
  if (!user) throw new AppError("User not found", "NOT_FOUND", 404);
  return { profile, user };
}

function mapRow(
  profile: Awaited<ReturnType<typeof loadProfileWithUser>>["profile"],
  user: Awaited<ReturnType<typeof loadProfileWithUser>>["user"],
  completedConsults = 0,
): AdminHerbalistRow {
  const pii = mapUserPii(user);
  const name = pii.name ?? "Herbalist";
  return {
    id: profile._id.toString(),
    userId: user._id.toString(),
    name,
    email: pii.email,
    phone: pii.phone,
    avatarUrl: user.avatarUrl ?? undefined,
    slug: resolveHerbalistSlug(profile.slug, name),
    licenseNumber: profile.licenseNumber ?? undefined,
    primarySpecialty: profile.primarySpecialty ?? undefined,
    specialties: profile.specialties ?? [],
    experienceYears: profile.experienceYears ?? 0,
    consultationFee: profile.consultationFee ?? 0,
    city: profile.clinics?.[0]?.city ?? profile.coverageCities?.[0],
    verificationStatus:
      profile.verificationStatus ?? VerificationStatuses.PENDING,
    verificationSubmittedAt: profile.verificationSubmittedAt?.toISOString(),
    verifiedAt: profile.verifiedAt?.toISOString(),
    rejectionReason: profile.rejectionReason ?? undefined,
    isListed: profile.isListed ?? false,
    isActive: user.isActive !== false,
    videoConsultEnabled: profile.videoConsultEnabled ?? false,
    onlineCommissionPercent: profile.onlineCommissionPercent ?? null,
    ratingAvg: profile.ratingAvg ?? 0,
    ratingCount: profile.ratingCount ?? 0,
    completedConsults,
    createdAt: profile.createdAt?.toISOString() ?? new Date().toISOString(),
  };
}

/** Admin: list every herbalist, optionally filtered by a free-text search. */
export async function listAllHerbalists(
  search?: string,
  status?: string,
): Promise<AdminHerbalistRow[]> {
  await connectDatabase();

  const filter: Record<string, unknown> = {
    $or: [{ deletedAt: { $exists: false } }, { deletedAt: null }],
  };
  if (status) filter.verificationStatus = status;

  const profiles = await HerbalistProfileModel.find(mongoFilter(filter))
    .sort({ verificationSubmittedAt: -1, createdAt: -1 })
    .lean();

  const userIds = profiles
    .map((p) => p.userId?.toString())
    .filter((id): id is string => Boolean(id));
  const users = userIds.length
    ? await UserModel.find(mongoFilter({ _id: { $in: mongoObjectIds(userIds) } }))
        .select("name email phone avatarUrl isActive")
        .lean()
    : [];
  const userById = new Map(users.map((u) => [u._id.toString(), u]));

  const profileIds = profiles.map((p) => p._id.toString());
  const completedByProfile = new Map<string, number>();
  if (profileIds.length) {
    const completed = await AppointmentModel.find(
      mongoFilter({
        providerRole: HERBALIST_PROVIDER_ROLE,
        providerProfileId: { $in: mongoObjectIds(profileIds) },
        status: AppointmentStatuses.COMPLETED,
      }),
    )
      .select("providerProfileId")
      .lean();
    for (const appointment of completed as Array<{
      providerProfileId?: { toString(): string };
    }>) {
      const key = appointment.providerProfileId?.toString();
      if (!key) continue;
      completedByProfile.set(key, (completedByProfile.get(key) ?? 0) + 1);
    }
  }

  const rows = profiles
    .map((profile) => {
      const user = userById.get(profile.userId?.toString() ?? "");
      if (!user) return null;
      return mapRow(
        profile,
        user,
        completedByProfile.get(profile._id.toString()) ?? 0,
      );
    })
    .filter((row): row is AdminHerbalistRow => Boolean(row));

  const term = search?.trim().toLowerCase();
  if (!term) return rows;

  return rows.filter((row) =>
    [
      row.name,
      row.email,
      row.phone,
      row.licenseNumber,
      row.primarySpecialty,
      ...row.specialties,
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(term)),
  );
}

/** Admin: full detail for the review / manage screens. */
export async function getHerbalistDetailForAdmin(
  profileId: string,
): Promise<AdminHerbalistDetail> {
  const { profile, user } = await loadProfileWithUser(profileId);

  const completedConsults = await AppointmentModel.countDocuments(
    mongoFilter({
      providerRole: HERBALIST_PROVIDER_ROLE,
      providerProfileId: profile._id.toString(),
      status: AppointmentStatuses.COMPLETED,
    }),
  );

  return {
    ...mapRow(profile, user, completedConsults),
    degree: profile.degree ?? undefined,
    qualifications: profile.qualifications ?? [],
    institute: profile.institute ?? undefined,
    graduationYear: profile.graduationYear ?? undefined,
    cnicLast4: profile.cnicLast4 ?? undefined,
    bio: profile.bio ?? undefined,
    languages: profile.languages ?? [],
    additionalSpecialties: profile.additionalSpecialties ?? [],
    clinics: (profile.clinics ?? []).map((clinic) => ({
      name: clinic.name,
      city: clinic.city,
      area: clinic.area ?? undefined,
      address: clinic.address ?? undefined,
    })),
    coverageCities: profile.coverageCities ?? [],
    weeklyAvailability: (profile.weeklyAvailability ?? []).map((slot) => ({
      dayOfWeek: slot.dayOfWeek,
      startTimeLocal: slot.startTimeLocal,
      endTimeLocal: slot.endTimeLocal,
    })),
    platformAgreementAcceptedAt:
      profile.platformAgreementAcceptedAt?.toISOString(),
    documents: mapHerbalistDocuments(
      profile.verificationDocuments as Record<string, string | undefined>,
    ),
  };
}

export async function adminCreateHerbalist(
  input: AdminCreateHerbalistInput,
): Promise<AdminHerbalistDetail> {
  await connectDatabase();

  const email = input.email.trim().toLowerCase();
  const existing = await UserModel.findOne({ emailLookup: emailLookupHash(email) });
  if (existing) {
    throw new AppError("A user with this email already exists", "CONFLICT", 409);
  }

  const password = input.password ?? Math.random().toString(36).slice(-12);
  const user = await UserModel.create({
    name: input.name.trim(),
    email,
    phone: input.phone ? normalizePakistaniPhone(input.phone) : undefined,
    passwordHash: await bcrypt.hash(password, 10),
    roles: [Roles.HERBALIST],
    onboardingCompleted: true,
    emailVerified: new Date(),
  });

  const [primary, ...additional] = input.specialties;
  const profile = (await HerbalistProfileModel.create({
    userId: user._id,
    licenseNumber: input.licenseNumber,
    primarySpecialty: primary,
    additionalSpecialties: normalizeAdditionalSpecialties(primary!, additional),
    // Admin-created accounts are verified by construction.
    specialties: input.specialties,
    verificationStatus: VerificationStatuses.APPROVED,
    licenseVerified: true,
    isListed: true,
    videoConsultEnabled: true,
    verifiedAt: new Date(),
    consultationFee: 2500,
    coverageCities: [input.city.trim()],
  } as Record<string, unknown>)) as HerbalistProfileDocument;

  const slug = await generateUniqueHerbalistSlug(
    user.name,
    profile._id.toString(),
  );
  await HerbalistProfileModel.findByIdAndUpdate(profile._id, { $set: { slug } });

  return getHerbalistDetailForAdmin(profile._id.toString());
}

export async function adminUpdateHerbalist(
  adminUserId: string,
  profileId: string,
  data: AdminUpdateHerbalistInput,
): Promise<AdminHerbalistDetail> {
  await connectDatabase();

  const profile = (await HerbalistProfileModel.findById(
    profileId,
  )) as HydratedDocument<HerbalistProfileDocument> | null;
  if (!profile || profile.deletedAt) {
    throw new AppError("Herbalist not found", "NOT_FOUND", 404);
  }

  const user = await UserModel.findById(profile.userId);
  if (!user) throw new AppError("User not found", "NOT_FOUND", 404);

  if (data.name !== undefined) user.name = data.name.trim();
  if (data.phone !== undefined) user.phone = normalizePakistaniPhone(data.phone);
  let previousAvatarUrl: string | undefined;
  if (data.avatarUrl !== undefined) {
    if (!isHerbalistAvatarUrlForUser(user._id.toString(), data.avatarUrl)) {
      throw new AppError("Invalid profile photo", "VALIDATION_ERROR", 400);
    }
    if (user.avatarUrl && user.avatarUrl !== data.avatarUrl) {
      previousAvatarUrl = user.avatarUrl;
    }
    user.avatarUrl = data.avatarUrl;
  }
  if (data.isActive !== undefined) user.isActive = data.isActive;
  await user.save();
  if (previousAvatarUrl) {
    const previousKey = herbalistAvatarStorageKeyFromUrl(previousAvatarUrl);
    if (previousKey) {
      try {
        await deleteHerbalistAvatar(previousKey);
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
  if (data.isListed !== undefined) profile.isListed = data.isListed;
  if (data.onlineCommissionPercent !== undefined) {
    profile.onlineCommissionPercent = data.onlineCommissionPercent;
  }
  if (data.licenseNumber !== undefined) profile.licenseNumber = data.licenseNumber;
  if (data.degree !== undefined) profile.degree = data.degree;
  if (data.qualifications !== undefined) {
    profile.qualifications = data.qualifications;
  }
  if (data.institute !== undefined) profile.institute = data.institute;
  if (data.graduationYear !== undefined) {
    profile.graduationYear = data.graduationYear;
  }
  if (data.experienceYears !== undefined) {
    profile.experienceYears = data.experienceYears;
  }

  if (data.primarySpecialty !== undefined) {
    profile.primarySpecialty = data.primarySpecialty;
    profile.additionalSpecialties = (data.additionalSpecialties ??
      []) as string[];
  }
  if (data.verifiedSpecialties !== undefined) {
    const claimed = new Set([
      profile.primarySpecialty,
      ...(profile.additionalSpecialties ?? []),
    ]);
    profile.specialties = data.verifiedSpecialties.filter((s) =>
      claimed.has(s),
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

  if (data.verificationStatus !== undefined) {
    profile.verificationStatus =
      data.verificationStatus as HerbalistProfileDocument["verificationStatus"];
    if (data.verificationStatus === VerificationStatuses.APPROVED) {
      profile.licenseVerified = true;
      profile.verifiedAt = new Date();
      profile.verifiedBy =
        adminUserId as unknown as HerbalistProfileDocument["verifiedBy"];
      profile.rejectionReason = undefined;
      if (!profile.slug) {
        profile.slug = await generateUniqueHerbalistSlug(
          user.name,
          profile._id.toString(),
        );
      }
    } else {
      // Rejected / restricted herbalists must not stay listed or bookable.
      profile.isListed = false;
      profile.videoConsultEnabled = false;
      if (data.rejectionReason) profile.rejectionReason = data.rejectionReason;
    }
  } else if (data.rejectionReason !== undefined) {
    profile.rejectionReason = data.rejectionReason;
  }

  await profile.save();

  return getHerbalistDetailForAdmin(profileId);
}

/** Soft-delete: keeps history but removes the herbalist from every listing. */
export async function adminDeleteHerbalist(profileId: string): Promise<void> {
  await connectDatabase();
  const profile = await HerbalistProfileModel.findById(profileId);
  if (!profile) throw new AppError("Herbalist not found", "NOT_FOUND", 404);

  profile.deletedAt = new Date();
  profile.isListed = false;
  profile.videoConsultEnabled = false;
  await profile.save();

  await UserModel.findByIdAndUpdate(profile.userId, { isActive: false });
}

export type { HerbalistProfileDto, LeanHerbalistProfile };
