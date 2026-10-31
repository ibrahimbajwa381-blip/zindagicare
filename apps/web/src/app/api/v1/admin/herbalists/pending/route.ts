import { withApiHandler } from "@/server/api/with-api-handler";
import { listPendingHerbalistVerifications } from "@/server/services/herbalist-verification.service";
import { ADMIN_PANEL_ROLES } from "@zindagi/shared";

export const GET = withApiHandler(
  async () => ({ applications: await listPendingHerbalistVerifications() }),
  { auth: true, roles: ADMIN_PANEL_ROLES },
);
