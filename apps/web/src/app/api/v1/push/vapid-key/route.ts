import { withApiHandler } from "@/server/api/with-api-handler";
import { isWebPushConfigured } from "@/server/services/push.service";

export const GET = withApiHandler(
  async () => {
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null;
    return {
      configured: isWebPushConfigured(),
      publicKey,
    };
  },
  { public: true },
);
