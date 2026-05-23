import { reserveSlotSchema, type ReserveSlotInput } from "@zindagi/validators";
import { withApiHandler } from "@/server/api/with-api-handler";
import { SundayConsultService } from "@/server/services/sunday-consult.service";

export const POST = withApiHandler<ReserveSlotInput>(
  async ({ session, body }) => {
    return SundayConsultService.reserveSlot(
      session!.user!.id,
      body.doctorId,
      body.instanceId,
      body.slotId,
    );
  },
  { auth: true, bodySchema: reserveSlotSchema },
);
