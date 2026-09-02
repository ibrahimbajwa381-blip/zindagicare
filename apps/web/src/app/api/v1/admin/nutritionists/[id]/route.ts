import { auth } from "@/lib/auth";
import { apiError, apiSuccess } from "@/server/api/response";
import { AppError, isAdmin } from "@zindagi/shared";
import {
  adminDeleteNutritionist,
  getNutritionistDetailForAdmin,
} from "@/server/services/admin-nutritionist.service";

type Params = { params: Promise<{ id: string }> };

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id) throw new AppError("Unauthorized", "UNAUTHORIZED", 401);
  if (!isAdmin(session.user.roles)) throw new AppError("Forbidden", "FORBIDDEN", 403);
  return session;
}

export async function GET(_req: Request, { params }: Params) {
  try {
    await requireAdmin();
    const { id } = await params;
    return apiSuccess(await getNutritionistDetailForAdmin(id));
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    await requireAdmin();
    const { id } = await params;
    await adminDeleteNutritionist(id);
    return apiSuccess({ deleted: true });
  } catch (error) {
    return apiError(error);
  }
}
