import { auth } from "@/lib/auth";
import { apiError, apiSuccess } from "@/server/api/response";
import { saveDoctorAvatar } from "@/server/services/doctor-avatar.storage";
import { getDoctorDetailForAdmin } from "@/server/services/admin-doctor.service";
import { AppError, Roles } from "@zindagi/shared";

type Params = { params: Promise<{ id: string }> };

/** Admin uploads a profile photo for a specific doctor. */
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
    const doctor = await getDoctorDetailForAdmin(id);

    const formData = await req.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      throw new AppError("Photo file is required", "VALIDATION_ERROR", 400);
    }

    const stored = await saveDoctorAvatar(doctor.userId, file);
    return apiSuccess(stored);
  } catch (error) {
    return apiError(error);
  }
}
