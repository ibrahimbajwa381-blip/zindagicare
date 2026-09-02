import { auth } from "@/lib/auth";
import { apiError, apiSuccess } from "@/server/api/response";
import { AppError, Roles } from "@zindagi/shared";
import {
  getNutritionistReferralInfo,
  getNutritionistReferredPatientsSummary,
  regenerateNutritionistReferralCode,
} from "@/server/services/nutritionist-referral.service";
import { getNutritionistProfileIdForUser } from "@/server/services/nutritionist-profile.service";

function assertNutritionist(roles: string[] = []) {
  if (!roles.includes(Roles.NUTRITIONIST)) {
    throw new AppError("Forbidden", "FORBIDDEN", 403);
  }
}

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) throw new AppError("Unauthorized", "UNAUTHORIZED", 401);
    assertNutritionist(session.user.roles ?? []);

    const profileId = await getNutritionistProfileIdForUser(session.user.id);
    const [referral, summary] = await Promise.all([
      getNutritionistReferralInfo(profileId),
      getNutritionistReferredPatientsSummary(profileId),
    ]);
    return apiSuccess({ referral, summary });
  } catch (error) {
    return apiError(error);
  }
}

/** Regenerates the referral code (invalidates the old link for future signups). */
export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.id) throw new AppError("Unauthorized", "UNAUTHORIZED", 401);
    assertNutritionist(session.user.roles ?? []);

    const profileId = await getNutritionistProfileIdForUser(session.user.id);
    await regenerateNutritionistReferralCode(profileId);
    const referral = await getNutritionistReferralInfo(profileId);
    return apiSuccess({ referral });
  } catch (error) {
    return apiError(error);
  }
}
