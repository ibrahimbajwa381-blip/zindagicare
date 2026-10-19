import { createAdminPayoutReceiptGetHandler } from "@/server/api/admin-provider-payout-handlers";
import { getHerbalistPayoutReceiptStorageKey } from "@/server/services/admin-herbalist-finance.service";

export const GET = createAdminPayoutReceiptGetHandler(getHerbalistPayoutReceiptStorageKey);
