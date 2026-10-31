import { withApiHandler } from "@/server/api/with-api-handler";
import { listAdminAppointments } from "@/server/services/admin-appointment.service";
import { ADMIN_PANEL_ROLES } from "@zindagi/shared";

export const GET = withApiHandler(
  async ({ searchParams }) => {
    const type = searchParams.get("type") as
      | "online"
      | "sunday"
      | "home"
      | "clinic"
      | null;
    const status = searchParams.get("status") ?? undefined;
    const patientId = searchParams.get("patientId") ?? undefined;
    const appointments = await listAdminAppointments({
      type: type ?? undefined,
      status,
      patientId,
    });
    return { appointments };
  },
  { auth: true, roles: ADMIN_PANEL_ROLES },
);
