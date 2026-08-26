import { withApiHandler } from "@/server/api/with-api-handler";
import { submitHerbalistVerification } from "@/server/services/herbalist-verification.service";
import { herbalistVerificationSchema } from "@zindagi/validators";

export const POST = withApiHandler(
  async ({ session, body }) => {
    const profile = await submitHerbalistVerification(session!.user.id, body);
    return { id: profile._id.toString(), status: profile.verificationStatus };
  },
  {
    auth: true,
    roles: ["herbalist"],
    bodySchema: herbalistVerificationSchema,
  },
);
