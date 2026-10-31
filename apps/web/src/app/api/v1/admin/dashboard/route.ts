import { withApiHandler } from "@/server/api/with-api-handler";
import { getAdminDashboardStats } from "@/server/services/admin-dashboard.service";
import { ADMIN_PANEL_ROLES } from "@zindagi/shared";

export const GET = withApiHandler(
  async () => getAdminDashboardStats(),
  { auth: true, roles: ADMIN_PANEL_ROLES },
);
