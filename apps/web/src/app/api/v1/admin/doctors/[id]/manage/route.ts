import { auth } from "@/lib/auth";
import { apiError, apiSuccess } from "@/server/api/response";
import { adminUpdateDoctor } from "@/server/services/admin-doctor.service";
import { AppError, Roles } from "@zindagi/shared";
import { adminUpdateDoctorSchema } from "@zindagi/validators";

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
    const body = adminUpdateDoctorSchema.parse(await req.json());
    const doctor = await adminUpdateDoctor(session.user.id, id, body);
    return apiSuccess({ doctor });
  } catch (error) {
    return apiError(error);
  }
}
