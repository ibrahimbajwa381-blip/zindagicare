import { withApiHandler } from "@/server/api/with-api-handler";
import { getNutritionistDashboardSummary } from "@/server/services/nutritionist-dashboard.service";

export const GET = withApiHandler(
  async ({ session }) => getNutritionistDashboardSummary(session!.user.id),
  { auth: true, roles: ["nutritionist"] },
);
