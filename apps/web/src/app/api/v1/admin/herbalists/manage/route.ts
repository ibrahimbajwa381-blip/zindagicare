import { withApiHandler } from "@/server/api/with-api-handler";
import { adminCreateHerbalist } from "@/server/services/admin-herbalist.service";
import { adminCreateHerbalistSchema } from "@zindagi/validators";
import { ADMIN_PANEL_ROLES } from "@zindagi/shared";

export const POST = withApiHandler(
  async ({ body }) => adminCreateHerbalist(body),
  {
    auth: true,
    roles: ADMIN_PANEL_ROLES,
    bodySchema: adminCreateHerbalistSchema,
  },
);
