import { auth } from "@/lib/auth";
import { apiError, apiSuccess } from "@/server/api/response";
import { AppError, isAdmin } from "@zindagi/shared";
import { getNutritionistDetailForAdmin } from "@/server/services/admin-nutritionist.service";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user?.id) throw new AppError("Unauthorized", "UNAUTHORIZED", 401);
    if (!isAdmin(session.user.roles)) {
      throw new AppError("Forbidden", "FORBIDDEN", 403);
    }

    const { id } = await params;
    return apiSuccess(await getNutritionistDetailForAdmin(id));
  } catch (error) {
    return apiError(error);
  }
}
