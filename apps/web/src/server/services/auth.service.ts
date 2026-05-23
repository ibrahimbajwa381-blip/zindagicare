import bcrypt from "bcryptjs";
import { createHash } from "crypto";
import {
  connectDatabase,
  DoctorProfileModel,
  PatientProfileModel,
  UserModel,
} from "@zindagi/database";
import { AppError, Roles, VerificationStatuses, type Role } from "@zindagi/shared";
import { normalizePakistaniPhone } from "@/lib/auth/phone";

const BCRYPT_ROUNDS = 12;

export function hashCnic(cnic: string): string {
  return createHash("sha256").update(cnic.replace(/-/g, "")).digest("hex");
}

export function cnicLast4(cnic: string): string {
  const digits = cnic.replace(/\D/g, "");
  return digits.slice(-4);
}

export async function findUserByEmail(email: string) {
  await connectDatabase();
  return UserModel.findOne({ email: email.toLowerCase() })
    .select("+passwordHash")
    .lean<{ passwordHash?: string; bannedUntil?: Date; _id: { toString(): string } }>();
}

export async function findUserByPhone(phone: string) {
  await connectDatabase();
  const normalized = normalizePakistaniPhone(phone);
  return UserModel.findOne({ phone: normalized });
}

export async function registerWithCredentials(input: {
  name: string;
  email: string;
  password: string;
  phone: string;
}) {
  await connectDatabase();
  const email = input.email.toLowerCase();
  const phone = normalizePakistaniPhone(input.phone);

  const existing = await UserModel.findOne({
    $or: [{ email }, { phone }],
  });
  if (existing) {
    throw new AppError("Account already exists", "CONFLICT", 409);
  }

  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
  const user = await UserModel.create({
    name: input.name,
    email,
    phone,
    passwordHash,
    roles: [Roles.PATIENT],
    authProviders: ["credentials"],
    emailVerified: new Date(),
    onboardingCompleted: false,
    isActive: true,
  });

  await PatientProfileModel.create({ userId: user._id });

  return user;
}

export async function findOrCreatePhoneUser(phone: string, name?: string) {
  await connectDatabase();
  const normalized = normalizePakistaniPhone(phone);
  let user = await UserModel.findOne({ phone: normalized });

  if (!user) {
    user = await UserModel.create({
      name: name ?? `User ${normalized.slice(-4)}`,
      phone: normalized,
      roles: [Roles.PATIENT],
      authProviders: ["phone"],
      phoneVerified: new Date(),
      onboardingCompleted: false,
    });
    await PatientProfileModel.create({ userId: user._id });
  } else {
    user.phoneVerified = new Date();
    if (!user.authProviders.includes("phone")) {
      user.authProviders.push("phone");
    }
    await user.save();
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
  let user = await UserModel.findOne({ email });

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
    await PatientProfileModel.create({ userId: user._id });
  } else {
    if (!user.authProviders.includes("google")) {
      user.authProviders.push("google");
    }
    if (input.image && !user.avatarUrl) {
      user.avatarUrl = input.image;
    }
    user.emailVerified = user.emailVerified ?? new Date();
    await user.save();
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
    const profile = await DoctorProfileModel.findOne({ userId: user._id })
      .select("verificationStatus isListed")
      .lean();
    doctorVerificationStatus = profile?.verificationStatus;
  }

  return {
    id: user._id.toString(),
    email: user.email ?? undefined,
    name: user.name,
    roles: (user.roles ?? [Roles.PATIENT]) as Role[],
    onboardingCompleted: user.onboardingCompleted ?? false,
    doctorVerificationStatus,
  };
}

export async function completeOnboarding(
  userId: string,
  data: {
    intent: "patient" | "doctor" | "nurse" | "rider";
    city: string;
    locale: "en" | "ur";
    dateOfBirth?: string;
    gender?: "male" | "female" | "other";
  },
) {
  await connectDatabase();
  const user = await UserModel.findById(userId);
  if (!user) throw new AppError("User not found", "NOT_FOUND", 404);

  const roleMap = {
    patient: Roles.PATIENT,
    doctor: Roles.DOCTOR,
    nurse: Roles.NURSE,
    rider: Roles.RIDER,
  } as const;

  const role = roleMap[data.intent];
  if (!user.roles.includes(role)) {
    user.roles.push(role);
  }

  user.metadata = {
    ...user.metadata,
    city: data.city,
    locale: data.locale,
  };
  user.onboardingCompleted = data.intent === "patient";

  await user.save();

  if (data.intent === "patient") {
    await PatientProfileModel.findOneAndUpdate(
      { userId: user._id },
      {
        defaultCity: data.city,
        ...(data.dateOfBirth ? { dateOfBirth: new Date(data.dateOfBirth) } : {}),
        ...(data.gender ? { gender: data.gender } : {}),
      },
      { upsert: true },
    );
  }

  if (data.intent === "doctor") {
    await DoctorProfileModel.findOneAndUpdate(
      { userId: user._id },
      {
        verificationStatus: VerificationStatuses.PENDING,
        isListed: false,
        coverageCities: [data.city],
      },
      { upsert: true },
    );
    user.onboardingCompleted = false;
    await user.save();
  }

  return loadAuthUserPayload(userId);
}
