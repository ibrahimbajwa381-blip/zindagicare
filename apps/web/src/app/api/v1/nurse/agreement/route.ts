import { auth } from "@/lib/auth";
import { apiError, apiSuccess } from "@/server/api/response";
import {
  acceptNurseAgreement,
  getNurseAgreementStatus,
} from "@/server/services/nurse.service";
import { AppError, Roles } from "@zindagi/shared";

function assertNurse(roles: string[] = []) {
  if (!roles.includes(Roles.NURSE)) {
    throw new AppError("Forbidden", "FORBIDDEN", 403);
  }
}

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) throw new AppError("Unauthorized", "UNAUTHORIZED", 401);
    assertNurse(session.user.roles ?? []);

    const status = await getNurseAgreementStatus(session.user.id);
    return apiSuccess(status);
  } catch (error) {
    return apiError(error);
  }
}

export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.id) throw new AppError("Unauthorized", "UNAUTHORIZED", 401);
    assertNurse(session.user.roles ?? []);

    await acceptNurseAgreement(session.user.id);
    return apiSuccess({ accepted: true });
  } catch (error) {
    return apiError(error);
  }
}
