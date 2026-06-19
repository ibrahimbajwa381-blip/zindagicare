import { Roles } from "@zindagi/shared";
import {
  urgentCareStatusSchema,
  type UrgentCareStatusInput,
} from "@zindagi/validators";
import { withApiHandler } from "@/server/api/with-api-handler";
import { UrgentConsultService } from "@/server/services/urgent-consult.service";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  const { id } = await params;
  const handler = withApiHandler<UrgentCareStatusInput>(
    async ({ body }) => UrgentConsultService.updateStatus(id, body),
    { auth: true, roles: [Roles.ADMIN, Roles.SUPER_ADMIN], bodySchema: urgentCareStatusSchema },
  );
  return handler(req as import("next/server").NextRequest);
}
