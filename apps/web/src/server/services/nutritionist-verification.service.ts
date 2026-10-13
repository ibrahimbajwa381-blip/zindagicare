import {
  connectDatabase,
  NutritionistProfileModel,
  UserModel,
  type NutritionistProfileDocument,
} from "@zindagi/database";
import {
  AppError,
  PROVIDER_AGREEMENT_VERSION,
  Roles,
  VerificationStatuses,
  claimedSpecialties,
  normalizeAdditionalSpecialties,
} from "@zindagi/shared";
import type { NutritionistVerificationInput } from "@zindagi/validators";
import type { HydratedDocument } from "mongoose";
import { mongoFilter } from "@/lib/mongo/query";
import { mapUserPii, safeDisplayText } from "@/server/lib/decrypt-pii";
import { recordAdminActivity } from "@/server/services/admin-activity.service";
import { isNutritionistAvatarUrlForUser } from "@/server/services/nutritionist-avatar.storage";
import {
  deleteNutritionistDocument,
  nutritionistDocumentStorageKeyFromUrl,
} from "@/server/services/nutritionist-documents.storage";
import { generateUniqueNutritionistSlug } from "@/server/services/nutritionist-slug.service";
import { cnicLast4, hashCnic } from "./auth.service";

async function deleteReplacedDocuments(
  previous: Record<string, string | null | undefined> | undefined,
  next: Record<string, string | null | undefined>,
): Promise<void> {
  if (!previous) return;
  for (const [field, previousUrl] of Object.entries(previous)) {
    if (!previousUrl || previousUrl === next[field]) continue;
    const previousKey = nutritionistDocumentStorageKeyFromUrl(previousUrl);
    if (!previousKey) continue;
    try {
      await deleteNutritionistDocument(previousKey);
    } catch {
      // best-effort cleanup; ignore failures (e.g., file already removed)
    }
  }
}

/** Ensure a NutritionistProfile row exists (covers legacy / admin-seeded accounts). */
export async function ensureNutritionistProfile(
  userId: string,
): Promise<HydratedDocument<NutritionistProfileDocument>> {
  await connectDatabase();
  const existing = (await NutritionistProfileModel.findOne(
    mongoFilter({ userId }),
  )) as HydratedDocument<NutritionistProfileDocument> | null;
  if (existing) return existing;

  return (await NutritionistProfileModel.create({
    userId,
    verificationStatus: VerificationStatuses.PENDING,
  })) as HydratedDocument<NutritionistProfileDocument>;
}

export async function submitNutritionistVerification(
  userId: string,
  input: NutritionistVerificationInput,
) {
  await connectDatabase();
  const user = await UserModel.findById(userId);
  if (!user?.roles.includes(Roles.NUTRITIONIST)) {
    throw new AppError("Forbidden", "FORBIDDEN", 403);
  }

  const profile = await ensureNutritionistProfile(userId);

  if (profile.verificationStatus === VerificationStatuses.APPROVED) {
    throw new AppError("Already verified", "CONFLICT", 409);
  }

  if (!isNutritionistAvatarUrlForUser(userId, input.avatarUrl)) {
    throw new AppError("Invalid profile photo", "VALIDATION_ERROR", 400);
  }

  user.avatarUrl = input.avatarUrl;
  await user.save();

  const coverageCities = [
    ...new Set(input.clinics.map((clinic) => clinic.city.trim())),
  ];

  profile.licenseNumber = input.licenseNumber;
  profile.cnicHash = hashCnic(input.cnic);
  profile.cnicLast4 = cnicLast4(input.cnic);
  profile.degree = input.degree;
  profile.qualifications = input.qualifications ?? [];
  profile.institute = input.institute;
  profile.graduationYear = input.graduationYear;
  profile.experienceYears = input.experienceYears;
  profile.primarySpecialty = input.primarySpecialty;
  profile.additionalSpecialties = normalizeAdditionalSpecialties(
    input.primarySpecialty,
    input.additionalSpecialties ?? [],
  );
  // Patient-visible specialties stay empty until an admin verifies them.
  profile.specialties = [];
  profile.bio = input.bio;
  profile.languages = input.languages ?? ["English", "Urdu"];
  profile.consultationFee = input.consultationFee ?? 0;

  profile.set(
    "clinics",
    input.clinics.map((clinic) => ({
      name: clinic.name,
      city: clinic.city,
      area: clinic.area?.trim() || undefined,
      address: clinic.address,
      geo: clinic.geo
        ? {
            type: "Point" as const,
            coordinates: [clinic.geo.lng, clinic.geo.lat] as [number, number],
          }
        : undefined,
    })),
  );

  profile.set("weeklyAvailability", input.weeklyAvailability);
  profile.coverageCities = coverageCities;
  const previousDocuments = profile.verificationDocuments
    ? { ...profile.verificationDocuments }
    : undefined;
  profile.verificationDocuments = input.documentUrls;
  profile.verificationSubmittedAt = new Date();
  profile.platformAgreementAcceptedAt = new Date();
  profile.platformAgreementVersion = PROVIDER_AGREEMENT_VERSION;
  profile.verificationStatus = VerificationStatuses.PENDING;
  profile.isListed = false;
  // Video consults only go live once an admin approves the application.
  profile.videoConsultEnabled = false;
  profile.rejectionReason = undefined;

  await profile.save();
  await deleteReplacedDocuments(previousDocuments, input.documentUrls);

  return profile;
}

