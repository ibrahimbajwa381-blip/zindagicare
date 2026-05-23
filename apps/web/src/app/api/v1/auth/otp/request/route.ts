import { otpRequestSchema } from "@zindagi/validators";
import { withApiHandler } from "@/server/api/with-api-handler";
import { otpService } from "@/server/services/otp.service";

export const POST = withApiHandler(
  async ({ body }) => otpService.requestOtp(body.phone),
  { bodySchema: otpRequestSchema },
);
