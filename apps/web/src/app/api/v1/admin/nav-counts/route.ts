import { withApiHandler } from "@/server/api/with-api-handler";
import { getAdminNavCounts } from "@/server/services/admin-dashboard.service";
import { Roles } from "@zindagi/shared";

export const GET = withApiHandler(
  async () => getAdminNavCounts(),
  { auth: true, roles: [Roles.ADMIN, Roles.SUPER_ADMIN] },
);
