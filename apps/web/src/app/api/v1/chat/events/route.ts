import { NextRequest } from "next/server";
import { resolveSession } from "@/server/api/resolve-session";
import { chatEmitter, userRoomKey } from "@/lib/realtime/chat-emitter";

/**
 * SSE stream for chat updates (Vercel-compatible realtime). Uses
 * resolveSession (cookie session or mobile Bearer token) rather than auth()
 * directly, since the mobile app authenticates with a Bearer access token.
 */
export async function GET(req: NextRequest) {
  const session = await resolveSession(req);
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const room = userRoomKey(session.user.id);
  const encoder = new TextEncoder();

  let cleanup = () => {};

  const stream = new ReadableStream({
    start(controller) {
      let closed = false;

      cleanup = () => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        chatEmitter.off(room, listener);
        try {
          controller.close();
        } catch {
          // Ignore if controller is already closed or errored
        }
      };

      const send = (data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {
          cleanup();
        }
      };

      send({ type: "connected", room });

      const listener = (event: unknown) => send(event);
      chatEmitter.on(room, listener);

      const heartbeat = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(": ping\n\n"));
        } catch {
          cleanup();
        }
      }, 25000);

      if (req.signal.aborted) {
        cleanup();
        return;
      }

      req.signal.addEventListener("abort", cleanup);
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
