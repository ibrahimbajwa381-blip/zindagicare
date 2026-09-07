import { resolveSession } from "@/server/api/resolve-session";
import { apiError, apiSuccess } from "@/server/api/response";
import { HomeVisitService } from "@/server/services/home-visit.service";
import { AppError, Roles } from "@zindagi/shared";
import { adminResolveCancellationRequestSchema } from "@zindagi/validators";

type Params = { params: Promise<{ id: string }> };

/** Admin approves (marks the payment refunded) or denies a patient's pending home-visit refund request. */
export async function POST(req: Request, { params }: Params) {
  try {
    const session = await resolveSession(req);
    const roles = session?.user?.roles ?? [];
    if (!session?.user?.id) {
      throw new AppError("Unauthorized", "UNAUTHORIZED", 401);
    }
    if (!roles.includes(Roles.ADMIN) && !roles.includes(Roles.SUPER_ADMIN)) {
      throw new AppError("Forbidden", "FORBIDDEN", 403);
    }

    const { id } = await params;
    const body = adminResolveCancellationRequestSchema.parse(await req.json());
    const result = await HomeVisitService.resolveCancellationRequest(
      id,
      session.user.id,
      body.action,
    );
    return apiSuccess(result);
  } catch (error) {
    return apiError(error);
  }
}
