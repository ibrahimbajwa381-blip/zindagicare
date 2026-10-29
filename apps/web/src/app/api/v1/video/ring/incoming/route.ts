import { withApiHandler } from "@/server/api/with-api-handler";
import { VideoRingService } from "@/server/services/video-ring.service";

/** The video call currently ringing for the signed-in user, or null. */
export const GET = withApiHandler(
  async ({ session }) => VideoRingService.getIncoming(session!.user!.id),
  { auth: true },
);
