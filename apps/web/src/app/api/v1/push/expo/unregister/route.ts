import { withApiHandler } from "@/server/api/with-api-handler";
import { removeExpoPushToken } from "@/server/services/push.service";
import { expoPushUnregisterSchema } from "@zindagi/validators";

export const DELETE = withApiHandler(
  async ({ session, body }) => {
    await removeExpoPushToken(session!.user!.id, body.token);
    return { unregistered: true };
  },
  { auth: true, bodySchema: expoPushUnregisterSchema },
);
