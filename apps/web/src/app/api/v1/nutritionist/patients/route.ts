import { withApiHandler } from "@/server/api/with-api-handler";
import { listNutritionistPatients } from "@/server/services/nutritionist-dashboard.service";

export const GET = withApiHandler(
  async ({ session }) => ({
    patients: await listNutritionistPatients(session!.user.id),
  }),
  { auth: true, roles: ["nutritionist"] },
);
