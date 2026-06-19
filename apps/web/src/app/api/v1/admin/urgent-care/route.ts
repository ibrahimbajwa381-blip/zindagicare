import { Roles } from "@zindagi/shared";
import { withApiHandler } from "@/server/api/with-api-handler";
import { UrgentConsultService } from "@/server/services/urgent-consult.service";

export const GET = withApiHandler(
  async () => UrgentConsultService.listAdminRequests(),
  { auth: true, roles: [Roles.ADMIN, Roles.SUPER_ADMIN] },
);
