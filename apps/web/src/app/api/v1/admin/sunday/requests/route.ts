import { Roles } from "@zindagi/shared";
import { withApiHandler } from "@/server/api/with-api-handler";
import { SundayConsultService } from "@/server/services/sunday-consult.service";

export const GET = withApiHandler(
  async ({ searchParams }) => {
    const date = searchParams.get("date") ?? undefined;
    const [requests, doctors] = await Promise.all([
      SundayConsultService.listAdminRequests(date),
      SundayConsultService.listSundayTeamDoctors(),
    ]);
    return { requests, doctors };
  },
  { auth: true, roles: [Roles.ADMIN, Roles.SUPER_ADMIN] },
);
