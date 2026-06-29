import { auth } from "@/lib/auth";
import { apiError, apiSuccess } from "@/server/api/response";
import { revokeAdminAccess } from "@/server/services/admin-users.service";
import { AppError, Roles } from "@zindagi/shared";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user?.id) throw new AppError("Unauthorized", "UNAUTHORIZED", 401);
    const roles = session.user.roles ?? [];
    if (!roles.includes(Roles.ADMIN) && !roles.includes(Roles.SUPER_ADMIN)) {
      throw new AppError("Forbidden", "FORBIDDEN", 403);
    }

    const { id } = await params;
    await revokeAdminAccess(session.user.id, id);
    return apiSuccess({ revoked: true });
  } catch (error) {
    return apiError(error);
  }
}
