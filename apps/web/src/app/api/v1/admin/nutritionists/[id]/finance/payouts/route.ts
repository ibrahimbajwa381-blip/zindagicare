import { createAdminPayoutPostHandler } from "@/server/api/admin-provider-payout-handlers";
import { recordNutritionistPayout } from "@/server/services/admin-nutritionist-finance.service";

export const POST = createAdminPayoutPostHandler(recordNutritionistPayout);
