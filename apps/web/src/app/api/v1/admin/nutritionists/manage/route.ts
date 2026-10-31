import { withApiHandler } from "@/server/api/with-api-handler";
import { adminCreateNutritionist } from "@/server/services/admin-nutritionist.service";
import { adminCreateNutritionistSchema } from "@zindagi/validators";
import { ADMIN_PANEL_ROLES } from "@zindagi/shared";

export const POST = withApiHandler(
  async ({ body }) => adminCreateNutritionist(body),
  {
    auth: true,
    roles: ADMIN_PANEL_ROLES,
    bodySchema: adminCreateNutritionistSchema,
  },
);
