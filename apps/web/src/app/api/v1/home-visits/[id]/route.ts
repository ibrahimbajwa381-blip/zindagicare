import { resolveSession } from "@/server/api/resolve-session";
import { apiError, apiSuccess } from "@/server/api/response";
import { HomeVisitService } from "@/server/services/home-visit.service";
import { AppError } from "@zindagi/shared";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Params) {
  try {
    const session = await resolveSession(req);
    if (!session?.user?.id) {
      throw new AppError("Unauthorized", "UNAUTHORIZED", 401);
    }

    const { id } = await params;
    const visit = await HomeVisitService.getById(
      id,
      session.user.id,
      session.user.roles ?? [],
    );
    return apiSuccess(visit);
  } catch (error) {
    return apiError(error);
  }
}
