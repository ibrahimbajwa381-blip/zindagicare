import { consultCheckoutSchema, type ConsultCheckoutInput } from "@zindagi/validators";
import { Roles } from "@zindagi/shared";
import { withApiHandler } from "@/server/api/with-api-handler";
import { OnlineConsultService } from "@/server/services/online-consult.service";
import { REFERRAL_COOKIE_NAME } from "@/lib/doctors/referral-cookie";
import { attributeReferralIfEligible } from "@/server/services/doctor-referral.service";

export const POST = withApiHandler<ConsultCheckoutInput>(
  async ({ session, body, req }) => {
    await attributeReferralIfEligible(
      session!.user!.id,
      body.doctorId,
      req.cookies.get(REFERRAL_COOKIE_NAME)?.value,
    );
    return OnlineConsultService.initiateCheckout(session!.user!.id, body);
  },
  {
    auth: true,
    roles: [Roles.PATIENT],
    bodySchema: consultCheckoutSchema,
    rateLimit: {
      limit: 10,
      windowMs: 60_000,
      message: "Too many checkout attempts. Please wait a moment before trying again.",
    },
  },
);
