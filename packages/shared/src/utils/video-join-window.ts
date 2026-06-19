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
