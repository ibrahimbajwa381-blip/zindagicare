import { loginSchema } from "@zindagi/validators";
import { AppError, highestRole } from "@zindagi/shared";
import { withApiHandler } from "@/server/api/with-api-handler";
import { signMobileAccessToken, signMobileRefreshToken } from "@/server/api/mobile-jwt";
import { verifyCredentialsLogin } from "@/server/services/auth.service";
import { logActivity } from "@/server/services/activity-log.service";

export const POST = withApiHandler(
  async ({ body }) => {
    const payload = await verifyCredentialsLogin(body.email, body.password);
    if (!payload) {
      await logActivity({
        action: "auth.login",
        status: "error",
        platform: "mobile",
        metadata: { reason: "invalid_credentials" },
      });
      throw new AppError("Invalid email or password", "INVALID_CREDENTIALS", 401);
    }

    const [accessToken, refreshToken] = await Promise.all([
      signMobileAccessToken(payload.id),
      signMobileRefreshToken(payload.id),
    ]);

    await logActivity({
      userId: payload.id,
      userRole: highestRole(payload.roles),
      action: "auth.login",
      platform: "mobile",
    });

    return { accessToken, refreshToken, user: payload };
  },
  {
    bodySchema: loginSchema,
    public: true,
    rateLimit: {
      limit: 20,
      windowMs: 15 * 60_000,
      by: "ip",
      message: "Too many login attempts from this device. Please try again later.",
    },
  },
);
