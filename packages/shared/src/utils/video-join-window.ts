import { VIDEO_CONSULT_CONFIG } from "../constants/video-consult";

function toDate(value: Date | string) {
  return value instanceof Date ? value : new Date(value);
}

export function getVideoJoinWindow(
  scheduledStart: Date | string,
  scheduledEnd: Date | string,
  now = new Date(),
) {
  const start = toDate(scheduledStart);
  const end = toDate(scheduledEnd);
  const joinOpensAt = new Date(
    start.getTime() - VIDEO_CONSULT_CONFIG.joinEarlyMinutes * 60_000,
  );
  const joinClosesAt = new Date(
    end.getTime() + VIDEO_CONSULT_CONFIG.joinLateMinutes * 60_000,
  );

  return {
    joinOpensAt,
    joinClosesAt,
    canJoin: now >= joinOpensAt && now <= joinClosesAt,
  };
}

/** Urgent care stays joinable while the request is still active (not slot-based). */
export function getUrgentActiveJoinWindow(now = new Date()) {
  return {
    joinOpensAt: now,
    joinClosesAt: now,
    canJoin: true,
  };
}

export function getVideoJoinWindowForAppointment(
  scheduledStart: Date | string,
  scheduledEnd: Date | string,
  options?: { urgentWhileActive?: boolean },
  now = new Date(),
) {
  if (options?.urgentWhileActive) {
    return getUrgentActiveJoinWindow(now);
  }
  return getVideoJoinWindow(scheduledStart, scheduledEnd, now);
}

/**
 * Far-future close time for consults that have no fixed end. Sunday free
 * consults stay open until the doctor finishes them.
 */
export const OPEN_UNTIL_DOCTOR_CLOSES = new Date("9999-12-31T23:59:59.000Z");

/**
 * Sunday free consults open at the usual time before the slot and stay
 * joinable (video and chat) until the doctor marks them completed.
 */
export function getSundayFreeJoinWindow(scheduledStart: Date | string, now = new Date()) {
  const joinOpensAt = new Date(
    toDate(scheduledStart).getTime() - VIDEO_CONSULT_CONFIG.joinEarlyMinutes * 60_000,
  );
  return {
    joinOpensAt,
    joinClosesAt: OPEN_UNTIL_DOCTOR_CLOSES,
    canJoin: now >= joinOpensAt,
  };
}
