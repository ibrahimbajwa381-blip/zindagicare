import { withApiHandler } from "@/server/api/with-api-handler";
import { getPlatformCommissionSettings } from "@/server/services/system-settings.service";
import { Roles } from "@zindagi/shared";

/** @deprecated Use /api/v1/admin/finances */
export const GET = withApiHandler(
  async () => getPlatformCommissionSettings(),
  { auth: true, roles: [Roles.ADMIN, Roles.SUPER_ADMIN] },
);
