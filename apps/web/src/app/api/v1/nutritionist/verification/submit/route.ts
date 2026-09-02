import { withApiHandler } from "@/server/api/with-api-handler";
import { submitNutritionistVerification } from "@/server/services/nutritionist-verification.service";
import { nutritionistVerificationSchema } from "@zindagi/validators";

export const POST = withApiHandler(
  async ({ session, body }) => {
    const profile = await submitNutritionistVerification(session!.user.id, body);
    return { id: profile._id.toString(), status: profile.verificationStatus };
  },
  {
    auth: true,
    roles: ["nutritionist"],
    bodySchema: nutritionistVerificationSchema,
  },
);
