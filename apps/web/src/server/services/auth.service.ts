import bcrypt from "bcryptjs";
import { createHash } from "crypto";
import {
  connectDatabase,
  DoctorProfileModel,
  PatientProfileModel,
  StaffProfileModel,
  UserModel,
} from "@zindagi/database";
import {
  AppError,
  Roles,
  STAFF_ROLES,
  VerificationStatuses,
  LAHORE_GEO,
  type Role,
  emailLookupHash,
  phoneLookupHash,
} from "@zindagi/shared";
import type { AccountType } from "@zindagi/validators";
import { normalizePhoneDigits, toPakistaniLocalPhone } from "@zindagi/validators";
import { normalizePakistaniPhone } from "@/lib/auth/phone";
import { mongoFilter } from "@/lib/mongo/query";

const BCRYPT_ROUNDS = 12;

async function ensurePatientProfile(userId: { toString(): string }) {
  await PatientProfileModel.findOneAndUpdate(
    mongoFilter({ userId: userId.toString() }),
    { $setOnInsert: { userId } },
    { upsert: true },
  );
}

async function ensureDoctorProfile(userId: { toString(): string }, city: string) {
  await DoctorProfileModel.findOneAndUpdate(
    mongoFilter({ userId: userId.toString() }),
    {
      verificationStatus: VerificationStatuses.PENDING,
      isListed: false,
      coverageCities: [city],
    },
    { upsert: true },
  );
}

async function ensureNurseProfile(userId: { toString(): string }, city: string) {
  await StaffProfileModel.updateOne(
    { userId: userId.toString() } as Record<string, unknown>,
    {
      $set: {
        staffType: Roles.NURSE,
        isAvailable: true,
        verificationStatus: VerificationStatuses.PENDING,
        serviceAreas: [
          {
            city,
            geo: {
              type: "Point",
              coordinates: [LAHORE_GEO.lng, LAHORE_GEO.lat],
            },
            radiusKm: 15,
          },
        ],
      },
    },
    { upsert: true },
  );
}

export function hashCnic(cnic: string): string {
  return createHash("sha256").update(cnic.replace(/-/g, "")).digest("hex");
}

export function cnicLast4(cnic: string): string {
  const digits = cnic.replace(/\D/g, "");
  return digits.slice(-4);
}

export async function findUserByEmail(email: string) {
  await connectDatabase();
  const normalized = email.trim().toLowerCase();
  const doc = await UserModel.findOne({ emailLookup: emailLookupHash(normalized) })
    .select("+passwordHash +emailLookup bannedUntil isActive deletedAt")
    .exec();
  if (!doc || doc.deletedAt || doc.isActive === false) return null;
  return {
    _id: doc._id,
    passwordHash: doc.passwordHash,
    bannedUntil: doc.bannedUntil,
  };
}

