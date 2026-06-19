import { Roles } from "@zindagi/shared";
import {
  urgentCareAssignSchema,
  type UrgentCareAssignInput,
} from "@zindagi/validators";
import { withApiHandler } from "@/server/api/with-api-handler";
import { UrgentConsultService } from "@/server/services/urgent-consult.service";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  const { id } = await params;
  const handler = withApiHandler<UrgentCareAssignInput>(
    async ({ session, body }) =>
      UrgentConsultService.assignDoctor(id, session!.user!.id, body),
    { auth: true, roles: [Roles.ADMIN, Roles.SUPER_ADMIN], bodySchema: urgentCareAssignSchema },
  );
  return handler(req as import("next/server").NextRequest);
}
