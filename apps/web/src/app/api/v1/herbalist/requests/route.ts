import { withApiHandler } from "@/server/api/with-api-handler";
import { listHerbalistConsultRequests } from "@/server/services/herbalist-dashboard.service";

export const GET = withApiHandler(
  async ({ session }) => ({
    requests: await listHerbalistConsultRequests(session!.user.id),
  }),
  { auth: true, roles: ["herbalist"] },
);
