import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { chatEmitter, userRoomKey } from "@/lib/realtime/chat-emitter";

/**
 * SSE stream for chat updates (Vercel-compatible realtime).
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const room = userRoomKey(session.user.id);
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const send = (data: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      send({ type: "connected", room });

      const listener = (event: unknown) => send(event);
      chatEmitter.on(room, listener);

      const heartbeat = setInterval(() => {
        controller.enqueue(encoder.encode(": ping\n\n"));
      }, 25000);

      req.signal.addEventListener("abort", () => {
        clearInterval(heartbeat);
        chatEmitter.off(room, listener);
        controller.close();
      });
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
