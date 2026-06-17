import { auth } from "@/lib/auth";
import { apiError, apiSuccess } from "@/server/api/response";
import { saveDoctorAvatar } from "@/server/services/doctor-avatar.storage";
import { AppError, Roles } from "@zindagi/shared";

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new AppError("Unauthorized", "UNAUTHORIZED", 401);
    }
    if (!session.user.roles?.includes(Roles.DOCTOR)) {
      throw new AppError("Forbidden", "FORBIDDEN", 403);
    }

    const formData = await req.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      throw new AppError("Photo file is required", "VALIDATION_ERROR", 400);
    }

    const stored = await saveDoctorAvatar(session.user.id, file);
    return apiSuccess(stored);
  } catch (error) {
    return apiError(error);
  }
}
