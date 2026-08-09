import { Roles } from "@zindagi/shared";
import {
  sundayFreeAssignSchema,
  type SundayFreeAssignInput,
} from "@zindagi/validators";
import { withApiHandler } from "@/server/api/with-api-handler";
import { SundayConsultService } from "@/server/services/sunday-consult.service";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  const { id } = await params;
  const handler = withApiHandler<SundayFreeAssignInput>(
    async ({ session, body }) =>
      SundayConsultService.assignDoctor(id, session!.user!.id, body),
    {
      auth: true,
      roles: [Roles.ADMIN, Roles.SUPER_ADMIN],
      bodySchema: sundayFreeAssignSchema,
    },
  );
  return handler(req as import("next/server").NextRequest);
}
