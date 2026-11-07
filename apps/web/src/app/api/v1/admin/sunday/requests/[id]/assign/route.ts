import { ADMIN_PANEL_ROLES } from "@zindagi/shared";
import { sundayFreeAssignSchema, type SundayFreeAssignInput } from "@zindagi/validators";
import { withApiHandler } from "@/server/api/with-api-handler";
import { SundayConsultService } from "@/server/services/sunday-consult.service";

type Params = { params: Promise<{ id: string }> };

/** Admin appoints a doctor to a waiting Sunday free request at a chosen time. */
export async function POST(req: Request, { params }: Params) {
  const { id } = await params;
  const handler = withApiHandler<SundayFreeAssignInput>(
    async ({ body }) => SundayConsultService.assignRequestByAdmin(id, body),
    {
      auth: true,
      roles: ADMIN_PANEL_ROLES,
      bodySchema: sundayFreeAssignSchema,
    },
  );
  return handler(req as import("next/server").NextRequest);
}
