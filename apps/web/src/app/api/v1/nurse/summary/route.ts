import { withApiHandler } from "@/server/api/with-api-handler";
import { getNurseDashboardSummary } from "@/server/services/nurse.service";

export const GET = withApiHandler(
  async ({ session }) => {
    return getNurseDashboardSummary(session!.user.id);
  },
  { auth: true, roles: ["nurse"] },
);
