import { auth } from "@/lib/auth";
import { apiError, apiSuccess } from "@/server/api/response";
import { getNurseProfileForAdmin } from "@/server/services/nurse.service";
import { adminDeleteNurse } from "@/server/services/admin-nurse.service";
import { AppError, isAdminPanelUser } from "@zindagi/shared";
import { forPanelViewer } from "@/server/lib/manager-access";

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
    const profile = await getNurseProfileForAdmin(id);
    return apiSuccess(forPanelViewer(roles, profile));
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new AppError("Unauthorized", "UNAUTHORIZED", 401);
    }

    const roles = session.user.roles ?? [];
    if (!roles.includes("admin") && !roles.includes("super_admin")) {
      throw new AppError("Only admins can permanently delete a nurse", "FORBIDDEN", 403);
    }

    const { id } = await params;
    await adminDeleteNurse(session.user.id, id);
    return apiSuccess({ deleted: true });
  } catch (error) {
    return apiError(error);
  }
}
