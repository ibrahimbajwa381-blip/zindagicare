import { mobileRefreshTokenSchema } from "@zindagi/validators";
import { AppError } from "@zindagi/shared";
import { withApiHandler } from "@/server/api/with-api-handler";
import { verifyMobileToken, signMobileAccessToken, signMobileRefreshToken } from "@/server/api/mobile-jwt";
import { loadAuthUserPayload } from "@/server/services/auth.service";

export const POST = withApiHandler(
  async ({ body }) => {
    let sub: string;
    try {
      ({ sub } = await verifyMobileToken(body.refreshToken, "refresh"));
    } catch {
      throw new AppError("Invalid or expired refresh token", "INVALID_REFRESH_TOKEN", 401);
    }

    const payload = await loadAuthUserPayload(sub);
    if (!payload) {
      throw new AppError("Account is not active", "ACCOUNT_INACTIVE", 403);
    }

    const [accessToken, refreshToken] = await Promise.all([
      signMobileAccessToken(payload.id),
      signMobileRefreshToken(payload.id),
    ]);

    return { accessToken, refreshToken, user: payload };
  },
  { bodySchema: mobileRefreshTokenSchema, public: true },
);
