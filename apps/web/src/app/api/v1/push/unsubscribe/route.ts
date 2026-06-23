import { withApiHandler } from "@/server/api/with-api-handler";
import { removePushSubscription } from "@/server/services/push.service";
import { pushUnsubscribeSchema } from "@zindagi/validators";

export const DELETE = withApiHandler(
  async ({ session, body }) => {
    await removePushSubscription(session!.user!.id, body.endpoint);
    return { unsubscribed: true };
  },
  { auth: true, bodySchema: pushUnsubscribeSchema },
);
