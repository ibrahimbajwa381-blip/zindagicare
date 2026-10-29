import { AppointmentStatuses, AppointmentTypes, VIDEO_CONSULT_CONFIG } from "@zindagi/shared";

/** Online consult types the provider ends with Finish (pure; safe to import anywhere). */
export const FINISHABLE_TYPES: readonly string[] = [
  AppointmentTypes.ONLINE,
  AppointmentTypes.URGENT_ONLINE,
  AppointmentTypes.SUNDAY_FREE,
];

export const OPEN_CONSULT_STATUSES = [
  AppointmentStatuses.CONFIRMED,
  AppointmentStatuses.IN_PROGRESS,
];

/** Whether the provider may press Finish now: an open online consult that has started. */
export function canFinishConsult(
  consult: { type: string; status: string; scheduledStart: Date },
  now = new Date(),
): boolean {
  return (
    FINISHABLE_TYPES.includes(consult.type) &&
    (OPEN_CONSULT_STATUSES as readonly string[]).includes(consult.status) &&
    now.getTime() >=
      consult.scheduledStart.getTime() - VIDEO_CONSULT_CONFIG.joinEarlyMinutes * 60_000
  );
}
