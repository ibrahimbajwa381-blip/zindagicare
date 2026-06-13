import {
  connectDatabase,
  DoctorProfileModel,
  SundaySlotTemplateModel,
  UserModel,
} from "@zindagi/database";
import {
  AppError,
  Roles,
  SUNDAY_CONSULT_CONFIG,
  VerificationStatuses,
} from "@zindagi/shared";
import type { z } from "zod";
import type { doctorVerificationSchema } from "@zindagi/validators";
import { getNextSundayDate } from "@/lib/sunday/date-utils";
import { SundayConsultService } from "./sunday-consult.service";
import { cnicLast4, hashCnic } from "./auth.service";
import {
  isDoctorAvatarUrlForUser,
} from "@/server/services/doctor-avatar.storage";
import { mongoFilter } from "@/lib/mongo/query";
import type { HydratedDocument } from "mongoose";
import type { DoctorProfileDocument } from "@zindagi/database";

type VerificationInput = z.infer<typeof doctorVerificationSchema>;

function computeMaxSlots(
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
    await DoctorProfileModel.findOne(
      mongoFilter({ slug, _id: { $ne: profileId } }),
    ).lean()
  ) {
    counter += 1;
    slug = `${base}-${counter}`;
  }
  return slug;
}

async function upsertSundayTemplateFromOnboarding(
  doctorProfileId: string,
  sundayConsult: NonNullable<VerificationInput["sundayConsult"]>,
) {
  if (!sundayConsult.enabled || !sundayConsult.startTimeLocal || !sundayConsult.endTimeLocal) {
    await SundaySlotTemplateModel.findOneAndUpdate(
      mongoFilter({ doctorId: doctorProfileId }),
      { $set: { isActive: false } },
    );
    return null;
  }

  const slotDurationMins =
    sundayConsult.slotDurationMins ?? SUNDAY_CONSULT_CONFIG.defaultSlotDurationMins;
  const maxSlots = computeMaxSlots(
    sundayConsult.startTimeLocal,
    sundayConsult.endTimeLocal,
    slotDurationMins,
  );

  return SundaySlotTemplateModel.findOneAndUpdate(
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
}

export async function submitDoctorVerification(
  userId: string,
  input: VerificationInput,
) {
  await connectDatabase();
  const user = await UserModel.findById(userId);
  if (!user?.roles.includes(Roles.DOCTOR)) {
    throw new AppError("Forbidden", "FORBIDDEN", 403);
  }

  const profile = (await DoctorProfileModel.findOne(
    mongoFilter({ userId: user._id }),
  )) as HydratedDocument<DoctorProfileDocument> | null;
  if (!profile) {
    throw new AppError("Doctor profile not found", "NOT_FOUND", 404);
  }

  if (profile.verificationStatus === VerificationStatuses.APPROVED) {
    throw new AppError("Already verified", "CONFLICT", 409);
  }

  if (!isDoctorAvatarUrlForUser(userId, input.avatarUrl)) {
    throw new AppError("Invalid profile photo", "VALIDATION_ERROR", 400);
  }

  user.avatarUrl = input.avatarUrl;
  await user.save();

  const coverageCities = [
    ...new Set(input.hospitals.map((hospital) => hospital.city.trim())),
  ];

  profile.pmdcNumber = input.pmdcNumber;
  profile.cnicHash = hashCnic(input.cnic);
  profile.cnicLast4 = cnicLast4(input.cnic);
  profile.medicalDegree = input.medicalDegree;
  profile.medicalCollege = input.medicalCollege;
  profile.graduationYear = input.graduationYear;
  profile.experienceYears = input.experienceYears;
  profile.specialties = input.specialties;
  profile.bio = input.bio;
  profile.consultationFee = input.consultationFee ?? 0;

  const hospitals = input.hospitals.map((hospital, index) => {
    const geo =
      index === 0 && input.homeVisit?.enabled && input.homeVisit.geo
        ? {
            type: "Point" as const,
            coordinates: [input.homeVisit.geo.lng, input.homeVisit.geo.lat] as [
              number,
              number,
            ],
          }
        : hospital.geo
          ? {
              type: "Point" as const,
              coordinates: [hospital.geo.lng, hospital.geo.lat] as [number, number],
            }
          : undefined;

    return {
      ...hospital,
      geo,
    };
  });

  profile.set("hospitals", hospitals);
  profile.homeVisitEnabled = input.homeVisit?.enabled ?? false;
  if (input.homeVisit?.enabled && input.homeVisit.geo) {
    profile.homeVisitLocation = {
      area: input.homeVisit.area,
      geo: {
        type: "Point",
        coordinates: [input.homeVisit.geo.lng, input.homeVisit.geo.lat],
      },
    };
  } else {
    profile.homeVisitLocation = undefined;
  }

  profile.set("weeklyAvailability", input.weeklyAvailability);
  profile.coverageCities = coverageCities.length ? coverageCities : ["Lahore"];
  profile.verificationDocuments = input.documentUrls;
  profile.verificationSubmittedAt = new Date();
  profile.verificationStatus = VerificationStatuses.PENDING;
  profile.isListed = false;
  profile.sundayConsultEnabled = false;
  profile.rejectionReason = undefined;

  if (input.sundayConsult?.enabled) {
    profile.sundaySlotDefaults = {
      durationMins: input.sundayConsult.slotDurationMins,
      maxSlots: computeMaxSlots(
        input.sundayConsult.startTimeLocal!,
        input.sundayConsult.endTimeLocal!,
        input.sundayConsult.slotDurationMins,
      ),
    };
  }

  await profile.save();

  if (input.sundayConsult) {
    await upsertSundayTemplateFromOnboarding(
      profile._id.toString(),
      input.sundayConsult,
    );
  }

  return profile;
}

export async function listPendingDoctorVerifications() {
  await connectDatabase();
  const profiles = await DoctorProfileModel.find({
    verificationStatus: VerificationStatuses.PENDING,
  })
    .sort({ verificationSubmittedAt: 1, createdAt: 1 })
    .lean();

  const userIds = profiles.map((p) => p.userId?.toString()).filter(Boolean) as string[];
  const users = userIds.length
    ? await UserModel.find(mongoFilter({ _id: { $in: userIds } }))
        .select("name email phone avatarUrl")
        .lean()
    : [];
  const userMap = new Map(users.map((u) => [u._id.toString(), u]));

  return profiles.map((profile) => {
    const userId = profile.userId?.toString() ?? "";
    return {
      ...profile,
      pmdcNumber: profile.pmdcNumber,
      userId: userMap.get(userId) ?? null,
    };
  });
}

export async function decideDoctorVerification(
  adminUserId: string,
  doctorProfileId: string,
  action: "approve" | "reject",
  rejectionReason?: string,
) {
  await connectDatabase();
  const profile = (await DoctorProfileModel.findById(
    doctorProfileId,
  )) as HydratedDocument<DoctorProfileDocument> | null;
  if (!profile) throw new AppError("Not found", "NOT_FOUND", 404);

  const user = await UserModel.findById(profile.userId);
  if (!user) throw new AppError("User not found", "NOT_FOUND", 404);

  if (action === "approve") {
    profile.verificationStatus = VerificationStatuses.APPROVED;
    profile.pmdcVerified = true;
    profile.isListed = true;
    profile.videoConsultEnabled = true;
    // Respect the doctor's in-house visit opt-in from verification
    profile.homeVisitEnabled = profile.homeVisitEnabled ?? false;
    profile.verifiedBy = adminUserId as unknown as DoctorProfileDocument["verifiedBy"];
    profile.verifiedAt = new Date();
    profile.rejectionReason = undefined;
    profile.slug = await generateUniqueSlug(user.name, profile._id.toString());

    const sundayTemplate = await SundaySlotTemplateModel.findOne(
      mongoFilter({ doctorId: profile._id, isActive: true }),
    );

    if (sundayTemplate) {
      profile.sundayConsultEnabled = true;
    }

    await profile.save();

    if (sundayTemplate) {
      try {
        await SundayConsultService.materializeInstance(
          profile._id.toString(),
          getNextSundayDate(),
        );
      } catch (err) {
        console.error("[decideDoctorVerification] Sunday slot materialize failed:", err);
      }
    }

    await UserModel.findByIdAndUpdate(profile.userId, {
      onboardingCompleted: true,
    });
  } else {
    profile.verificationStatus = VerificationStatuses.REJECTED;
    profile.isListed = false;
    profile.videoConsultEnabled = false;
    profile.sundayConsultEnabled = false;
    profile.rejectionReason = rejectionReason ?? "Application rejected";
    await profile.save();
  }

  return profile;
}
