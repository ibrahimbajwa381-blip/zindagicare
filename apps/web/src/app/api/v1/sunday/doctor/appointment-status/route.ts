import {
  appointmentStatusSchema,
  type AppointmentStatusInput,
} from "@zindagi/validators";
import { withApiHandler } from "@/server/api/with-api-handler";
import { SundayConsultService } from "@/server/services/sunday-consult.service";

export const PATCH = withApiHandler<AppointmentStatusInput>(
  async ({ session, body }) => {
    return SundayConsultService.updateAppointmentStatus(
      session!.user!.id,
      body.appointmentId,
      body.status,
      body.doctorNotes,
    );
  },
  { auth: true, roles: ["doctor"], bodySchema: appointmentStatusSchema },
);
