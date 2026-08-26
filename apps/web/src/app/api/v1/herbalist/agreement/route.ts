import { auth } from "@/lib/auth";
import { apiError, apiSuccess } from "@/server/api/response";
import {
  acceptHerbalistAgreement,
  getHerbalistAgreementStatus,
} from "@/server/services/herbalist-verification.service";
import { AppError, Roles } from "@zindagi/shared";

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

    return apiSuccess(await getHerbalistAgreementStatus(session.user.id));
  } catch (error) {
    return apiError(error);
  }
}

export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.id) throw new AppError("Unauthorized", "UNAUTHORIZED", 401);
    assertHerbalist(session.user.roles ?? []);

    await acceptHerbalistAgreement(session.user.id);
    return apiSuccess({ accepted: true });
  } catch (error) {
    return apiError(error);
  }
}
