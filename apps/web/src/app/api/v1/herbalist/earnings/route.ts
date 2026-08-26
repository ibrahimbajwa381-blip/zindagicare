import { withApiHandler } from "@/server/api/with-api-handler";
import { getHerbalistEarnings } from "@/server/services/herbalist-dashboard.service";

export const GET = withApiHandler(
  async ({ session }) => getHerbalistEarnings(session!.user.id),
  { auth: true, roles: ["herbalist"] },
);
