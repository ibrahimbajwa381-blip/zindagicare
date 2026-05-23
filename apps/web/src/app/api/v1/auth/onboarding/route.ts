import { onboardingSchema } from "@zindagi/validators";
import { withApiHandler } from "@/server/api/with-api-handler";
import { completeOnboarding } from "@/server/services/auth.service";

export const POST = withApiHandler(
  async ({ session, body }) => {
    const payload = await completeOnboarding(session!.user.id, body);
    return { user: payload };
  },
  { auth: true, bodySchema: onboardingSchema },
);
