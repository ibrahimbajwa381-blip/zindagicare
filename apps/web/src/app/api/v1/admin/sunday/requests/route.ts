import { ADMIN_PANEL_ROLES } from "@zindagi/shared";
import { withApiHandler } from "@/server/api/with-api-handler";
import { SundayConsultService } from "@/server/services/sunday-consult.service";

/**
 * Progress view — doctors pick requests themselves; admins can also assign (see [id]/assign).
 * `?date=YYYY-MM-DD` for one Sunday, `?date=all` for full history.
 */
export const GET = withApiHandler(
  async ({ searchParams }) => {
    const date = searchParams.get("date") ?? undefined;
    const [requests, dates] = await Promise.all([
      SundayConsultService.listAdminRequests(date),
      SundayConsultService.listAdminRequestDates(),
    ]);
    return { requests, dates };
  },
  { auth: true, roles: ADMIN_PANEL_ROLES },
);
