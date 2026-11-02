import { ADMIN_PANEL_ROLES } from "@zindagi/shared";
import { withApiHandler } from "@/server/api/with-api-handler";
import { SundayConsultService } from "@/server/services/sunday-consult.service";

type Params = { params: Promise<{ id: string }> };

/** Admin opens a specialty-only waiting request to every Sunday doctor. */
export async function POST(req: Request, { params }: Params) {
  const { id } = await params;
  const handler = withApiHandler(
    async () => SundayConsultService.openRequestToAllDoctors(id),
    {
      auth: true,
      roles: ADMIN_PANEL_ROLES,
    },
  );
  return handler(req as import("next/server").NextRequest);
}
