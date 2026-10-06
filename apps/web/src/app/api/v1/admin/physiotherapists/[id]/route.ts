import { auth } from "@/lib/auth";
import { apiError, apiSuccess } from "@/server/api/response";
import { getPhysiotherapistProfileForAdmin } from "@/server/services/physiotherapist.service";
import { adminDeletePhysiotherapist } from "@/server/services/admin-physiotherapist.service";
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
    const profile = await getPhysiotherapistProfileForAdmin(id);
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
    if (!roles.includes("admin") && !roles.includes("super_admin")) {
      throw new AppError("Only admins can permanently delete a physiotherapist", "FORBIDDEN", 403);
    }

    const { id } = await params;
    await adminDeletePhysiotherapist(session.user.id, id);
    return apiSuccess({ deleted: true });
  } catch (error) {
    return apiError(error);
  }
}
