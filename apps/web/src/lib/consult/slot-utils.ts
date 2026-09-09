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

/**
 * True calendar-date validity check for a "yyyy-MM-dd" string. JS's Date
 * constructor silently rolls day-of-month overflow forward instead of
 * rejecting it — e.g. `new Date("2024-02-30T...")` parses as March 1st, and
 * `new Date("2023-02-29T...")` (2023 isn't a leap year) parses as March 1st
 * too — so a plain NaN check on the parsed Date misses both. This confirms
 * the three components round-trip exactly, catching every such rollover.
 */
export function isValidCalendarDateKey(dateKey: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match) return false;
  const [, y, m, d] = match;
  const year = Number(y);
  const month = Number(m);
  const day = Number(d);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

export function parseConsultSlotId(slotId: string): { dateKey: string; startAt: Date } {
  if (slotId.length < 12 || slotId[10] !== ":") {
    throw new Error("Invalid slot id");
  }
  const dateKey = getConsultSlotDateKey(slotId);
  const timeLocal = slotId.slice(11);
  // The structural checks above (length/colon-position/HH:mm shape) accept
  // calendar-nonsensical values like "9999-99-99" or "13:99" — fromZonedTime
  // silently returns an Invalid Date for those rather than throwing, which
  // would otherwise slip past this function and blow up much later (inside
  // date-fns' format(), as an uncaught RangeError) instead of failing here
  // as the clean "Invalid slot id" every other malformed slotId produces.
  if (!isValidCalendarDateKey(dateKey) || !/^\d{2}:\d{2}$/.test(timeLocal)) {
    throw new Error("Invalid slot id");
  }
  const startAt = localTimeToUtc(dateKey, timeLocal);
  if (Number.isNaN(startAt.getTime())) {
    throw new Error("Invalid slot id");
  }
  return { dateKey, startAt };
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
