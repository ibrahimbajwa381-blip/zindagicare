import { auth } from "@/lib/auth";
import { apiError, apiSuccess } from "@/server/api/response";
import { forPanelViewer } from "@/server/lib/manager-access";
import { adminCancelAppointment } from "@/server/services/admin-appointment.service";
import { AppError, isAdminPanelUser } from "@zindagi/shared";
import { adminCancelAppointmentSchema } from "@zindagi/validators";

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
    const body = adminCancelAppointmentSchema.parse(await req.json().catch(() => ({})));
    const result = await adminCancelAppointment(id, session.user.id, body.reason, {
      id: session.user.id,
      roles,
      name: session.user.name,
      email: session.user.email,
    });
    return apiSuccess(forPanelViewer(roles, result));
  } catch (error) {
    return apiError(error);
  }
}
