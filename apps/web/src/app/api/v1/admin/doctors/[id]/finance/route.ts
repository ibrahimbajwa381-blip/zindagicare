import { auth } from "@/lib/auth";
import { apiError, apiSuccess } from "@/server/api/response";
import { getAdminDoctorFinanceDetail } from "@/server/services/admin-doctor-finance.service";
import { AppError, Roles } from "@zindagi/shared";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user?.id) throw new AppError("Unauthorized", "UNAUTHORIZED", 401);
    const roles = session.user.roles ?? [];
    if (!roles.includes(Roles.ADMIN) && !roles.includes(Roles.SUPER_ADMIN)) {
      throw new AppError("Forbidden", "FORBIDDEN", 403);
    }

    const { id } = await params;
    const detail = await getAdminDoctorFinanceDetail(id);
    return apiSuccess(detail);
  } catch (error) {
    return apiError(error);
  }
}
