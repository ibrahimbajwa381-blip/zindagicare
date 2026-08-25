import { auth } from "@/lib/auth";
import { apiError, apiSuccess } from "@/server/api/response";
import { getOwnDoctorEarningEligibility } from "@/server/services/admin-doctor-finance.service";
import { AppError, Roles } from "@zindagi/shared";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) throw new AppError("Unauthorized", "UNAUTHORIZED", 401);
    if (!session.user.roles?.includes(Roles.DOCTOR)) {
      throw new AppError("Forbidden", "FORBIDDEN", 403);
    }

    const { appointments } = await getOwnDoctorEarningEligibility(session.user.id);
    return apiSuccess({ appointments });
  } catch (error) {
    return apiError(error);
  }
}
