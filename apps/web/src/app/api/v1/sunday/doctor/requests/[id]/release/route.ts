import { Roles } from "@zindagi/shared";
import {
  sundayFreeReleaseSchema,
  type SundayFreeReleaseInput,
} from "@zindagi/validators";
import { withApiHandler } from "@/server/api/with-api-handler";
import { SundayConsultService } from "@/server/services/sunday-consult.service";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  const { id } = await params;
  const handler = withApiHandler<SundayFreeReleaseInput>(
    async ({ session, body }) =>
      SundayConsultService.releaseRequest(session!.user!.id, id, body),
    {
      auth: true,
      roles: [Roles.DOCTOR],
      bodySchema: sundayFreeReleaseSchema,
    },
  );
  return handler(req as import("next/server").NextRequest);
}
