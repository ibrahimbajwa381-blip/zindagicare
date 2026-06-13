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

/** Karachi calendar date (yyyy-MM-dd) encoded in a consult slot id. */
export function getConsultSlotDateKey(slotId: string): string {
  return slotId.slice(0, 10);
}

export function parseConsultSlotId(slotId: string): { dateKey: string; startAt: Date } {
  if (slotId.length < 12 || slotId[10] !== ":") {
    throw new Error("Invalid slot id");
  }
  const dateKey = getConsultSlotDateKey(slotId);
  const timeLocal = slotId.slice(11);
  if (!/^\d{2}:\d{2}$/.test(timeLocal)) {
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
  const startDateKey = formatConsultDateKey(from);
  const startAnchor = fromZonedTime(new Date(`${startDateKey}T12:00:00`), TZ);

  for (let i = 0; i < days; i++) {
    const day = addDays(startAnchor, i);
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
