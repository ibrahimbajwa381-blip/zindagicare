import { withApiHandler } from "@/server/api/with-api-handler";
import { adminSendNotification } from "@/server/services/notification.service";
import { ADMIN_PANEL_ROLES } from "@zindagi/shared";
import { adminSendNotificationSchema } from "@zindagi/validators";

export const POST = withApiHandler(
  async ({ body }) => adminSendNotification(body),
  {
    auth: true,
    roles: ADMIN_PANEL_ROLES,
    bodySchema: adminSendNotificationSchema,
  },
);
