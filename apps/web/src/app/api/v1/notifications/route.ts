import { withApiHandler } from "@/server/api/with-api-handler";
import { listUserNotifications } from "@/server/services/notification.service";

export const GET = withApiHandler(
  async ({ session }) => {
    return listUserNotifications(session!.user!.id);
  },
  { auth: true },
);
