import { createAdminPayoutPostHandler } from "@/server/api/admin-provider-payout-handlers";
import { recordHerbalistPayout } from "@/server/services/admin-herbalist-finance.service";

export const POST = createAdminPayoutPostHandler(recordHerbalistPayout);
