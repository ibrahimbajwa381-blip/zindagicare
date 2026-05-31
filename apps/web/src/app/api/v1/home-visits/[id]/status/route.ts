import { auth } from "@/lib/auth";
import { apiError, apiSuccess } from "@/server/api/response";
import { HomeVisitService } from "@/server/services/home-visit.service";
import { AppError } from "@zindagi/shared";
import { updateHomeVisitStatusSchema } from "@zindagi/validators";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new AppError("Unauthorized", "UNAUTHORIZED", 401);
    }

    const { id } = await params;
    const json = await req.json();
    const body = updateHomeVisitStatusSchema.parse(json);

    const visit = await HomeVisitService.updateStatus(
      id,
      session.user.id,
      session.user.roles ?? [],
      body,
    );
    return apiSuccess(visit);
  } catch (error) {
    return apiError(error);
  }
}
