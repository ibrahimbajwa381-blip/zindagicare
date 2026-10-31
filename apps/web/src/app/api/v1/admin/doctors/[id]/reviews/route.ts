import { auth } from "@/lib/auth";
import { apiError, apiSuccess } from "@/server/api/response";
import { ReviewService } from "@/server/services/review.service";
import { AppError, isAdminPanelUser } from "@zindagi/shared";
import { adminAddReviewSchema } from "@zindagi/validators";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user?.id) throw new AppError("Unauthorized", "UNAUTHORIZED", 401);
    const roles = session.user.roles ?? [];
    if (!isAdminPanelUser(roles)) {
      throw new AppError("Forbidden", "FORBIDDEN", 403);
    }

    const { id } = await params;
    const body = adminAddReviewSchema.parse(await req.json());
    const review = await ReviewService.adminAddReview(session.user.id, id, body);
    return apiSuccess({ review });
  } catch (error) {
    return apiError(error);
  }
}
