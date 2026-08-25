import { auth } from "@/lib/auth";
import { apiError, apiSuccess } from "@/server/api/response";
import {
  acceptPhysiotherapistAgreement,
  getPhysiotherapistAgreementStatus,
} from "@/server/services/physiotherapist.service";
import { AppError, Roles } from "@zindagi/shared";

function assertPhysiotherapist(roles: string[] = []) {
  if (!roles.includes(Roles.PHYSIOTHERAPIST)) {
    throw new AppError("Forbidden", "FORBIDDEN", 403);
  }
}

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) throw new AppError("Unauthorized", "UNAUTHORIZED", 401);
    assertPhysiotherapist(session.user.roles ?? []);

    const status = await getPhysiotherapistAgreementStatus(session.user.id);
    return apiSuccess(status);
  } catch (error) {
    return apiError(error);
  }
}

export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.id) throw new AppError("Unauthorized", "UNAUTHORIZED", 401);
    assertPhysiotherapist(session.user.roles ?? []);

    await acceptPhysiotherapistAgreement(session.user.id);
    return apiSuccess({ accepted: true });
  } catch (error) {
    return apiError(error);
  }
}
