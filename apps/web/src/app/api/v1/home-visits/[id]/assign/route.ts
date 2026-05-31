import { auth } from "@/lib/auth";
import { apiError, apiSuccess } from "@/server/api/response";
import { HomeVisitService } from "@/server/services/home-visit.service";
import { AppError, Roles } from "@zindagi/shared";
import { assignHomeVisitSchema } from "@zindagi/validators";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new AppError("Unauthorized", "UNAUTHORIZED", 401);
    }

    const roles = session.user.roles ?? [];
    if (!roles.includes(Roles.ADMIN) && !roles.includes(Roles.SUPER_ADMIN)) {
      throw new AppError("Forbidden", "FORBIDDEN", 403);
    }

    const { id } = await params;
    const json = await req.json();
    const body = assignHomeVisitSchema.parse(json);
    const result = await HomeVisitService.assignStaff(id, body);
    return apiSuccess(result);
  } catch (error) {
    return apiError(error);
  }
}
