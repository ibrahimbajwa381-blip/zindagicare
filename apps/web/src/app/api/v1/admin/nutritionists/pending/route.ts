import { withApiHandler } from "@/server/api/with-api-handler";
import { listPendingNutritionistVerifications } from "@/server/services/nutritionist-verification.service";

export const GET = withApiHandler(
  async () => ({ applications: await listPendingNutritionistVerifications() }),
  { auth: true, roles: ["admin", "super_admin"] },
);
