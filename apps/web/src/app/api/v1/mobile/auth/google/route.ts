import { mobileGoogleSignInSchema } from "@zindagi/validators";
import { AppError } from "@zindagi/shared";
import { withApiHandler } from "@/server/api/with-api-handler";
import { verifyGoogleIdToken, signMobileAccessToken, signMobileRefreshToken } from "@/server/api/mobile-jwt";
import { findOrCreateGoogleUser, loadAuthUserPayload } from "@/server/services/auth.service";

export const POST = withApiHandler(
  async ({ body }) => {
    let googleUser;
    try {
      googleUser = await verifyGoogleIdToken(body.idToken);
    } catch {
      throw new AppError("Invalid Google sign-in", "INVALID_GOOGLE_TOKEN", 401);
    }

    const user = await findOrCreateGoogleUser({
      email: googleUser.email,
      name: googleUser.name,
      image: googleUser.picture,
    });

    const payload = await loadAuthUserPayload(user._id.toString());
    if (!payload) {
      throw new AppError("Account is not active", "ACCOUNT_INACTIVE", 403);
    }

    const [accessToken, refreshToken] = await Promise.all([
      signMobileAccessToken(payload.id),
      signMobileRefreshToken(payload.id),
    ]);

    return { accessToken, refreshToken, user: payload };
  },
  { bodySchema: mobileGoogleSignInSchema, public: true },
);
