import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { z } from "zod";
import { withApiHandler } from "@/server/api/with-api-handler";
import { logActivity } from "@/server/services/activity-log.service";

const VISITOR_COOKIE = "zc_visitor";

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
    const cookieStore = await cookies();
    const existingVisitorId = cookieStore.get(VISITOR_COOKIE)?.value;
    const visitorId = session?.user?.id ? undefined : existingVisitorId ?? randomUUID();

    await logActivity({
      ...body,
      userId: session?.user?.id,
      userRole: session?.user?.roles?.[0],
      visitorId,
    });

    if (visitorId && visitorId !== existingVisitorId) {
      cookieStore.set(VISITOR_COOKIE, visitorId, {
        httpOnly: true,
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 365,
        path: "/",
      });
    }

    return { ok: true };
  },
  { bodySchema: trackSchema },
);
