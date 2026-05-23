import { NextRequest } from "next/server";
import { roomKey, sundayEmitter } from "@/lib/realtime/sunday-emitter";

/**
 * SSE stream for Sunday slot updates (Vercel-compatible realtime).
 * Socket.io: use same events via dedicated Node server in production.
 */
export async function GET(req: NextRequest) {
  const doctorId = req.nextUrl.searchParams.get("doctorId");
  const dateKey = req.nextUrl.searchParams.get("date");

  if (!doctorId || !dateKey) {
    return new Response("doctorId and date required", { status: 400 });
  }

  const room = roomKey(doctorId, dateKey);
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const send = (data: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      send({ type: "connected", room });

      const listener = (event: unknown) => send(event);
      sundayEmitter.on(room, listener);
      sundayEmitter.on("sunday:global", listener);

      const heartbeat = setInterval(() => {
        controller.enqueue(encoder.encode(": ping\n\n"));
      }, 25000);

      req.signal.addEventListener("abort", () => {
        clearInterval(heartbeat);
        sundayEmitter.off(room, listener);
        sundayEmitter.off("sunday:global", listener);
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
