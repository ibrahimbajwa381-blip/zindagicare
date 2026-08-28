import { loginSchema } from "@zindagi/validators";
import { AppError } from "@zindagi/shared";
import { withApiHandler } from "@/server/api/with-api-handler";
import { signMobileAccessToken, signMobileRefreshToken } from "@/server/api/mobile-jwt";
import { verifyCredentialsLogin } from "@/server/services/auth.service";

export const POST = withApiHandler(
  async ({ body }) => {
    const payload = await verifyCredentialsLogin(body.email, body.password);
    if (!payload) {
      throw new AppError("Invalid email or password", "INVALID_CREDENTIALS", 401);
    }

    const [accessToken, refreshToken] = await Promise.all([
      signMobileAccessToken(payload.id),
      signMobileRefreshToken(payload.id),
    ]);

    return { accessToken, refreshToken, user: payload };
  },
  { bodySchema: loginSchema, public: true },
);
