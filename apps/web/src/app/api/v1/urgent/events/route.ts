import { NextRequest } from "next/server";
import {
  urgentAppointmentRoom,
  urgentDoctorRoom,
  urgentEmitter,
  urgentPatientRoom,
} from "@/lib/realtime/urgent-emitter";

export async function GET(req: NextRequest) {
  const appointmentId = req.nextUrl.searchParams.get("appointmentId");
  const patientId = req.nextUrl.searchParams.get("patientId");
  const doctorId = req.nextUrl.searchParams.get("doctorId");

  const rooms: string[] = [];
  if (appointmentId) rooms.push(urgentAppointmentRoom(appointmentId));
  if (patientId) rooms.push(urgentPatientRoom(patientId));
  if (doctorId) rooms.push(urgentDoctorRoom(doctorId));

  if (!rooms.length) {
    return new Response("appointmentId, patientId, or doctorId required", { status: 400 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      const send = (data: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      send({ type: "connected", rooms });

      const listener = (event: unknown) => send(event);
      for (const room of rooms) {
        urgentEmitter.on(room, listener);
      }
      urgentEmitter.on("urgent:global", listener);

      const heartbeat = setInterval(() => {
        controller.enqueue(encoder.encode(": ping\n\n"));
      }, 25000);

      req.signal.addEventListener("abort", () => {
        clearInterval(heartbeat);
        for (const room of rooms) {
          urgentEmitter.off(room, listener);
        }
        urgentEmitter.off("urgent:global", listener);
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
