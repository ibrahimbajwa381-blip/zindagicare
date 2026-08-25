import { auth } from "@/lib/auth";
import { apiError, apiSuccess } from "@/server/api/response";
import { AppError, Roles } from "@zindagi/shared";
import { DoctorProfileModel } from "@zindagi/database";
import { mongoFilter } from "@/lib/mongo/query";
import {
  getDoctorReferralInfo,
  regenerateDoctorReferralCode,
} from "@/server/services/doctor-referral.service";

function assertDoctor(roles: string[] = []) {
  if (!roles.includes(Roles.DOCTOR)) {
    throw new AppError("Forbidden", "FORBIDDEN", 403);
  }
}

async function getOwnDoctorProfileId(userId: string): Promise<string> {
  const profile = await DoctorProfileModel.findOne(mongoFilter({ userId }))
    .select("_id")
    .lean();
  if (!profile) throw new AppError("Doctor profile not found", "NOT_FOUND", 404);
  return profile._id.toString();
}

/** Regenerates the doctor's referral code (invalidates the old link for future signups). */
export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.id) throw new AppError("Unauthorized", "UNAUTHORIZED", 401);
    assertDoctor(session.user.roles ?? []);

    const profileId = await getOwnDoctorProfileId(session.user.id);
    await regenerateDoctorReferralCode(profileId);
    const referral = await getDoctorReferralInfo(profileId);
    return apiSuccess({ referral });
  } catch (error) {
    return apiError(error);
  }
}
