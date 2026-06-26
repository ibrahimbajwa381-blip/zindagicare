import { withApiHandler } from "@/server/api/with-api-handler";
import { PatientAppointmentsService } from "@/server/services/patient-appointments.service";

export const GET = withApiHandler(
  async ({ session }) =>
    PatientAppointmentsService.listHistory(session!.user!.id),
  { auth: true },
);
