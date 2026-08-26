import { auth } from "@/lib/auth";
import { apiError, apiSuccess } from "@/server/api/response";
import { AppError, Roles } from "@zindagi/shared";
import {
  getHerbalistReferralInfo,
  getHerbalistReferredPatientsSummary,
  regenerateHerbalistReferralCode,
} from "@/server/services/herbalist-referral.service";
import { getHerbalistProfileIdForUser } from "@/server/services/herbalist-profile.service";

function assertHerbalist(roles: string[] = []) {
  if (!roles.includes(Roles.HERBALIST)) {
    throw new AppError("Forbidden", "FORBIDDEN", 403);
  }
}

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) throw new AppError("Unauthorized", "UNAUTHORIZED", 401);
    assertHerbalist(session.user.roles ?? []);

    const profileId = await getHerbalistProfileIdForUser(session.user.id);
    const [referral, summary] = await Promise.all([
      getHerbalistReferralInfo(profileId),
      getHerbalistReferredPatientsSummary(profileId),
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
    assertHerbalist(session.user.roles ?? []);

    const profileId = await getHerbalistProfileIdForUser(session.user.id);
    await regenerateHerbalistReferralCode(profileId);
    const referral = await getHerbalistReferralInfo(profileId);
    return apiSuccess({ referral });
  } catch (error) {
    return apiError(error);
  }
}
