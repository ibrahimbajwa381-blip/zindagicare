import { auth } from "@/lib/auth";
import { apiError, apiSuccess } from "@/server/api/response";
import { AppError, isAdmin, isAdminPanelUser, type Role } from "@zindagi/shared";
import { forPanelViewer } from "@/server/lib/manager-access";
import {
  adminDeleteNutritionist,
  getNutritionistDetailForAdmin,
} from "@/server/services/admin-nutritionist.service";

type Params = { params: Promise<{ id: string }> };

async function requireRole(allowed: (roles: Role[] | undefined) => boolean) {
  const session = await auth();
  if (!session?.user?.id) throw new AppError("Unauthorized", "UNAUTHORIZED", 401);
  if (!allowed(session.user.roles)) throw new AppError("Forbidden", "FORBIDDEN", 403);
  return session;
}

export async function GET(_req: Request, { params }: Params) {
  try {
    const session = await requireRole(isAdminPanelUser);
    const { id } = await params;
    return apiSuccess(forPanelViewer(session.user.roles, await getNutritionistDetailForAdmin(id)));
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    await requireRole(isAdmin);
    const { id } = await params;
    await adminDeleteNutritionist(id);
    return apiSuccess({ deleted: true });
  } catch (error) {
    return apiError(error);
  }
}
