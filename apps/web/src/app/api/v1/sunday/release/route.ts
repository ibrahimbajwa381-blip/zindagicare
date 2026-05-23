import { releaseHoldSchema, type ReleaseHoldInput } from "@zindagi/validators";
import { withApiHandler } from "@/server/api/with-api-handler";
import { SundayConsultService } from "@/server/services/sunday-consult.service";

export const POST = withApiHandler<ReleaseHoldInput>(
  async ({ session, body }) => {
    return SundayConsultService.releaseHold(
      session!.user!.id,
      body.instanceId,
      body.slotId,
      body.holdToken,
    );
  },
  { auth: true, bodySchema: releaseHoldSchema },
);
