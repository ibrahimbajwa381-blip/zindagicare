import { withApiHandler } from "@/server/api/with-api-handler";
import { listActivityForAdmin } from "@/server/services/activity-log.service";
import { Roles } from "@zindagi/shared";

export const GET = withApiHandler(
  async ({ searchParams }) => {
    const action = searchParams.get("action") ?? undefined;
    const role = searchParams.get("role") ?? undefined;
    const status = searchParams.get("status") ?? undefined;
    const userId = searchParams.get("userId") ?? undefined;
    const visitorId = searchParams.get("visitorId") ?? undefined;
    const page = Number(searchParams.get("page") ?? "1");
    const pageSize = Number(searchParams.get("pageSize") ?? "25");
    return listActivityForAdmin({ action, role, status, userId, visitorId, page, pageSize });
  },
  { auth: true, roles: [Roles.ADMIN, Roles.SUPER_ADMIN] },
);