/** Email/password sign-in for Auth.js credentials provider. */
export async function verifyCredentialsLogin(email: string, password: string) {
  const user = await findUserByEmail(email);
  if (!user?.passwordHash) return null;

  if (user.bannedUntil && new Date(user.bannedUntil) > new Date()) {
    return null;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return null;

  return loadAuthUserPayload(String(user._id));
}

export async function findUserByPhone(phone: string) {
  await connectDatabase();
  const normalized = normalizePakistaniPhone(phone);
  return UserModel.findOne({ phoneLookup: phoneLookupHash(normalized) });
}

export async function registerWithCredentials(input: {
  name: string;
  email: string;
  password: string;
  phone: string;
  accountType?: AccountType;
  city?: string;
}) {
  await connectDatabase();
  const accountType = input.accountType ?? "patient";
  const city = input.city?.trim() || "Lahore";
  const email = input.email.toLowerCase();
  const phone = normalizePakistaniPhone(input.phone);
  const phoneLocal = toPakistaniLocalPhone(normalizePhoneDigits(input.phone));

  const existingByEmail = await UserModel.findOne({
    emailLookup: emailLookupHash(email),
  });
  if (existingByEmail) {
    throw new AppError("Account already exists", "CONFLICT", 409, "email");
  }

  const existingByPhone = await UserModel.findOne({
    $or: [
      { phoneLookup: phoneLookupHash(phone) },
      { phoneLookup: phoneLookupHash(phoneLocal) },
    ],
  });
  if (existingByPhone) {
    throw new AppError("Account already exists", "CONFLICT", 409, "phone");
  }

  const roleByAccountType: Record<AccountType, Role[]> = {
    patient: [Roles.PATIENT],
    doctor: [Roles.DOCTOR],
    nurse: [Roles.NURSE],
  };

  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
  const user = await UserModel.create({
    name: input.name,
    email,
    phone,
    passwordHash,
    roles: roleByAccountType[accountType],
    authProviders: ["credentials"],
    emailVerified: new Date(),
    onboardingCompleted: false,
    isActive: true,
    ...(accountType !== "patient"
      ? { metadata: { city, locale: "en" as const } }
      : {}),
  });

  try {
    if (accountType === "patient") {
      await ensurePatientProfile(user._id);
    } else if (accountType === "doctor") {
      await ensureDoctorProfile(user._id, city);
    } else {
      await ensureNurseProfile(user._id, city);
    }
  } catch (error) {
    await UserModel.findByIdAndDelete(user._id);
    throw error;
  }

  return user;
}

export async function findOrCreatePhoneUser(phone: string, name?: string) {
  await connectDatabase();
  const normalized = normalizePakistaniPhone(phone);
  let user = await UserModel.findOne({ phoneLookup: phoneLookupHash(normalized) });

  if (!user) {
    user = await UserModel.create({
      name: name ?? `User ${normalized.slice(-4)}`,
      phone: normalized,
      roles: [Roles.PATIENT],
      authProviders: ["phone"],
      phoneVerified: new Date(),
      onboardingCompleted: false,
    });
    await ensurePatientProfile(user._id);
  } else {
    user.phoneVerified = new Date();
    if (!user.authProviders.includes("phone")) {
      user.authProviders.push("phone");
    }
    await user.save();
    await ensurePatientProfile(user._id);
  }

  return user;
}

export async function findOrCreateGoogleUser(input: {
  email: string;
  name: string;
  image?: string | null;
}) {
  await connectDatabase();
  const email = input.email.toLowerCase();
  let user = await UserModel.findOne({ emailLookup: emailLookupHash(email) });

  if (!user) {
    user = await UserModel.create({
      name: input.name,
      email,
      avatarUrl: input.image ?? undefined,
      roles: [Roles.PATIENT],
      authProviders: ["google"],
      emailVerified: new Date(),
      onboardingCompleted: false,
    });
    await ensurePatientProfile(user._id);
  } else {
    if (!user.authProviders.includes("google")) {
      user.authProviders.push("google");
    }
    if (input.image && !user.avatarUrl) {
      user.avatarUrl = input.image;
    }
    user.emailVerified = user.emailVerified ?? new Date();
    await user.save();
    await ensurePatientProfile(user._id);
  }

  return user;
}

export async function loadAuthUserPayload(userId: string) {
  await connectDatabase();
  const user = await UserModel.findById(userId).lean();
  // Treat missing isActive as true (legacy docs may omit the field).
  if (!user || user.deletedAt || user.isActive === false) {
    return null;
  }

  if (user.bannedUntil && new Date(user.bannedUntil) > new Date()) {
    return null;
  }

  let doctorVerificationStatus: string | undefined;
  if (user.roles?.includes(Roles.DOCTOR)) {
    const profile = await DoctorProfileModel.findOne(mongoFilter({ userId: user._id }))
      .select("verificationStatus isListed")
      .lean();
    doctorVerificationStatus = profile?.verificationStatus;
  }

  let nurseVerificationStatus: string | undefined;
  if (user.roles?.includes(Roles.NURSE)) {
    const staff = await StaffProfileModel.findOne(
      mongoFilter({ userId: user._id, staffType: Roles.NURSE }),
    )
      .select("verificationStatus")
      .lean();
    nurseVerificationStatus = staff?.verificationStatus;
  }

  return {
    id: user._id.toString(),
    email: user.email ?? undefined,
    name: user.name,
    roles: (user.roles ?? [Roles.PATIENT]) as Role[],
    onboardingCompleted: user.onboardingCompleted ?? false,
    doctorVerificationStatus,
    nurseVerificationStatus,
  };
}

export async function completeOnboarding(
  userId: string,
  data: {
    city: string;
    locale: "en" | "ur";
    dateOfBirth?: string;
    gender?: "male" | "female" | "other";
  },
) {
  await connectDatabase();
  const user = await UserModel.findById(userId);
  if (!user) throw new AppError("User not found", "NOT_FOUND", 404);

  if (!user.roles.includes(Roles.PATIENT) || STAFF_ROLES.some((role) => user.roles.includes(role))) {
    throw new AppError("Onboarding is only for patient accounts", "FORBIDDEN", 403);
  }

  user.metadata = {
    ...user.metadata,
    city: data.city,
    locale: data.locale,
  };
  user.onboardingCompleted = true;

  await user.save();

  await PatientProfileModel.findOneAndUpdate(
    mongoFilter({ userId: user._id }),
    {
      defaultCity: data.city,
      ...(data.dateOfBirth ? { dateOfBirth: new Date(data.dateOfBirth) } : {}),
      ...(data.gender ? { gender: data.gender } : {}),
    },
    { upsert: true },
  );

  return loadAuthUserPayload(userId);
}
