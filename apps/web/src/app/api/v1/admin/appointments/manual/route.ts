import { withApiHandler } from "@/server/api/with-api-handler";
import { adminCreateManualAppointment } from "@/server/services/admin-appointment.service";
import { Roles } from "@zindagi/shared";
import { adminCreateManualAppointmentSchema } from "@zindagi/validators";

export const POST = withApiHandler(
  async ({ body }) => {
    const result = await adminCreateManualAppointment(body);
    return result;
  },
  { auth: true, roles: [Roles.ADMIN, Roles.SUPER_ADMIN], bodySchema: adminCreateManualAppointmentSchema },
);
