import { withApiHandler } from "@/server/api/with-api-handler";
import { listAllNutritionists } from "@/server/services/admin-nutritionist.service";
import { ADMIN_PANEL_ROLES } from "@zindagi/shared";

export const GET = withApiHandler(
  async ({ searchParams }) => ({
    nutritionists: await listAllNutritionists(
      searchParams.get("search") ?? undefined,
      searchParams.get("status") ?? undefined,
    ),
  }),
  { auth: true, roles: ADMIN_PANEL_ROLES },
);
