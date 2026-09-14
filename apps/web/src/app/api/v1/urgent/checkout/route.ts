import {
  urgentCareRequestSchema,
  type UrgentCareRequestInput,
} from "@zindagi/validators";
import { withApiHandler } from "@/server/api/with-api-handler";
import { UrgentConsultService } from "@/server/services/urgent-consult.service";

export const POST = withApiHandler<UrgentCareRequestInput>(
  async ({ session, body }) =>
    UrgentConsultService.initiateCheckout(session!.user!.id, body),
  {
    auth: true,
    bodySchema: urgentCareRequestSchema,
    rateLimit: {
      limit: 5,
      windowMs: 60_000,
      message: "Too many urgent care requests. Please wait a moment before trying again.",
    },
  },
);
