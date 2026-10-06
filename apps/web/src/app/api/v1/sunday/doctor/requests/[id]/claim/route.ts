import { Roles } from "@zindagi/shared";
import {
  sundayFreeClaimSchema,
  type SundayFreeClaimInput,
} from "@zindagi/validators";
import { withApiHandler } from "@/server/api/with-api-handler";
import { SundayConsultService } from "@/server/services/sunday-consult.service";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  const { id } = await params;
  const handler = withApiHandler<SundayFreeClaimInput>(
    async ({ session, body }) =>
      SundayConsultService.claimRequest(session!.user!.id, id, body),
    {
      auth: true,
      roles: [Roles.DOCTOR],
      bodySchema: sundayFreeClaimSchema,
    },
  );
  return handler(req as import("next/server").NextRequest);
}
