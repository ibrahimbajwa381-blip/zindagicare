import { auth } from "@/lib/auth";
import { apiError, apiSuccess } from "@/server/api/response";
import {
  adminUpdatePatient,
  getPatientDetail,
} from "@/server/services/admin-patient.service";
import { AppError, Roles } from "@zindagi/shared";
import { adminUpdatePatientSchema } from "@zindagi/validators";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user?.id) throw new AppError("Unauthorized", "UNAUTHORIZED", 401);
    const roles = session.user.roles ?? [];
    if (!roles.includes(Roles.ADMIN) && !roles.includes(Roles.SUPER_ADMIN)) {
      throw new AppError("Forbidden", "FORBIDDEN", 403);
    }

    const { id } = await params;
    const patient = await getPatientDetail(id);
    return apiSuccess({ patient });
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(req: Request, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user?.id) throw new AppError("Unauthorized", "UNAUTHORIZED", 401);
    const roles = session.user.roles ?? [];
    if (!roles.includes(Roles.ADMIN) && !roles.includes(Roles.SUPER_ADMIN)) {
      throw new AppError("Forbidden", "FORBIDDEN", 403);
    }

    const { id } = await params;
    const body = adminUpdatePatientSchema.parse(await req.json());
    const patient = await adminUpdatePatient(id, body);
    return apiSuccess({ patient });
  } catch (error) {
    return apiError(error);
  }
}
