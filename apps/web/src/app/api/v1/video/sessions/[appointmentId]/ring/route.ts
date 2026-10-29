import { z } from "zod";
import { withApiHandler } from "@/server/api/with-api-handler";
import { VideoRingService } from "@/server/services/video-ring.service";

const ringActionSchema = z.discriminatedUnion("action", [
  /** Start a ring (no ringId) or keep an existing one ringing. */
  z.object({ action: z.literal("ring"), ringId: z.string().uuid().optional() }),
  z.object({ action: z.literal("cancel"), ringId: z.string().uuid() }),
  z.object({ action: z.literal("decline"), ringId: z.string().uuid() }),
  z.object({ action: z.literal("answer") }),
]);

type RingActionInput = z.infer<typeof ringActionSchema>;

/** Path is always /api/v1/video/sessions/<appointmentId>/ring for this route. */
function appointmentIdFromUrl(url: string): string {
  const segments = new URL(url).pathname.split("/");
  return segments[segments.length - 2] ?? "";
}

export const POST = withApiHandler<RingActionInput>(
  async ({ req, session, body }) => {
    const userId = session!.user!.id;
    const appointmentId = appointmentIdFromUrl(req.url);

    switch (body.action) {
      case "ring":
        return VideoRingService.ring(userId, appointmentId, body.ringId);
      case "cancel":
        return VideoRingService.cancel(userId, appointmentId, body.ringId);
      case "decline":
        return VideoRingService.decline(userId, appointmentId, body.ringId);
      case "answer":
        return VideoRingService.answer(userId, appointmentId);
    }
  },
  {
    auth: true,
    bodySchema: ringActionSchema,
    // A ring re-sends every few seconds for ~45s; this leaves room for that, not for spam.
    rateLimit: { limit: 40, windowMs: 60_000 },
  },
);
