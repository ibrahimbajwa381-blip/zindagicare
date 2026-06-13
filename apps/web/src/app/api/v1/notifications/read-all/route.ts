import { withApiHandler } from "@/server/api/with-api-handler";
import { markAllNotificationsRead } from "@/server/services/notification.service";

export const PATCH = withApiHandler(
  async ({ session }) => {
    return markAllNotificationsRead(session!.user!.id);
  },
  { auth: true },
);
