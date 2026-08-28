import { withApiHandler } from "@/server/api/with-api-handler";
import { listUsersForAdmin } from "@/server/services/admin-user-analytics.service";
import { Roles } from "@zindagi/shared";

export const GET = withApiHandler(
  async ({ searchParams }) => {
    const search = searchParams.get("search") ?? undefined;
    const role = searchParams.get("role") ?? undefined;
    const city = searchParams.get("city") ?? undefined;
    const page = Number(searchParams.get("page") ?? "1");
    const pageSize = Number(searchParams.get("pageSize") ?? "20");
    return listUsersForAdmin({ search, role, city, page, pageSize });
  },
  { auth: true, roles: [Roles.ADMIN, Roles.SUPER_ADMIN] },
);
