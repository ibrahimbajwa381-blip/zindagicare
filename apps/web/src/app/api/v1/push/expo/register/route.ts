import { withApiHandler } from "@/server/api/with-api-handler";
import { upsertExpoPushToken } from "@/server/services/push.service";
import { expoPushRegisterSchema } from "@zindagi/validators";

export const POST = withApiHandler(
  async ({ session, body }) => {
    const userId = session!.user!.id;
    await upsertExpoPushToken(userId, body);
    return { registered: true };
  },
  { auth: true, bodySchema: expoPushRegisterSchema },
);
