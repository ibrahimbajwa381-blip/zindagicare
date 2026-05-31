import { withApiHandler } from "@/server/api/with-api-handler";
import { getAdminDashboardStats } from "@/server/services/admin-dashboard.service";
import { Roles } from "@zindagi/shared";

export const GET = withApiHandler(
  async () => getAdminDashboardStats(),
  { auth: true, roles: [Roles.ADMIN, Roles.SUPER_ADMIN] },
);
