import { withApiHandler } from "@/server/api/with-api-handler";
import { listPendingNutritionistVerifications } from "@/server/services/nutritionist-verification.service";
import { ADMIN_PANEL_ROLES } from "@zindagi/shared";

export const GET = withApiHandler(
  async () => ({ applications: await listPendingNutritionistVerifications() }),
  { auth: true, roles: ADMIN_PANEL_ROLES },
);
