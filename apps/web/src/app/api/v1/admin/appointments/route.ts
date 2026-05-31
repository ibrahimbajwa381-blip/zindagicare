import { withApiHandler } from "@/server/api/with-api-handler";
import { listAdminAppointments } from "@/server/services/admin-appointment.service";
import { Roles } from "@zindagi/shared";

export const GET = withApiHandler(
  async ({ searchParams }) => {
    const type = searchParams.get("type") as
      | "online"
      | "sunday"
      | "home"
      | "clinic"
      | null;
    const status = searchParams.get("status") ?? undefined;
    const appointments = await listAdminAppointments({
      type: type ?? undefined,
      status,
    });
    return { appointments };
  },
  { auth: true, roles: [Roles.ADMIN, Roles.SUPER_ADMIN] },
);
