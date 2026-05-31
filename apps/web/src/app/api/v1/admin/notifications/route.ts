import { withApiHandler } from "@/server/api/with-api-handler";
import { adminSendNotification } from "@/server/services/notification.service";
import { Roles } from "@zindagi/shared";
import { adminSendNotificationSchema } from "@zindagi/validators";

export const POST = withApiHandler(
  async ({ body }) => adminSendNotification(body),
  {
    auth: true,
    roles: [Roles.ADMIN, Roles.SUPER_ADMIN],
    bodySchema: adminSendNotificationSchema,
  },
);
