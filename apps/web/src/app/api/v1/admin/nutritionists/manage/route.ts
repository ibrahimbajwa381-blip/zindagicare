import { withApiHandler } from "@/server/api/with-api-handler";
import { adminCreateNutritionist } from "@/server/services/admin-nutritionist.service";
import { adminCreateNutritionistSchema } from "@zindagi/validators";

export const POST = withApiHandler(
  async ({ body }) => adminCreateNutritionist(body),
  {
    auth: true,
    roles: ["admin", "super_admin"],
    bodySchema: adminCreateNutritionistSchema,
  },
);
