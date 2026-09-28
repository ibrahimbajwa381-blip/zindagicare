import { Roles } from "@zindagi/shared";
import { withApiHandler } from "@/server/api/with-api-handler";
import { SundayConsultService } from "@/server/services/sunday-consult.service";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  const { id } = await params;
  const handler = withApiHandler(
    async ({ session }) => SundayConsultService.releaseRequest(session!.user!.id, id),
    { auth: true, roles: [Roles.DOCTOR] },
  );
  return handler(req as import("next/server").NextRequest);
}
