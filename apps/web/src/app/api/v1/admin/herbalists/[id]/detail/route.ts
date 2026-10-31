import { auth } from "@/lib/auth";
import { apiError, apiSuccess } from "@/server/api/response";
import { forPanelViewer } from "@/server/lib/manager-access";
import { AppError, isAdminPanelUser } from "@zindagi/shared";
import { getHerbalistDetailForAdmin } from "@/server/services/admin-herbalist.service";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user?.id) throw new AppError("Unauthorized", "UNAUTHORIZED", 401);
    if (!isAdminPanelUser(session.user.roles)) {
      throw new AppError("Forbidden", "FORBIDDEN", 403);
    }

    const { id } = await params;
    return apiSuccess(forPanelViewer(session.user.roles, await getHerbalistDetailForAdmin(id)));
  } catch (error) {
    return apiError(error);
  }
}
