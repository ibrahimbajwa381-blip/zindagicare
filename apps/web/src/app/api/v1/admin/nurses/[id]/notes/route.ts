import { auth } from "@/lib/auth";
import { apiError, apiSuccess } from "@/server/api/response";
import { updateNurseAdminNotes } from "@/server/services/nurse.service";
import { AppError, Roles } from "@zindagi/shared";
import { adminNurseNotesSchema } from "@zindagi/validators";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user?.id) throw new AppError("Unauthorized", "UNAUTHORIZED", 401);
    const roles = session.user.roles ?? [];
    if (!roles.includes(Roles.ADMIN) && !roles.includes(Roles.SUPER_ADMIN)) {
      throw new AppError("Forbidden", "FORBIDDEN", 403);
    }

    const { id } = await params;
    const body = adminNurseNotesSchema.parse(await req.json());
    const result = await updateNurseAdminNotes(id, body.notes);
    return apiSuccess(result);
  } catch (error) {
    return apiError(error);
  }
}
