import { withApiHandler } from "@/server/api/with-api-handler";
import { upsertPushSubscription } from "@/server/services/push.service";
import { pushSubscribeSchema } from "@zindagi/validators";

export const POST = withApiHandler(
  async ({ session, body, req }) => {
    const userId = session!.user!.id;
    const userAgent = req.headers.get("user-agent");
    await upsertPushSubscription(userId, body, userAgent);
    return { subscribed: true };
  },
  { auth: true, bodySchema: pushSubscribeSchema },
);
