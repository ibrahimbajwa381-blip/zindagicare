import { auth } from "@/lib/auth";
import { apiError, apiSuccess } from "@/server/api/response";
import { PrescriptionService } from "@/server/services/prescription.service";
import { AppError } from "@zindagi/shared";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new AppError("Unauthorized", "UNAUTHORIZED", 401);
    }

    const { id } = await params;
    const data = await PrescriptionService.getById(
      session.user.id,
      session.user.roles ?? [],
      id,
    );
    return apiSuccess(data);
  } catch (error) {
    return apiError(error);
  }
}
