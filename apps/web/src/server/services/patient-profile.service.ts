import {
  connectDatabase,
  PatientProfileModel,
  UserModel,
} from "@zindagi/database";
import { AppError, emailLookupHash, phoneLookupHash } from "@zindagi/shared";
import {
  normalizePhoneDigits,
  toPakistaniLocalPhone,
  type UpdatePatientProfileInput,
} from "@zindagi/validators";
import { normalizePhone } from "@/lib/auth/phone";
import { mongoFilter } from "@/lib/mongo/query";
import {
  formatPhoneForDisplay,
  mapUserPii,
  safeDisplayText,
} from "@/server/lib/decrypt-pii";
import {
  cacheKey,
  cached,
  invalidateCacheTags,
  patientCacheTag,
  patientCacheTags,
} from "@/server/lib/cache";

export type PatientProfileDto = {
  user: {
    id: string;
    name: string;
    email?: string;
    phone?: string;
    avatarUrl?: string;
    emailVerified: boolean;
    phoneVerified: boolean;
    locale: "en" | "ur";
    city: string;
    memberSince: string;
  };
  profile: {
    dateOfBirth?: string;
    gender?: "male" | "female" | "other";
    bloodGroup?: string;
    allergies: string[];
    chronicConditions: string[];
    emergencyContact?: {
      name?: string;
      phone?: string;
      relation?: string;
    };
  };
};

function formatDateForInput(date?: Date | null): string | undefined {
  if (!date) return undefined;
  return date.toISOString().slice(0, 10);
}

export async function getPatientProfile(userId: string): Promise<PatientProfileDto> {
  return cached(
    cacheKey("patient-profile", userId),
    { ttl: 300, tags: patientCacheTags(userId), sensitive: true },
    () => loadPatientProfile(userId),
  );
}

async function loadPatientProfile(userId: string): Promise<PatientProfileDto> {
  await connectDatabase();

  const user = await UserModel.findById(userId).lean();
  if (!user || user.deletedAt || user.isActive === false) {
    throw new AppError("User not found", "NOT_FOUND", 404);
  }

  const profile = await PatientProfileModel.findOne(
    mongoFilter({ userId: user._id }),
  ).lean();

  const pii = mapUserPii(user);

  return {
    user: {
      id: user._id.toString(),
      name: pii.name,
      email: pii.email,
      phone: pii.phone,
      avatarUrl: user.avatarUrl ?? undefined,
      emailVerified: Boolean(user.emailVerified),
      phoneVerified: Boolean(user.phoneVerified),
      locale: (user.metadata?.locale as "en" | "ur") ?? "en",
      city: user.metadata?.city ?? profile?.defaultCity ?? "Lahore",
      memberSince: user.createdAt?.toISOString() ?? new Date().toISOString(),
    },
    profile: {
      dateOfBirth: formatDateForInput(profile?.dateOfBirth),
      gender: profile?.gender ?? undefined,
      bloodGroup: profile?.bloodGroup ?? undefined,
      allergies: profile?.allergies ?? [],
      chronicConditions: profile?.chronicConditions ?? [],
      emergencyContact: profile?.emergencyContact
        ? {
            name: safeDisplayText(profile.emergencyContact.name),
            phone: formatPhoneForDisplay(profile.emergencyContact.phone),
            relation: safeDisplayText(profile.emergencyContact.relation),
          }
        : undefined,
    },
  };
}

export async function updatePatientProfile(
  userId: string,
  data: UpdatePatientProfileInput,
): Promise<PatientProfileDto> {
  await connectDatabase();

  const user = await UserModel.findById(userId);
  if (!user || user.deletedAt || user.isActive === false) {
    throw new AppError("User not found", "NOT_FOUND", 404);
  }

  if (data.email !== undefined) {
    const email = data.email.toLowerCase();
    if (email !== user.email) {
      const existing = await UserModel.findOne({
        emailLookup: emailLookupHash(email),
        _id: { $ne: user._id },
      });
      if (existing) {
        throw new AppError("Email already in use", "CONFLICT", 409, "email");
      }
      user.email = email;
    }
  }

  if (data.phone !== undefined) {
    const normalized = normalizePhone(data.phone);
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

  if (data.name !== undefined) {
    user.name = data.name.trim();
  }

  if (data.city !== undefined || data.locale !== undefined) {
    user.metadata = {
      locale: data.locale ?? user.metadata?.locale ?? "en",
      city: data.city ?? user.metadata?.city ?? "Lahore",
    };
  }

  await user.save();

  const profileUpdate: Record<string, unknown> = {};
  if (data.city !== undefined) {
    profileUpdate.defaultCity = data.city;
  }
  if (data.dateOfBirth !== undefined) {
    profileUpdate.dateOfBirth = data.dateOfBirth ? new Date(data.dateOfBirth) : null;
  }
  if (data.gender !== undefined) {
    profileUpdate.gender = data.gender;
  }
  if (data.bloodGroup !== undefined) {
    profileUpdate.bloodGroup = data.bloodGroup;
  }
  if (data.allergies !== undefined) {
    profileUpdate.allergies = data.allergies;
  }
  if (data.chronicConditions !== undefined) {
    profileUpdate.chronicConditions = data.chronicConditions;
  }
  if (data.emergencyContact !== undefined) {
    profileUpdate.emergencyContact = data.emergencyContact;
  }

  if (Object.keys(profileUpdate).length > 0) {
    await PatientProfileModel.findOneAndUpdate(
      mongoFilter({ userId: user._id }),
      { $set: profileUpdate },
      { upsert: true },
    );
  }

  // Don't read back through a cache entry the write hook hasn't cleared yet.
  await invalidateCacheTags([patientCacheTag(userId)]);
  return getPatientProfile(userId);
}
