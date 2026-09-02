import { withApiHandler } from "@/server/api/with-api-handler";
import { listNutritionistConsultRequests } from "@/server/services/nutritionist-dashboard.service";

export const GET = withApiHandler(
  async ({ session }) => ({
    requests: await listNutritionistConsultRequests(session!.user.id),
  }),
  { auth: true, roles: ["nutritionist"] },
);
