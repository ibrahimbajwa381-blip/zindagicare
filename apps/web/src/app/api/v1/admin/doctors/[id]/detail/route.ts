import { auth } from "@/lib/auth";
import { apiError, apiSuccess } from "@/server/api/response";
import { forPanelViewer } from "@/server/lib/manager-access";
import { getDoctorDetailForAdmin } from "@/server/services/admin-doctor.service";
import { AppError, isAdminPanelUser } from "@zindagi/shared";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new AppError("Unauthorized", "UNAUTHORIZED", 401);
    }

    const roles = session.user.roles ?? [];
    if (!isAdminPanelUser(roles)) {
      throw new AppError("Forbidden", "FORBIDDEN", 403);
    }

    const { id } = await params;
    const doctor = await getDoctorDetailForAdmin(id);
    return apiSuccess(forPanelViewer(roles, { doctor }));
  } catch (error) {
    return apiError(error);
  }
}
