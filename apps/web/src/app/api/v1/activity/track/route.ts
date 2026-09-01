import { z } from "zod";
import { withApiHandler } from "@/server/api/with-api-handler";
import { logActivity } from "@/server/services/activity-log.service";

const trackSchema = z.object({
  action: z.string().min(1).max(80),
  status: z.enum(["success", "error"]).optional(),
  entityType: z.string().max(60).optional(),
  entityId: z.string().max(60).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  platform: z.enum(["web", "mobile"]).optional(),
  path: z.string().max(200).optional(),
});

export const POST = withApiHandler(
  async ({ body, session }) => {
    await logActivity({
      ...body,
      userId: session?.user?.id,
      userRole: session?.user?.roles?.[0],
    });
    return { ok: true };
  },
  { auth: true, bodySchema: trackSchema },
);
