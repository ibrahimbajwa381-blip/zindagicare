import { auth } from "@/lib/auth";
import { apiError, apiSuccess } from "@/server/api/response";
import { getDoctorProfileForAdmin } from "@/server/services/doctor-profile.service";
import { adminDeleteDoctor } from "@/server/services/admin-doctor.service";
import { AppError, Roles } from "@zindagi/shared";

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

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new AppError("Unauthorized", "UNAUTHORIZED", 401);
    }

    const roles = session.user.roles ?? [];
    if (!roles.includes(Roles.SUPER_ADMIN)) {
      throw new AppError(
        "Only super admins can permanently delete a doctor",
        "FORBIDDEN",
        403,
      );
    }

    const { id } = await params;
    await adminDeleteDoctor(id);
    return apiSuccess({ deleted: true });
  } catch (error) {
    return apiError(error);
  }
}
