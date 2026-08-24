import { withApiHandler } from "@/server/api/with-api-handler";
import { getAdminPatientStats } from "@/server/services/admin-patient-stats.service";
import { Roles } from "@zindagi/shared";

export const GET = withApiHandler(
  async () => getAdminPatientStats(),
  { auth: true, roles: [Roles.ADMIN, Roles.SUPER_ADMIN] },
);
