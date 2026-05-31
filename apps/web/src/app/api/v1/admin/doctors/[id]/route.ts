import { auth } from "@/lib/auth";
import { apiError, apiSuccess } from "@/server/api/response";
import { getDoctorProfileForAdmin } from "@/server/services/doctor-profile.service";
import { AppError } from "@zindagi/shared";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new AppError("Unauthorized", "UNAUTHORIZED", 401);
    }

    const roles = session.user.roles ?? [];
    if (!roles.includes("admin") && !roles.includes("super_admin")) {
      throw new AppError("Forbidden", "FORBIDDEN", 403);
    }

    const { id } = await params;
    const profile = await getDoctorProfileForAdmin(id);
    return apiSuccess(profile);
  } catch (error) {
    return apiError(error);
  }
}
