import type { NextRequest } from "next/server";
import { withApiHandler } from "@/server/api/with-api-handler";
import { VideoSessionService } from "@/server/services/video-session.service";

type Params = { params: Promise<{ appointmentId: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const { appointmentId } = await params;

  return withApiHandler(
    async ({ session }) => {
      await VideoSessionService.recordJoin(session!.user!.id, appointmentId);
      return { ok: true };
    },
    { auth: true },
  )(req);
}
