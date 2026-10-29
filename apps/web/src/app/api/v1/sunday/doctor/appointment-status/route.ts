import {
  appointmentStatusSchema,
  type AppointmentStatusInput,
} from "@zindagi/validators";
import { withApiHandler } from "@/server/api/with-api-handler";
import { ConsultationLifecycleService } from "@/server/services/consultation/consultation-lifecycle.service";
import { SundayConsultService } from "@/server/services/sunday-consult.service";

/**
 * Kept for existing app builds. Finish / no-show use the shared consult
 * lifecycle (same as POST /api/v1/appointments/:id/finish); cancel is Sunday-only.
 */
export const PATCH = withApiHandler<AppointmentStatusInput>(
  async ({ session, body }) => {
    const userId = session!.user!.id;
    if (body.status === "cancelled") {
      return SundayConsultService.cancelAppointment(userId, body.appointmentId, body.doctorNotes);
    }
    return ConsultationLifecycleService.finish(
      body.appointmentId,
      userId,
      body.status,
      body.doctorNotes,
    );
  },
  { auth: true, roles: ["doctor"], bodySchema: appointmentStatusSchema },
);
