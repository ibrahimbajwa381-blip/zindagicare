import { withApiHandler } from "@/server/api/with-api-handler";
import { getNutritionistEarnings } from "@/server/services/nutritionist-dashboard.service";

export const GET = withApiHandler(
  async ({ session }) => getNutritionistEarnings(session!.user.id),
  { auth: true, roles: ["nutritionist"] },
);
