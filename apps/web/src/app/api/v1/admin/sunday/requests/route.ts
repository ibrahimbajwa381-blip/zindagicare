import { Roles } from "@zindagi/shared";
import { withApiHandler } from "@/server/api/with-api-handler";
import { SundayConsultService } from "@/server/services/sunday-consult.service";

/** Read-only progress view — doctors pick requests themselves. */
export const GET = withApiHandler(
  async ({ searchParams }) => {
    const date = searchParams.get("date") ?? undefined;
    const requests = await SundayConsultService.listAdminRequests(date);
    return { requests };
  },
  { auth: true, roles: [Roles.ADMIN, Roles.SUPER_ADMIN] },
);
