import { resolveSession } from "@/server/api/resolve-session";
import { apiError, apiSuccess } from "@/server/api/response";
import { HomeVisitService } from "@/server/services/home-visit.service";
import { AppError, Roles, isAdmin } from "@zindagi/shared";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  try {
    const session = await resolveSession(req);
    if (!session?.user?.id) {
      throw new AppError("Unauthorized", "UNAUTHORIZED", 401);
    }

    const roles = session.user.roles ?? [];
    const allowed =
      roles.includes(Roles.NURSE) ||
      roles.includes(Roles.PHYSIOTHERAPIST) ||
      roles.includes(Roles.DOCTOR) ||
      isAdmin(roles as never);
    if (!allowed) {
      throw new AppError("Forbidden", "FORBIDDEN", 403);
    }

    const { id } = await params;
    const formData = await req.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      throw new AppError("File is required", "VALIDATION", 400);
    }

    const visit = await HomeVisitService.uploadReport(
      id,
      session.user.id,
      roles,
      file,
    );
    return apiSuccess(visit);
  } catch (error) {
    return apiError(error);
  }
}
