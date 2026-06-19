import {
  urgentCareRequestSchema,
  type UrgentCareRequestInput,
} from "@zindagi/validators";
import { withApiHandler } from "@/server/api/with-api-handler";
import { UrgentConsultService } from "@/server/services/urgent-consult.service";

export const POST = withApiHandler<UrgentCareRequestInput>(
  async ({ session, body }) =>
    UrgentConsultService.createRequest(body, session?.user?.id ?? null),
  { bodySchema: urgentCareRequestSchema },
);
