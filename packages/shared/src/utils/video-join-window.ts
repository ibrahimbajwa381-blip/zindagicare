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
