import { auth } from "@/lib/auth";
import { apiError, apiSuccess } from "@/server/api/response";
import { AppError, isAdmin } from "@zindagi/shared";
import { updateNutritionistBankAccount } from "@/server/services/admin-nutritionist-finance.service";
import { nutritionistBankAccountSchema } from "@zindagi/validators";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user?.id) throw new AppError("Unauthorized", "UNAUTHORIZED", 401);
    if (!isAdmin(session.user.roles)) {
      throw new AppError("Forbidden", "FORBIDDEN", 403);
    }

    const { id } = await params;
    const body = nutritionistBankAccountSchema.parse(await req.json());
    const bankAccount = await updateNutritionistBankAccount(id, body);
    return apiSuccess({ bankAccount });
  } catch (error) {
    return apiError(error);
  }
}
