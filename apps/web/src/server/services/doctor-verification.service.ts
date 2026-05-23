import {
  connectDatabase,
  DoctorProfileModel,
  UserModel,
} from "@zindagi/database";
import { Types } from "mongoose";
import { AppError, Roles, VerificationStatuses } from "@zindagi/shared";
import type { z } from "zod";
import type { doctorVerificationSchema } from "@zindagi/validators";
import { cnicLast4, hashCnic } from "./auth.service";

type VerificationInput = z.infer<typeof doctorVerificationSchema>;

export async function submitDoctorVerification(
  userId: string,
  input: VerificationInput,
) {
  await connectDatabase();
  const user = await UserModel.findById(userId);
  if (!user?.roles.includes(Roles.DOCTOR)) {
    throw new AppError("Forbidden", "FORBIDDEN", 403);
  }

  const profile = await DoctorProfileModel.findOne({ userId: user._id });
  if (!profile) {
    throw new AppError("Doctor profile not found", "NOT_FOUND", 404);
  }

  if (profile.verificationStatus === VerificationStatuses.APPROVED) {
    throw new AppError("Already verified", "CONFLICT", 409);
  }

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
  profile.set("hospitals", input.hospitals);
  profile.verificationDocuments = input.documentUrls;
  profile.verificationSubmittedAt = new Date();
  profile.verificationStatus = VerificationStatuses.PENDING;
  profile.isListed = false;
  profile.rejectionReason = undefined;

  await profile.save();
  return profile;
}

export async function listPendingDoctorVerifications() {
  await connectDatabase();
  return DoctorProfileModel.find({
    verificationStatus: VerificationStatuses.PENDING,
    verificationSubmittedAt: { $exists: true },
  })
    .populate("userId", "name email phone avatarUrl")
    .sort({ verificationSubmittedAt: 1 })
    .lean();
}

export async function decideDoctorVerification(
  adminUserId: string,
  doctorProfileId: string,
  action: "approve" | "reject",
  rejectionReason?: string,
) {
  await connectDatabase();
  const profile = await DoctorProfileModel.findById(doctorProfileId);
  if (!profile) throw new AppError("Not found", "NOT_FOUND", 404);

  if (action === "approve") {
    profile.verificationStatus = VerificationStatuses.APPROVED;
    profile.pmdcVerified = true;
    profile.isListed = true;
    profile.verifiedBy = new Types.ObjectId(adminUserId);
    profile.verifiedAt = new Date();
    profile.rejectionReason = undefined;

    await UserModel.findByIdAndUpdate(profile.userId, {
      onboardingCompleted: true,
    });
  } else {
    profile.verificationStatus = VerificationStatuses.REJECTED;
    profile.isListed = false;
    profile.rejectionReason = rejectionReason ?? "Application rejected";
  }

  await profile.save();
  return profile;
}
