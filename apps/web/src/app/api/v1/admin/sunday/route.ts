import { withApiHandler } from "@/server/api/with-api-handler";
import {
  getAdminSundayOverview,
  updateAdminSundaySettings,
} from "@/server/services/admin-sunday.service";
import { Roles } from "@zindagi/shared";
import { adminSundaySettingsSchema } from "@zindagi/validators";

export const GET = withApiHandler(
  async ({ searchParams }) => {
    const dateKey = searchParams.get("date") ?? undefined;
    return getAdminSundayOverview(dateKey);
  },
  { auth: true, roles: [Roles.ADMIN, Roles.SUPER_ADMIN] },
);

export const PATCH = withApiHandler(
  async ({ body }) => updateAdminSundaySettings(body),
  {
    auth: true,
    roles: [Roles.ADMIN, Roles.SUPER_ADMIN],
    bodySchema: adminSundaySettingsSchema,
  },
);
