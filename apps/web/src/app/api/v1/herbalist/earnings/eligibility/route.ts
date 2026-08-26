import { withApiHandler } from "@/server/api/with-api-handler";
import { getOwnHerbalistEarningEligibility } from "@/server/services/admin-herbalist-finance.service";

export const GET = withApiHandler(
  async ({ session }) => getOwnHerbalistEarningEligibility(session!.user.id),
  { auth: true, roles: ["herbalist"] },
);
