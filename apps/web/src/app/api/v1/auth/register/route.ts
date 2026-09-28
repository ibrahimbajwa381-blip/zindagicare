import { registerSchema } from "@zindagi/validators";
import { withApiHandler } from "@/server/api/with-api-handler";
import { VISITOR_COOKIE } from "@/server/lib/visitor-id";
import { registerWithCredentials } from "@/server/services/auth.service";
import { REFERRAL_COOKIE_NAME, resolveReferralDoctorId } from "@/server/services/doctor-referral.service";

export const POST = withApiHandler(
  async ({ body, req }) => {
    const referralCode = req.cookies.get(REFERRAL_COOKIE_NAME)?.value;
    const referredByDoctorId = await resolveReferralDoctorId(referralCode);
    const visitorId = req.cookies.get(VISITOR_COOKIE)?.value;
    const user = await registerWithCredentials(body, referredByDoctorId, visitorId);
    return {
      id: user._id.toString(),
      email: user.email,
      message: "Account created. Sign in to continue.",
    };
  },
  { bodySchema: registerSchema },
);
