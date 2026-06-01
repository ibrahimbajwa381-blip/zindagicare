import bcrypt from "bcryptjs";
import {
  connectDatabase,
  DoctorProfileModel,
  SundaySlotTemplateModel,
  UserModel,
<<<<<<< HEAD
  type DoctorProfileDocument,
=======
>>>>>>> de54e62 (google verification)
} from "@zindagi/database";
import {
  AppError,
  Roles,
  SUNDAY_CONSULT_CONFIG,
  VerificationStatuses,
} from "@zindagi/shared";
import type { z } from "zod";
import type {
  adminCreateDoctorSchema,
  adminUpdateDoctorSchema,
} from "@zindagi/validators";
import { getNextSundayDate } from "@/lib/sunday/date-utils";
import { SundayConsultService } from "./sunday-consult.service";

type CreateDoctorInput = z.infer<typeof adminCreateDoctorSchema>;
type UpdateDoctorInput = z.infer<typeof adminUpdateDoctorSchema>;

const BCRYPT_ROUNDS = 12;

async function generateUniqueSlug(name: string, profileId: string): Promise<string> {
  const base =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "doctor";

  let slug = base;
  let counter = 0;
  while (
    await DoctorProfileModel.findOne({
      slug,
      _id: { $ne: profileId },
<<<<<<< HEAD
    } as Record<string, unknown>).lean()
=======
    }).lean()
>>>>>>> de54e62 (google verification)
  ) {
    counter += 1;
    slug = `${base}-${counter}`;
  }
  return slug;
}

export type AdminDoctorRow = {
  id: string;
  userId: string;
  name: string;
  email?: string;
  phone?: string;
  pmdcNumber?: string;
  specialties: string[];
  verificationStatus: string;
  isListed: boolean;
  isActive: boolean;
  sundayConsultEnabled: boolean;
  weeklyAvailability: { dayOfWeek: number; startTimeLocal: string; endTimeLocal: string }[];
};

function mapDoctorRow(
  profile: {
    _id: { toString(): string };
    userId: {
      _id?: { toString(): string };
      name?: string;
      email?: string;
      phone?: string;
      isActive?: boolean;
    };
    pmdcNumber?: string;
    specialties?: string[];
    verificationStatus?: string;
    isListed?: boolean;
    sundayConsultEnabled?: boolean;
    weeklyAvailability?: AdminDoctorRow["weeklyAvailability"];
  },
): AdminDoctorRow {
  const user = profile.userId;
  return {
    id: profile._id.toString(),
    userId: user?._id?.toString() ?? "",
    name: user?.name ?? "Doctor",
    email: user?.email ?? undefined,
    phone: user?.phone ?? undefined,
    pmdcNumber: profile.pmdcNumber ?? undefined,
    specialties: profile.specialties ?? [],
    verificationStatus: profile.verificationStatus ?? VerificationStatuses.PENDING,
    isListed: profile.isListed ?? false,
    isActive: user?.isActive !== false,
    sundayConsultEnabled: profile.sundayConsultEnabled ?? false,
    weeklyAvailability: profile.weeklyAvailability ?? [],
  };
}

export async function listAllDoctors(search?: string): Promise<AdminDoctorRow[]> {
  await connectDatabase();

  let userFilter: Record<string, unknown> | undefined;
  if (search?.trim()) {
    const q = search.trim();
    const users = await UserModel.find({
      $or: [
        { name: { $regex: q, $options: "i" } },
        { email: { $regex: q, $options: "i" } },
        { phone: { $regex: q, $options: "i" } },
      ],
      roles: Roles.DOCTOR,
    })
      .select("_id")
      .lean();
    userFilter = { userId: { $in: users.map((u) => u._id) } };
  }

  const profiles = await DoctorProfileModel.find(userFilter ?? {})
    .populate("userId", "name email phone isActive")
    .sort({ createdAt: -1 })
    .lean();

  return profiles.map((p) => mapDoctorRow(p as Parameters<typeof mapDoctorRow>[0]));
}

