import { EventEmitter } from "events";

export type SundaySlotEvent = {
  type: "slot_updated" | "instance_updated";
  doctorId: string;
  sundayDateKey: string;
  instanceId?: string;
  slotId?: string;
  status?: string;
};

declare global {
  // eslint-disable-next-line no-var
  var sundayRealtimeEmitter: EventEmitter | undefined;
}

/** In-process pub/sub; SSE route subscribes. Production: Redis adapter + Socket.io server. */
export const sundayEmitter =
  global.sundayRealtimeEmitter ?? new EventEmitter();

if (process.env.NODE_ENV !== "production") {
  global.sundayRealtimeEmitter = sundayEmitter;
}

export function publishSundayEvent(event: SundaySlotEvent) {
  const room = `sunday:${event.sundayDateKey}:${event.doctorId}`;
  sundayEmitter.emit(room, event);
  sundayEmitter.emit("sunday:global", event);
}

export function roomKey(doctorId: string, sundayDateKey: string) {
  return `sunday:${sundayDateKey}:${doctorId}`;
}
