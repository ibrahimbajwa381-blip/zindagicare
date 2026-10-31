import { ADMIN_PANEL_ROLES } from "@zindagi/shared";
import { withApiHandler } from "@/server/api/with-api-handler";
import { UrgentConsultService } from "@/server/services/urgent-consult.service";

export const GET = withApiHandler(
  async ({ searchParams }) => {
    const scope = searchParams.get("scope");
    if (scope === "history") {
      return UrgentConsultService.listAdminRequestHistory();
    }
    return UrgentConsultService.listAdminRequests();
  },
  { auth: true, roles: ADMIN_PANEL_ROLES },
);
