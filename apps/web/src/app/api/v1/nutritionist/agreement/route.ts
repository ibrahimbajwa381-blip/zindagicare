import { auth } from "@/lib/auth";
import { apiError, apiSuccess } from "@/server/api/response";
import {
  acceptNutritionistAgreement,
  getNutritionistAgreementStatus,
} from "@/server/services/nutritionist-verification.service";
import { AppError, Roles } from "@zindagi/shared";

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

    return apiSuccess(await getNutritionistAgreementStatus(session.user.id));
  } catch (error) {
    return apiError(error);
  }
}

export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.id) throw new AppError("Unauthorized", "UNAUTHORIZED", 401);
    assertNutritionist(session.user.roles ?? []);

    await acceptNutritionistAgreement(session.user.id);
    return apiSuccess({ accepted: true });
  } catch (error) {
    return apiError(error);
  }
}
