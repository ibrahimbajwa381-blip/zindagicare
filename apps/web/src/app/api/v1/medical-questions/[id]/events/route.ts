import { objectIdSchema } from "@zindagi/validators";
import { medicalQaFanout, questionRoomKey } from "@/lib/realtime/medical-qa-emitter";
import { medicalQaPathIds } from "@/server/api/medical-qa-route";
import { apiError } from "@/server/api/response";
import { enforceDistributedRateLimit } from "@/server/lib/distributed-rate-limit";
import { getClientIp } from "@/server/lib/rate-limit";
import { medicalQaLimiters } from "@/server/services/medical-qa.service";

/**
 * Streams end themselves before Vercel's 300s function limit; the client
 * reconnects and resyncs, which also bounds how long a silently dead Redis
 * subscription can go unnoticed.
 */
const MAX_STREAM_MS = 270_000;
const HEARTBEAT_MS = 25_000;

/**
 * Public SSE stream for one question. Events contain ids only (see
 * medical-qa-emitter); the page re-fetches through the normal API, so this
 * channel never carries question text, names or photo URLs.
 *
 * "connected" is sent only once the (cross-instance) subscription is live, so
 * the client's resync on "connected" can't miss an event published meanwhile.
 */
export async function GET(req: Request) {
  const [questionId] = medicalQaPathIds(req.url);
  if (!objectIdSchema.safeParse(questionId).success) {
    return new Response("Not found", { status: 404 });
  }

  // Per-IP (not per-account: the stream is public and never reads the session).
  // A 429 makes EventSource error, and the client retries with backoff.
  try {
    await enforceDistributedRateLimit(
      medicalQaLimiters.eventStream,
      `ip:${getClientIp(req)}`,
      "Too many live-update connections. Please wait a little and try again.",
    );
  } catch (err) {
    return apiError(err);
  }

  const room = questionRoomKey(questionId!);
  const encoder = new TextEncoder();
  let cleanup = () => {};

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      let release = () => {};
      const send = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          cleanup();
        }
      };
      const heartbeat = setInterval(() => send(": ping\n\n"), HEARTBEAT_MS);
      const lifetime = setTimeout(() => cleanup(), MAX_STREAM_MS);

      cleanup = () => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        clearTimeout(lifetime);
        release();
        try {
          controller.close();
        } catch {
          // already closed
        }
      };
      if (req.signal.aborted) return cleanup();
      req.signal.addEventListener("abort", cleanup);

      const releaseSubscription = await medicalQaFanout.subscribe(room, {
        onEvent: (event) => send(`data: ${JSON.stringify(event)}\n\n`),
        // Redis subscription broke: end the stream so the client reconnects and resyncs.
        onReset: () => cleanup(),
      });
      if (closed) return releaseSubscription();
      release = releaseSubscription;
      send(`data: ${JSON.stringify({ type: "connected" })}\n\n`);
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
