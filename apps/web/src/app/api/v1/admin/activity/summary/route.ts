import { withApiHandler } from "@/server/api/with-api-handler";
import {
  getActivitySummary,
  parseActivityRange,
} from "@/server/services/activity-log.service";
import { ADMIN_PANEL_ROLES } from "@zindagi/shared";

export const GET = withApiHandler(
  async ({ searchParams }) => getActivitySummary(parseActivityRange(searchParams.get("range"))),
  { auth: true, roles: ADMIN_PANEL_ROLES },
);
