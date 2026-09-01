import { withApiHandler } from "@/server/api/with-api-handler";
import { getActivitySummary } from "@/server/services/activity-log.service";
import { Roles } from "@zindagi/shared";

export const GET = withApiHandler(
  async () => getActivitySummary(),
  { auth: true, roles: [Roles.ADMIN, Roles.SUPER_ADMIN] },
);