export async function listPendingNutritionistVerifications() {
  await connectDatabase();
  const profiles = await NutritionistProfileModel.find({
    verificationStatus: VerificationStatuses.PENDING,
    deletedAt: { $exists: false },
  })
    .sort({ verificationSubmittedAt: -1, createdAt: -1 })
    .lean();

  const userIds = profiles
    .map((p) => p.userId?.toString())
    .filter(Boolean) as string[];
  const users = userIds.length
    ? await UserModel.find(mongoFilter({ _id: { $in: userIds } }))
        .select("name email phone avatarUrl")
        .lean()
    : [];
  const userMap = new Map(users.map((u) => [u._id.toString(), u]));

  return profiles.map((profile) => {
    const userId = profile.userId?.toString() ?? "";
    const user = userMap.get(userId);
    const pii = user ? mapUserPii(user) : null;
    return {
      ...profile,
      userId: user
        ? {
            _id: userId,
            name: pii?.name ?? "Nutritionist",
            email: pii?.email,
            phone: pii?.phone,
            avatarUrl: user.avatarUrl,
          }
        : null,
    };
  });
}

export async function decideNutritionistVerification(
  adminUserId: string,
  nutritionistProfileId: string,
  action: "approve" | "reject",
  rejectionReason?: string,
  verifiedSpecialties?: string[],
) {
  await connectDatabase();
  const profile = (await NutritionistProfileModel.findById(
    nutritionistProfileId,
  )) as HydratedDocument<NutritionistProfileDocument> | null;
  if (!profile) throw new AppError("Not found", "NOT_FOUND", 404);

  const user = await UserModel.findById(profile.userId);
  if (!user) throw new AppError("User not found", "NOT_FOUND", 404);

  if (action === "approve") {
    const primary =
      profile.primarySpecialty?.trim() || profile.specialties?.[0] || "";
    const additional = normalizeAdditionalSpecialties(
      primary,
      profile.additionalSpecialties ?? profile.specialties?.slice(1) ?? [],
    );
    const claimed = claimedSpecialties(primary, additional);
    if (!claimed.length) {
      throw new AppError(
        "Nutritionist must have a primary specialty before approval",
        "VALIDATION_ERROR",
        400,
      );
    }

    const claimedSet = new Set(claimed);
    let verified = verifiedSpecialties?.length
      ? [...new Set(verifiedSpecialties.map((s) => s.trim()).filter(Boolean))]
      : claimed;

    verified = verified.filter((s) => claimedSet.has(s));
    if (!verified.length) {
      throw new AppError(
        "Select at least one specialty from the nutritionist's requested list to verify",
        "VALIDATION_ERROR",
        400,
      );
    }

    // Keep primary first in the verified list when it is included.
    if (primary && verified.includes(primary)) {
      verified = [primary, ...verified.filter((s) => s !== primary)];
    }

    if (!profile.primarySpecialty) profile.primarySpecialty = primary;
    if (!profile.additionalSpecialties?.length && additional.length) {
      profile.additionalSpecialties = additional;
    }
    profile.specialties = verified;

    profile.verificationStatus = VerificationStatuses.APPROVED;
    profile.licenseVerified = true;
    profile.isListed = true;
    profile.videoConsultEnabled = true;
    profile.verifiedBy =
      adminUserId as unknown as NutritionistProfileDocument["verifiedBy"];
    profile.verifiedAt = new Date();
    profile.rejectionReason = undefined;
    profile.slug = await generateUniqueNutritionistSlug(
      user.name,
      profile._id.toString(),
    );

    await profile.save();

    await UserModel.findByIdAndUpdate(profile.userId, {
      onboardingCompleted: true,
    });
  } else {
    profile.verificationStatus = VerificationStatuses.REJECTED;
    profile.isListed = false;
    profile.videoConsultEnabled = false;
    profile.rejectionReason = rejectionReason ?? "Application rejected";
    await profile.save();
  }

  await recordAdminActivity({
    actor: adminUserId,
    action:
      action === "approve"
        ? "nutritionist.verification_approved"
        : "nutritionist.verification_rejected",
    entityType: "NutritionistProfile",
    entityId: nutritionistProfileId,
    targetLabel: safeDisplayText(user.name) ?? undefined,
    changes: action === "approve" ? undefined : { rejectionReason: profile.rejectionReason },
  });

  return profile;
}

export async function getNutritionistAgreementStatus(userId: string): Promise<{
  accepted: boolean;
  acceptedAt?: string;
  version?: string;
  currentVersion: string;
}> {
  await connectDatabase();
  const profile = await NutritionistProfileModel.findOne(mongoFilter({ userId }))
    .select("platformAgreementAcceptedAt platformAgreementVersion")
    .lean();
  if (!profile) {
    throw new AppError("Nutritionist profile not found", "NOT_FOUND", 404);
  }

  return {
    accepted: Boolean(profile.platformAgreementAcceptedAt),
    acceptedAt: profile.platformAgreementAcceptedAt?.toISOString(),
    version: profile.platformAgreementVersion ?? undefined,
    currentVersion: PROVIDER_AGREEMENT_VERSION,
  };
}

/** Retroactive acceptance for nutritionists approved before the Provider Agreement existed. */
export async function acceptNutritionistAgreement(userId: string): Promise<void> {
  await connectDatabase();
  const profile = await NutritionistProfileModel.findOne(mongoFilter({ userId }));
  if (!profile) {
    throw new AppError("Nutritionist profile not found", "NOT_FOUND", 404);
  }

  profile.platformAgreementAcceptedAt = new Date();
  profile.platformAgreementVersion = PROVIDER_AGREEMENT_VERSION;
  await profile.save();
}
