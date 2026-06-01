import {
  confirmBookingSchema,
  type ConfirmBookingInput,
} from "@zindagi/validators";
import { withApiHandler } from "@/server/api/with-api-handler";
import { SundayConsultService } from "@/server/services/sunday-consult.service";

export const POST = withApiHandler<ConfirmBookingInput>(
<<<<<<< HEAD
  async ({ session, body }) =>
    SundayConsultService.confirmBooking(
=======
  async ({ session, body }) => {
    const appointment = await SundayConsultService.confirmBooking(
>>>>>>> de54e62 (google verification)
      session!.user!.id,
      body.doctorId,
      body.instanceId,
      body.slotId,
      body.holdToken,
      body.patientNotes,
<<<<<<< HEAD
    ),
=======
    );
    return {
      appointmentId: appointment._id.toString(),
      scheduledStart: appointment.scheduledStart,
      scheduledEnd: appointment.scheduledEnd,
      status: appointment.status,
    };
  },
>>>>>>> de54e62 (google verification)
  { auth: true, bodySchema: confirmBookingSchema },
);
