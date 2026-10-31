import { ADMIN_PANEL_ROLES } from "@zindagi/shared";
import { sundayFreeRejectSchema, type SundayFreeRejectInput } from "@zindagi/validators";
import { withApiHandler } from "@/server/api/with-api-handler";
import { SundayConsultService } from "@/server/services/sunday-consult.service";

type Params = { params: Promise<{ id: string }> };

/** Admin rejects a Sunday free request (waiting or picked) with a note for the patient. */
export async function POST(req: Request, { params }: Params) {
  const { id } = await params;
  const handler = withApiHandler<SundayFreeRejectInput>(
    async ({ session, body }) =>
      SundayConsultService.rejectRequestByAdmin(session!.user!.id, id, body.reason),
    {
      auth: true,
      roles: ADMIN_PANEL_ROLES,
      bodySchema: sundayFreeRejectSchema,
    },
  );
  return handler(req as import("next/server").NextRequest);
}
