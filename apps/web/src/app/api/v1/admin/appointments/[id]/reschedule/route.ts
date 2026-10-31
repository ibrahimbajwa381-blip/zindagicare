import { auth } from "@/lib/auth";
import { apiError, apiSuccess } from "@/server/api/response";
import { forPanelViewer } from "@/server/lib/manager-access";
import { adminRescheduleAppointment } from "@/server/services/admin-appointment.service";
import { AppError, isAdminPanelUser } from "@zindagi/shared";
import { adminRescheduleAppointmentSchema } from "@zindagi/validators";

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
    const body = adminRescheduleAppointmentSchema.parse(await req.json());
    const result = await adminRescheduleAppointment(id, body.scheduledStart, body.scheduledEnd);
    return apiSuccess(forPanelViewer(roles, result));
  } catch (error) {
    return apiError(error);
  }
}
