import { withApiHandler } from "@/server/api/with-api-handler";
import { getOwnNutritionistEarningEligibility } from "@/server/services/admin-nutritionist-finance.service";

export const GET = withApiHandler(
  async ({ session }) => getOwnNutritionistEarningEligibility(session!.user.id),
  { auth: true, roles: ["nutritionist"] },
);
