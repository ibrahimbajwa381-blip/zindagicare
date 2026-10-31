import { auth } from "@/lib/auth";
import { apiError, apiSuccess } from "@/server/api/response";
import { assertPanelWrite, forPanelViewer } from "@/server/lib/manager-access";
import { AppError, isAdminPanelUser } from "@zindagi/shared";
import { adminUpdateHerbalist } from "@/server/services/admin-herbalist.service";
import { adminUpdateHerbalistSchema } from "@zindagi/validators";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user?.id) throw new AppError("Unauthorized", "UNAUTHORIZED", 401);
    if (!isAdminPanelUser(session.user.roles)) {
      throw new AppError("Forbidden", "FORBIDDEN", 403);
    }

    const { id } = await params;
    const body = adminUpdateHerbalistSchema.parse(await req.json());
    assertPanelWrite(session.user.roles, body);
    return apiSuccess(forPanelViewer(session.user.roles, await adminUpdateHerbalist(session.user.id, id, body)));
  } catch (error) {
    return apiError(error);
  }
}
