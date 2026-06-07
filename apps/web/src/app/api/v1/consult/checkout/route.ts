import { consultCheckoutSchema, type ConsultCheckoutInput } from "@zindagi/validators";
import { withApiHandler } from "@/server/api/with-api-handler";
import { OnlineConsultService } from "@/server/services/online-consult.service";

export const POST = withApiHandler<ConsultCheckoutInput>(
  async ({ session, body }) =>
    OnlineConsultService.initiateCheckout(session!.user!.id, body),
  { auth: true, bodySchema: consultCheckoutSchema },
);
