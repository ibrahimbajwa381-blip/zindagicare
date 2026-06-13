import { auth } from "@/lib/auth";
import { apiError, apiSuccess } from "@/server/api/response";
import { HomeVisitService } from "@/server/services/home-visit.service";
import { AppError, Roles } from "@zindagi/shared";

export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new AppError("Unauthorized", "UNAUTHORIZED", 401);
    }

    const roles = session.user.roles ?? [];
    if (!roles.includes(Roles.ADMIN) && !roles.includes(Roles.SUPER_ADMIN)) {
      throw new AppError("Forbidden", "FORBIDDEN", 403);
    }

    const visitId = new URL(req.url).searchParams.get("visitId");
    if (visitId) {
      const staff = await HomeVisitService.listStaffForVisit(visitId);
      return apiSuccess(staff);
    }

    const staff = await HomeVisitService.listAvailableStaff();
    return apiSuccess(staff);
  } catch (error) {
    return apiError(error);
  }
}
