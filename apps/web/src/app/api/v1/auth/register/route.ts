import { registerSchema } from "@zindagi/validators";
import { withApiHandler } from "@/server/api/with-api-handler";
import { registerWithCredentials } from "@/server/services/auth.service";

export const POST = withApiHandler(
  async ({ body }) => {
    const user = await registerWithCredentials(body);
    return {
      id: user._id.toString(),
      email: user.email,
      message: "Account created. Sign in to continue.",
    };
  },
  { bodySchema: registerSchema },
);
