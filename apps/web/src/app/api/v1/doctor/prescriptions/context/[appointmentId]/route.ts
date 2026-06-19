import { auth } from "@/lib/auth";
import { apiError, apiSuccess } from "@/server/api/response";
import { PrescriptionService } from "@/server/services/prescription.service";
import { AppError } from "@zindagi/shared";

type Params = { params: Promise<{ appointmentId: string }> };

export async function GET(_req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new AppError("Unauthorized", "UNAUTHORIZED", 401);
    }

    if (!session.user.roles?.includes("doctor")) {
      throw new AppError("Forbidden", "FORBIDDEN", 403);
    }

    const { appointmentId } = await params;
    const data = await PrescriptionService.getAppointmentContextForDoctor(
      session.user.id,
      appointmentId,
    );
    return apiSuccess(data);
  } catch (error) {
    return apiError(error);
  }
}
