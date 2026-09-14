import { otpRequestSchema } from "@zindagi/validators";
import { withApiHandler } from "@/server/api/with-api-handler";
import { otpService } from "@/server/services/otp.service";

export const POST = withApiHandler(
  async ({ body }) => otpService.requestLoginOtp(body.phone),
  {
    bodySchema: otpRequestSchema,
    public: true,
    rateLimit: {
      limit: 20,
      windowMs: 15 * 60_000,
      by: "ip",
      message: "Too many OTP requests from this device. Please try again later.",
    },
  },
);
