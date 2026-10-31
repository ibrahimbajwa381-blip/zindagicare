import { auth } from "@/lib/auth";
import { apiError, apiSuccess } from "@/server/api/response";
import { assertPanelWrite, forPanelViewer } from "@/server/lib/manager-access";
import { adminUpdateDoctor } from "@/server/services/admin-doctor.service";
import { AppError, isAdminPanelUser } from "@zindagi/shared";
import { adminUpdateDoctorSchema } from "@zindagi/validators";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user?.id) throw new AppError("Unauthorized", "UNAUTHORIZED", 401);
    const roles = session.user.roles ?? [];
    if (!isAdminPanelUser(roles)) {
      throw new AppError("Forbidden", "FORBIDDEN", 403);
    }

    const { id } = await params;
    const body = adminUpdateDoctorSchema.parse(await req.json());
    assertPanelWrite(roles, body);
    const doctor = await adminUpdateDoctor(session.user.id, id, body);
    return apiSuccess(forPanelViewer(roles, { doctor }));
  } catch (error) {
    return apiError(error);
  }
}