export async function adminCreateDoctor(
  adminUserId: string,
  input: CreateDoctorInput,
): Promise<AdminDoctorRow> {
  await connectDatabase();
  const email = input.email.toLowerCase();

  const existing = await UserModel.findOne({ email });
  if (existing) {
    throw new AppError("Email already in use", "CONFLICT", 409);
  }

  const passwordHash = await bcrypt.hash(
    input.password ?? "Doctor@123",
    BCRYPT_ROUNDS,
  );

  const user = await UserModel.create({
    name: input.name,
    email,
    phone: input.phone,
    passwordHash,
    roles: [Roles.DOCTOR, Roles.PATIENT],
    authProviders: ["credentials"],
    emailVerified: new Date(),
    onboardingCompleted: true,
    isActive: true,
  });

<<<<<<< HEAD
  const profile = (await DoctorProfileModel.create({
=======
  const profile = await DoctorProfileModel.create({
>>>>>>> de54e62 (google verification)
    userId: user._id,
    pmdcNumber: input.pmdcNumber,
    pmdcVerified: true,
    specialties: input.specialties,
    verificationStatus: VerificationStatuses.APPROVED,
    verifiedBy: adminUserId,
    verifiedAt: new Date(),
    isListed: true,
    sundayConsultEnabled: input.sundayConsultEnabled ?? false,
    coverageCities: ["Lahore"],
<<<<<<< HEAD
  } as Record<string, unknown>)) as DoctorProfileDocument;

  const slug = await generateUniqueSlug(input.name, profile._id.toString());
  await DoctorProfileModel.findByIdAndUpdate(profile._id, { $set: { slug } });

  if (input.sundayConsultEnabled) {
    await SundaySlotTemplateModel.findOneAndUpdate(
      { doctorId: profile._id } as Record<string, unknown>,
=======
  });

  profile.slug = await generateUniqueSlug(input.name, profile._id.toString());
  await profile.save();

  if (input.sundayConsultEnabled) {
    await SundaySlotTemplateModel.findOneAndUpdate(
      { doctorId: profile._id },
>>>>>>> de54e62 (google verification)
      {
        $set: {
          startTimeLocal: "09:00",
          endTimeLocal: "12:00",
          slotDurationMins: SUNDAY_CONSULT_CONFIG.defaultSlotDurationMins,
          maxSlots: 10,
          dayOfWeek: SUNDAY_CONSULT_CONFIG.dayOfWeek,
          timezone: SUNDAY_CONSULT_CONFIG.timezone,
          isActive: true,
        },
      },
      { upsert: true },
    );
    await SundayConsultService.materializeInstance(
      profile._id.toString(),
      getNextSundayDate(),
    );
  }

  const populated = await DoctorProfileModel.findById(profile._id)
    .populate("userId", "name email phone isActive")
    .lean();

  return mapDoctorRow(populated as Parameters<typeof mapDoctorRow>[0]);
}

export async function adminUpdateDoctor(
  doctorProfileId: string,
  input: UpdateDoctorInput,
): Promise<AdminDoctorRow> {
  await connectDatabase();
  const profile = await DoctorProfileModel.findById(doctorProfileId);
  if (!profile) throw new AppError("Doctor not found", "NOT_FOUND", 404);

  if (input.isListed !== undefined) profile.isListed = input.isListed;
  if (input.sundayConsultEnabled !== undefined) {
    profile.sundayConsultEnabled = input.sundayConsultEnabled;
  }
  if (input.weeklyAvailability !== undefined) {
    profile.set("weeklyAvailability", input.weeklyAvailability);
  }

  await profile.save();

  if (input.isActive !== undefined) {
    await UserModel.findByIdAndUpdate(profile.userId, {
      $set: { isActive: input.isActive },
    });
  }

  if (input.sundayMaxSlots !== undefined || input.sundaySlotDurationMins !== undefined) {
<<<<<<< HEAD
    const template = await SundaySlotTemplateModel.findOne({
      doctorId: profile._id,
    } as Record<string, unknown>);
=======
    const template = await SundaySlotTemplateModel.findOne({ doctorId: profile._id });
>>>>>>> de54e62 (google verification)
    if (template) {
      if (input.sundayMaxSlots !== undefined) template.maxSlots = input.sundayMaxSlots;
      if (input.sundaySlotDurationMins !== undefined) {
        template.slotDurationMins = input.sundaySlotDurationMins;
      }
      await template.save();
    } else if (profile.sundayConsultEnabled) {
      await SundaySlotTemplateModel.create({
        doctorId: profile._id,
        startTimeLocal: "09:00",
        endTimeLocal: "12:00",
        slotDurationMins: input.sundaySlotDurationMins ?? 10,
        maxSlots: input.sundayMaxSlots ?? 10,
        dayOfWeek: SUNDAY_CONSULT_CONFIG.dayOfWeek,
        timezone: SUNDAY_CONSULT_CONFIG.timezone,
        isActive: true,
<<<<<<< HEAD
      } as Record<string, unknown>);
=======
      });
>>>>>>> de54e62 (google verification)
    }
  }

  const populated = await DoctorProfileModel.findById(profile._id)
    .populate("userId", "name email phone isActive")
    .lean();

  return mapDoctorRow(populated as Parameters<typeof mapDoctorRow>[0]);
}

export async function listDoctorsForReassign() {
  await connectDatabase();
  const profiles = await DoctorProfileModel.find({
    verificationStatus: VerificationStatuses.APPROVED,
    isListed: true,
  })
    .populate("userId", "name")
    .lean();

  return profiles.map((p) => ({
    id: p._id.toString(),
    name: (p.userId as { name?: string })?.name ?? "Doctor",
    specialties: p.specialties ?? [],
  }));
}
