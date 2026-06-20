import { withApiHandler } from "@/server/api/with-api-handler";
import {
  getAdminFinancesOverview,
  updateAdminFinancesPlatformSettings,
} from "@/server/services/admin-finances.service";
import { Roles } from "@zindagi/shared";
import { adminCommissionSettingsSchema } from "@zindagi/validators";

export const GET = withApiHandler(
  async () => getAdminFinancesOverview(),
  { auth: true, roles: [Roles.ADMIN, Roles.SUPER_ADMIN] },
);

export const PATCH = withApiHandler(
  async ({ body }) => updateAdminFinancesPlatformSettings(body),
  {
    auth: true,
    roles: [Roles.ADMIN, Roles.SUPER_ADMIN],
    bodySchema: adminCommissionSettingsSchema,
  },
);
