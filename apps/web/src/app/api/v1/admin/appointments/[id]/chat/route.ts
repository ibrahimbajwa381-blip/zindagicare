import { Roles } from "@zindagi/shared";
import { withApiHandler } from "@/server/api/with-api-handler";
import { ChatService } from "@/server/services/chat.service";

type Params = { params: Promise<{ id: string }> };

/** Read-only doctor–patient chat transcript for an appointment (admin oversight). */
export async function GET(req: Request, { params }: Params) {
  const { id } = await params;
  const handler = withApiHandler(
    async () => ChatService.getAppointmentTranscriptForAdmin(id),
    { auth: true, roles: [Roles.ADMIN, Roles.SUPER_ADMIN] },
  );
  return handler(req as import("next/server").NextRequest);
}
