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
  VerificationStatuses,
  LAHORE_GEO,
  resolveDefaultWorkspace,
  type Role,
  emailLookupHash,
  phoneLookupHash,
} from "@zindagi/shared";
import type { AccountType, StaffAccountType } from "@zindagi/validators";
import { normalizePhoneDigits, toPakistaniLocalPhone } from "@zindagi/validators";
import { syncAdminRoleFromAllowlist } from "@/lib/auth/admin-allowlist";
import { normalizePakistaniPhone } from "@/lib/auth/phone";
import { mongoFilter } from "@/lib/mongo/query";

const BCRYPT_ROUNDS = 12;

async function ensurePatientProfile(
  userId: { toString(): string },
  referredByDoctorId?: string | null,
) {
  await PatientProfileModel.findOneAndUpdate(
    mongoFilter({ userId: userId.toString() }),
    {
      $setOnInsert: {
        userId,
        ...(referredByDoctorId
          ? { referredByDoctorId, referredAt: new Date() }
          : {}),
      },
    },
    { upsert: true },
  );
}

/** Doctors/nurses/physios can also use the patient dashboard on the same account. */
async function ensureClinicalStaffPatientAccess(
  userId: string,
  roles: Role[],
  opts: { phone?: string | null; onboardingCompleted?: boolean },
): Promise<{ roles: Role[]; onboardingCompleted: boolean }> {
  const isClinical =
    roles.includes(Roles.DOCTOR) ||
    roles.includes(Roles.NURSE) ||
    roles.includes(Roles.PHYSIOTHERAPIST) ||
    roles.includes(Roles.HERBALIST) ||
    roles.includes(Roles.NUTRITIONIST);

  if (!isClinical) {
    return {
      roles,
      onboardingCompleted: opts.onboardingCompleted ?? false,
    };
  }

  const needsPatientRole = !roles.includes(Roles.PATIENT);
  const canCompleteOnboarding =
    !(opts.onboardingCompleted ?? false) && Boolean(opts.phone);

  if (!needsPatientRole && !canCompleteOnboarding) {
    await ensurePatientProfile({ toString: () => userId });
    return {
      roles,
      onboardingCompleted: opts.onboardingCompleted ?? false,
    };
  }

  const user = await UserModel.findById(userId);
  if (!user) {
    return {
      roles,
      onboardingCompleted: opts.onboardingCompleted ?? false,
    };
  }

  if (!user.roles.includes(Roles.PATIENT)) {
    user.roles.push(Roles.PATIENT);
  }
  // Staff already collected phone at signup — don't force patient onboarding.
  if (!user.onboardingCompleted && user.phone) {
    user.onboardingCompleted = true;
  }
  await user.save();
  await ensurePatientProfile(user._id);

  return {
    roles: user.roles as Role[],
    onboardingCompleted: user.onboardingCompleted ?? false,
  };
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

async function ensurePhysiotherapistProfile(userId: { toString(): string }, city: string) {
  await StaffProfileModel.updateOne(
    { userId: userId.toString() } as Record<string, unknown>,
    {
      $set: {
        staffType: Roles.PHYSIOTHERAPIST,
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

async function ensureHerbalistProfile(userId: { toString(): string }, city: string) {
  const { HerbalistProfileModel } = await import("@zindagi/database");
  await HerbalistProfileModel.updateOne(
    { userId: userId.toString() } as Record<string, unknown>,
    {
      $setOnInsert: {
        verificationStatus: VerificationStatuses.PENDING,
        coverageCities: [city],
      },
    },
    { upsert: true },
  );
}

async function ensureNutritionistProfile(userId: { toString(): string }, city: string) {
  const { NutritionistProfileModel } = await import("@zindagi/database");
  await NutritionistProfileModel.updateOne(
    { userId: userId.toString() } as Record<string, unknown>,
    {
      $setOnInsert: {
        verificationStatus: VerificationStatuses.PENDING,
        coverageCities: [city],
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
  const phoneLocal = toPakistaniLocalPhone(normalizePhoneDigits(phone));

  return UserModel.findOne({
    $or: [
      { phoneLookup: phoneLookupHash(normalized) },
      { phoneLookup: phoneLookupHash(phoneLocal) },
    ],
  });
}

export async function findActiveUserByPhone(phone: string) {
  const user = await findUserByPhone(phone);
  if (!user || user.deletedAt || user.isActive === false) return null;
  if (user.bannedUntil && new Date(user.bannedUntil) > new Date()) return null;
  return user;
}

/** Sign in an existing user via phone OTP (passwordless recovery). */
export async function signInWithPhoneOtp(phone: string) {
  const user = await findActiveUserByPhone(phone);
  if (!user) return null;

  user.phoneVerified = new Date();
  if (!user.authProviders.includes("phone")) {
    user.authProviders.push("phone");
  }
  await user.save();
  await ensurePatientProfile(user._id);

  return loadAuthUserPayload(user._id.toString());
}

export async function registerWithCredentials(
  input: {
    name: string;
    email: string;
    password: string;
    phone: string;
    accountType?: AccountType;
    city: string;
    dateOfBirth: string;
  },
  referredByDoctorId?: string | null,
) {
  await connectDatabase();
  const accountType = input.accountType ?? "patient";
  const city = input.city.trim();
  const dateOfBirth = new Date(input.dateOfBirth);
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
    // Clinical staff can also book care as patients on the same account.
    doctor: [Roles.PATIENT, Roles.DOCTOR],
    nurse: [Roles.PATIENT, Roles.NURSE],
    physiotherapist: [Roles.PATIENT, Roles.PHYSIOTHERAPIST],
    herbalist: [Roles.PATIENT, Roles.HERBALIST],
    nutritionist: [Roles.PATIENT, Roles.NUTRITIONIST],
    lab: [Roles.PATIENT, Roles.LAB],
    other: [Roles.PATIENT, Roles.OTHER],
  };

  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
  const user = await UserModel.create({
    name: input.name,
    email,
    phone,
    passwordHash,
    dateOfBirth,
    roles: roleByAccountType[accountType],
    authProviders: ["credentials"],
    emailVerified: new Date(),
    // Staff already provide phone + city at signup; skip patient onboarding gate.
    onboardingCompleted: accountType !== "patient",
    isActive: true,
    metadata: { city, locale: "en" as const },
  });

  try {
    if (accountType === "patient") {
      await ensurePatientProfile(user._id, referredByDoctorId);
    } else if (accountType === "doctor") {
      await ensurePatientProfile(user._id, referredByDoctorId);
      await ensureDoctorProfile(user._id, city);
    } else if (accountType === "nurse") {
      await ensurePatientProfile(user._id, referredByDoctorId);
      await ensureNurseProfile(user._id, city);
    } else if (accountType === "physiotherapist") {
      await ensurePatientProfile(user._id, referredByDoctorId);
      await ensurePhysiotherapistProfile(user._id, city);
    } else if (accountType === "herbalist") {
      await ensurePatientProfile(user._id, referredByDoctorId);
      await ensureHerbalistProfile(user._id, city);
    } else if (accountType === "nutritionist") {
      await ensurePatientProfile(user._id, referredByDoctorId);
      await ensureNutritionistProfile(user._id, city);
    } else {
      // lab / other: no dedicated clinical profile yet — patient dashboard only.
      await ensurePatientProfile(user._id, referredByDoctorId);
    }
  } catch (error) {
    await UserModel.findByIdAndDelete(user._id);
    throw error;
  }

  return user;
}

const STAFF_ROLE_BY_ACCOUNT_TYPE: Record<StaffAccountType, Role> = {
  doctor: Roles.DOCTOR,
  nurse: Roles.NURSE,
  physiotherapist: Roles.PHYSIOTHERAPIST,
  herbalist: Roles.HERBALIST,
  nutritionist: Roles.NUTRITIONIST,
};

/** Add a staff role to an existing user (keeps patient and other roles). */
export async function addStaffRoleToUser(
  userId: string,
  accountType: StaffAccountType,
  city: string,
) {
  await connectDatabase();
  const user = await UserModel.findById(userId);
  if (!user) throw new AppError("User not found", "NOT_FOUND", 404);

  const role = STAFF_ROLE_BY_ACCOUNT_TYPE[accountType];
  if (user.roles.includes(role)) {
    throw new AppError("You already have this profile", "CONFLICT", 409);
  }

  const cityValue = city.trim() || user.metadata?.city || "Lahore";
  user.roles.push(role);
  user.metadata = {
    ...user.metadata,
    city: user.metadata?.city ?? cityValue,
    locale: user.metadata?.locale ?? "en",
  };
  await user.save();

  try {
    if (accountType === "doctor") {
      await ensureDoctorProfile(user._id, cityValue);
    } else if (accountType === "nurse") {
      await ensureNurseProfile(user._id, cityValue);
    } else {
      await ensurePhysiotherapistProfile(user._id, cityValue);
    }
  } catch (error) {
    user.roles = user.roles.filter((r) => r !== role);
    await user.save();
    throw error;
  }

  return loadAuthUserPayload(userId);
}

export async function findOrCreatePhoneUser(
  phone: string,
  name?: string,
  referredByDoctorId?: string | null,
) {
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
    await ensurePatientProfile(user._id, referredByDoctorId);
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

/**
 * Google is login-only: never creates an account. Looks up an existing user by
 * email and links the Google provider/id to it; returns null if no account exists.
 */
export async function findGoogleLoginUser(input: {
  email: string;
  googleId?: string | null;
  image?: string | null;
}) {
  await connectDatabase();
  const email = input.email.toLowerCase();
  const user = await UserModel.findOne({ emailLookup: emailLookupHash(email) }).select(
    "+googleId",
  );
  if (!user) return null;

  if (!user.authProviders.includes("google")) {
    user.authProviders.push("google");
  }
  if (input.googleId && !user.googleId) {
    user.googleId = input.googleId;
  }
  if (input.image && !user.avatarUrl) {
    user.avatarUrl = input.image;
  }
  user.emailVerified = user.emailVerified ?? new Date();
  await user.save();
  await ensurePatientProfile(user._id);

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

  const id = user._id.toString();
  let roles = (user.roles ?? [Roles.PATIENT]) as Role[];
  roles = await syncAdminRoleFromAllowlist(id, user.email, roles);

  const patientAccess = await ensureClinicalStaffPatientAccess(id, roles, {
    phone: user.phone,
    onboardingCompleted: user.onboardingCompleted ?? false,
  });
  roles = patientAccess.roles;
  const onboardingCompleted = patientAccess.onboardingCompleted;

  let doctorVerificationStatus: string | undefined;
  if (roles.includes(Roles.DOCTOR)) {
    const profile = await DoctorProfileModel.findOne(mongoFilter({ userId: user._id }))
      .select("verificationStatus isListed")
      .lean();
    doctorVerificationStatus = profile?.verificationStatus;
  }

  let nurseVerificationStatus: string | undefined;
  if (roles.includes(Roles.NURSE)) {
    const staff = await StaffProfileModel.findOne(
      mongoFilter({ userId: user._id, staffType: Roles.NURSE }),
    )
      .select("verificationStatus")
      .lean();
    nurseVerificationStatus = staff?.verificationStatus;
  }

  let physiotherapistVerificationStatus: string | undefined;
  if (roles.includes(Roles.PHYSIOTHERAPIST)) {
    const staff = await StaffProfileModel.findOne(
      mongoFilter({ userId: user._id, staffType: Roles.PHYSIOTHERAPIST }),
    )
      .select("verificationStatus")
      .lean();
    physiotherapistVerificationStatus = staff?.verificationStatus;
  }

  let herbalistVerificationStatus: string | undefined;
  if (roles.includes(Roles.HERBALIST)) {
    const { HerbalistProfileModel } = await import("@zindagi/database");
    const profile = await HerbalistProfileModel.findOne(
      mongoFilter({ userId: user._id }),
    )
      .select("verificationStatus")
      .lean();
    herbalistVerificationStatus = profile?.verificationStatus;
  }

  let nutritionistVerificationStatus: string | undefined;
  if (roles.includes(Roles.NUTRITIONIST)) {
    const { NutritionistProfileModel } = await import("@zindagi/database");
    const profile = await NutritionistProfileModel.findOne(
      mongoFilter({ userId: user._id }),
    )
      .select("verificationStatus")
      .lean();
    nutritionistVerificationStatus = profile?.verificationStatus;
  }

  return {
    id,
    email: user.email ?? undefined,
    name: user.name,
    image: user.avatarUrl ?? undefined,
    roles,
    activeWorkspace: resolveDefaultWorkspace(roles),
    onboardingCompleted,
    hasPhone: Boolean(user.phone),
    doctorVerificationStatus,
    nurseVerificationStatus,
    physiotherapistVerificationStatus,
    herbalistVerificationStatus,
    nutritionistVerificationStatus,
  };
}

/** Refresh roles for an existing session without resetting activeWorkspace. */
export async function syncSessionRoles(userId: string) {
  const payload = await loadAuthUserPayload(userId);
  if (!payload) return null;
  return {
    roles: payload.roles,
    onboardingCompleted: payload.onboardingCompleted,
    hasPhone: payload.hasPhone,
    doctorVerificationStatus: payload.doctorVerificationStatus,
    nurseVerificationStatus: payload.nurseVerificationStatus,
    physiotherapistVerificationStatus: payload.physiotherapistVerificationStatus,
    herbalistVerificationStatus: payload.herbalistVerificationStatus,
    nutritionistVerificationStatus: payload.nutritionistVerificationStatus,
  };
}

export async function completeOnboarding(
  userId: string,
  data: {
    city: string;
    locale: "en" | "ur";
    dateOfBirth?: string;
    gender?: "male" | "female" | "other";
    phone?: string;
  },
) {
  await connectDatabase();
  const user = await UserModel.findById(userId);
  if (!user) throw new AppError("User not found", "NOT_FOUND", 404);

  if (!user.roles.includes(Roles.PATIENT)) {
    throw new AppError("Onboarding is only for patient accounts", "FORBIDDEN", 403);
  }

  if (data.phone) {
    const phone = normalizePakistaniPhone(data.phone);
    const phoneLocal = toPakistaniLocalPhone(normalizePhoneDigits(data.phone));
    const existingByPhone = await UserModel.findOne({
      _id: { $ne: user._id },
      $or: [
        { phoneLookup: phoneLookupHash(phone) },
        { phoneLookup: phoneLookupHash(phoneLocal) },
      ],
    });
    if (existingByPhone) {
      throw new AppError(
        "This mobile number is already registered",
        "CONFLICT",
        409,
        "phone",
      );
    }
    user.phone = phone;
  }

  if (!user.phone) {
    throw new AppError(
      "WhatsApp number is required",
      "VALIDATION",
      400,
      "phone",
    );
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
