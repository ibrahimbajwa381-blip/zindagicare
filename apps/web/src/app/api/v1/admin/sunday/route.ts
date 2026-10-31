import { withApiHandler } from "@/server/api/with-api-handler";
import {
  getAdminSundayOverview,
  updateAdminSundaySettings,
} from "@/server/services/admin-sunday.service";
import { ADMIN_PANEL_ROLES } from "@zindagi/shared";
import { adminSundaySettingsSchema } from "@zindagi/validators";

export const GET = withApiHandler(
  async ({ searchParams }) => {
    const dateKey = searchParams.get("date") ?? undefined;
    return getAdminSundayOverview(dateKey);
  },
  { auth: true, roles: ADMIN_PANEL_ROLES },
);

export const PATCH = withApiHandler(
  async ({ body }) => updateAdminSundaySettings(body),
  {
    auth: true,
    roles: ADMIN_PANEL_ROLES,
    bodySchema: adminSundaySettingsSchema,
  },
);
