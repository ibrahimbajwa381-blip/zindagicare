import { withApiHandler } from "@/server/api/with-api-handler";
import { getAdminPlatformEarnings } from "@/server/services/admin-platform-earnings.service";
import { Roles } from "@zindagi/shared";

export const GET = withApiHandler(
  async () => getAdminPlatformEarnings(),
  { auth: true, roles: [Roles.ADMIN, Roles.SUPER_ADMIN] },
);
