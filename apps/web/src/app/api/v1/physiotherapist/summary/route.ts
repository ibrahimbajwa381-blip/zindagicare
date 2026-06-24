import { withApiHandler } from "@/server/api/with-api-handler";
import { getPhysiotherapistDashboardSummary } from "@/server/services/physiotherapist.service";

export const GET = withApiHandler(
  async ({ session }) => {
    return getPhysiotherapistDashboardSummary(session!.user.id);
  },
  { auth: true, roles: ["physiotherapist"] },
);
