import {
  confirmBookingSchema,
  type ConfirmBookingInput,
} from "@zindagi/validators";
import { withApiHandler } from "@/server/api/with-api-handler";
import { SundayConsultService } from "@/server/services/sunday-consult.service";

export const POST = withApiHandler<ConfirmBookingInput>(
  async ({ session, body }) => {
    const appointment = await SundayConsultService.confirmBooking(
      session!.user!.id,
      body.doctorId,
      body.instanceId,
      body.slotId,
      body.holdToken,
      body.patientNotes,
    );
    return {
      appointmentId: appointment._id.toString(),
      scheduledStart: appointment.scheduledStart,
      scheduledEnd: appointment.scheduledEnd,
      status: appointment.status,
    };
  },
  { auth: true, bodySchema: confirmBookingSchema },
);
