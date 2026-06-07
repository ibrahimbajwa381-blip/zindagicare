import { addDays, format } from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";
import { ONLINE_CONSULT_CONFIG } from "@zindagi/shared";

const TZ = ONLINE_CONSULT_CONFIG.timezone;

export type WeeklyWindow = {
  dayOfWeek: number;
  startTimeLocal: string;
  endTimeLocal: string;
};

export function formatConsultDateKey(date: Date): string {
  return format(toZonedTime(date, TZ), "yyyy-MM-dd");
}

export function localTimeToUtc(dateKey: string, timeLocal: string): Date {
  return fromZonedTime(new Date(`${dateKey}T${timeLocal}:00`), TZ);
}

export function getZonedDayOfWeek(date: Date): number {
  return toZonedTime(date, TZ).getDay();
}

export function parseConsultSlotId(slotId: string): { dateKey: string; startAt: Date } {
  const [dateKey, timeLocal] = slotId.split(":");
  if (!dateKey || !timeLocal) {
    throw new Error("Invalid slot id");
  }
  return { dateKey, startAt: localTimeToUtc(dateKey, timeLocal) };
}

export function generateConsultSlots(
  weeklyAvailability: WeeklyWindow[],
  from: Date,
  days: number,
  durationMins: number,
  now = new Date(),
): { slotId: string; startAt: Date; endAt: Date }[] {
  const slots: { slotId: string; startAt: Date; endAt: Date }[] = [];

  for (let i = 0; i < days; i++) {
    const day = addDays(from, i);
    const dateKey = formatConsultDateKey(day);
    const dayOfWeek = getZonedDayOfWeek(day);
    const windows = weeklyAvailability.filter((w) => w.dayOfWeek === dayOfWeek);

    for (const window of windows) {
      let cursor = localTimeToUtc(dateKey, window.startTimeLocal);
      const end = localTimeToUtc(dateKey, window.endTimeLocal);

      while (cursor < end) {
        const slotEnd = new Date(cursor.getTime() + durationMins * 60 * 1000);
        if (slotEnd > end) break;
        if (cursor > now) {
          const timeLabel = format(toZonedTime(cursor, TZ), "HH:mm");
          slots.push({
            slotId: `${dateKey}:${timeLabel}`,
            startAt: new Date(cursor),
            endAt: slotEnd,
          });
        }
        cursor = slotEnd;
      }
    }
  }

  return slots;
}

export function appointmentBlocksSlot(
  slotStart: Date,
  slotEnd: Date,
  appointment: { scheduledStart: Date; scheduledEnd: Date },
): boolean {
  return (
    slotStart < appointment.scheduledEnd && slotEnd > appointment.scheduledStart
  );
}
