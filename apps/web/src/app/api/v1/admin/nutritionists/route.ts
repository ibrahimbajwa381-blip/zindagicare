import { withApiHandler } from "@/server/api/with-api-handler";
import { listAllNutritionists } from "@/server/services/admin-nutritionist.service";

export const GET = withApiHandler(
  async ({ searchParams }) => ({
    nutritionists: await listAllNutritionists(
      searchParams.get("search") ?? undefined,
      searchParams.get("status") ?? undefined,
    ),
  }),
  { auth: true, roles: ["admin", "super_admin"] },
);
