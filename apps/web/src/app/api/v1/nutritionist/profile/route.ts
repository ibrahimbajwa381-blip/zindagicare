import { withApiHandler } from "@/server/api/with-api-handler";
import {
  getNutritionistProfile,
  updateNutritionistProfile,
} from "@/server/services/nutritionist-profile.service";
import { updateNutritionistProfileSchema } from "@zindagi/validators";

export const GET = withApiHandler(
  async ({ session }) => getNutritionistProfile(session!.user.id),
  { auth: true, roles: ["nutritionist"] },
);

export const PATCH = withApiHandler(
  async ({ session, body }) => updateNutritionistProfile(session!.user.id, body),
  {
    auth: true,
    roles: ["nutritionist"],
    bodySchema: updateNutritionistProfileSchema,
  },
);
