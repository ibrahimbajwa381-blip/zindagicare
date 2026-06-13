import {
  confirmBookingSchema,
  type ConfirmBookingInput,
} from "@zindagi/validators";
import { withApiHandler } from "@/server/api/with-api-handler";
import { SundayConsultService } from "@/server/services/sunday-consult.service";

export const POST = withApiHandler<ConfirmBookingInput>(
  async ({ session, body }) =>
    SundayConsultService.confirmBooking(
      session!.user!.id,
      body.doctorId,
      body.instanceId,
      body.slotId,
      body.holdToken,
      body.patientNotes,
      body.locale,
    ),
  { auth: true, bodySchema: confirmBookingSchema },
);
