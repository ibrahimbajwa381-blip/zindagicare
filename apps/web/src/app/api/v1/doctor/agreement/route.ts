import { auth } from "@/lib/auth";
import { apiError, apiSuccess } from "@/server/api/response";
import {
  acceptDoctorAgreement,
  getDoctorAgreementStatus,
} from "@/server/services/doctor-verification.service";
import { AppError, Roles } from "@zindagi/shared";

function assertDoctor(roles: string[] = []) {
  if (!roles.includes(Roles.DOCTOR)) {
    throw new AppError("Forbidden", "FORBIDDEN", 403);
  }
}

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) throw new AppError("Unauthorized", "UNAUTHORIZED", 401);
    assertDoctor(session.user.roles ?? []);

    const status = await getDoctorAgreementStatus(session.user.id);
    return apiSuccess(status);
  } catch (error) {
    return apiError(error);
  }
}

export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.id) throw new AppError("Unauthorized", "UNAUTHORIZED", 401);
    assertDoctor(session.user.roles ?? []);

    await acceptDoctorAgreement(session.user.id);
    return apiSuccess({ accepted: true });
  } catch (error) {
    return apiError(error);
  }
}
