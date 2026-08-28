import { withApiHandler } from "@/server/api/with-api-handler";
import { getUserAnalyticsSummary } from "@/server/services/admin-user-analytics.service";
import { Roles } from "@zindagi/shared";

export const GET = withApiHandler(
  async () => getUserAnalyticsSummary(),
  { auth: true, roles: [Roles.ADMIN, Roles.SUPER_ADMIN] },
);
