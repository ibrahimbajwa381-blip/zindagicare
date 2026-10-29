import { EventEmitter } from "events";
import { createRealtimeEmitter } from "./create-emitter";

/** A ring started, stopped or changed state; listeners re-fetch the incoming ring. */
export type CallRingEvent = {
  type: "ring_updated";
  appointmentId: string;
};

declare global {
  var callRingRealtimeEmitter: EventEmitter | undefined;
}

/** In-process only: clients also resync from the database on (re)connect and while ringing. */
export const callRingEmitter = createRealtimeEmitter({
  get: () => global.callRingRealtimeEmitter,
  set: (emitter) => {
    global.callRingRealtimeEmitter = emitter;
  },
  alwaysPersist: true,
});

export function callRingUserRoom(userId: string) {
  return `call-ring:user:${userId}`;
}

export function publishCallRingEvent(userIds: string[], event: CallRingEvent) {
  for (const userId of new Set(userIds)) {
    try {
      callRingEmitter.emit(callRingUserRoom(userId), event);
    } catch {
      // One failing listener must not block the other side.
    }
  }
}
