import { withApiHandler } from "@/server/api/with-api-handler";
import { markNotificationRead } from "@/server/services/notification.service";

type Params = { params: Promise<{ notificationId: string }> };

export async function PATCH(req: Request, { params }: Params) {
  const { notificationId } = await params;

  const handler = withApiHandler(
    async ({ session }) => {
      return markNotificationRead(session!.user!.id, notificationId);
    },
    { auth: true },
  );

  return handler(req as never);
}
