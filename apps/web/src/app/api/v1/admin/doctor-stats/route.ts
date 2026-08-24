import { withApiHandler } from "@/server/api/with-api-handler";
import { getAdminDoctorStats } from "@/server/services/admin-doctor-stats.service";
import { Roles } from "@zindagi/shared";

export const GET = withApiHandler(
  async () => getAdminDoctorStats(),
  { auth: true, roles: [Roles.ADMIN, Roles.SUPER_ADMIN] },
);
