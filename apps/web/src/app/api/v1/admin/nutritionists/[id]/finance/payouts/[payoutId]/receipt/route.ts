import { createAdminPayoutReceiptGetHandler } from "@/server/api/admin-provider-payout-handlers";
import { getNutritionistPayoutReceiptStorageKey } from "@/server/services/admin-nutritionist-finance.service";

export const GET = createAdminPayoutReceiptGetHandler(getNutritionistPayoutReceiptStorageKey);
