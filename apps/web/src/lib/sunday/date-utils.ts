import { addDays, format, startOfWeek } from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";
import { SUNDAY_CONSULT_CONFIG } from "@zindagi/shared";

const TZ = SUNDAY_CONSULT_CONFIG.timezone;

/** Next Sunday 00:00 in Asia/Karachi as UTC Date */
export function getNextSundayDate(from = new Date()): Date {
  const zoned = toZonedTime(from, TZ);
  const weekStart = startOfWeek(zoned, { weekStartsOn: SUNDAY_CONSULT_CONFIG.dayOfWeek as 0 });
  let sunday = weekStart;
  if (sunday <= zoned) {
    sunday = addDays(sunday, 7);
  }
  return fromZonedTime(
    new Date(format(sunday, "yyyy-MM-dd") + "T00:00:00"),
    TZ,
  );
}

export function getSundayDateForOffset(weekOffset: number, from = new Date()): Date {
  const next = getNextSundayDate(from);
  return addDays(next, weekOffset * 7);
}

export function formatSundayDateKey(date: Date): string {
  return format(toZonedTime(date, TZ), "yyyy-MM-dd");
}

export function parseSundayDateKey(key: string): Date {
  return fromZonedTime(new Date(`${key}T00:00:00`), TZ);
}

/** When booking opens for a given Sunday (default: 7 days before) */
export function getBookingOpensAt(sundayDate: Date): Date {
  return addDays(sundayDate, -SUNDAY_CONSULT_CONFIG.bookingOpensDaysBefore);
}

export function getEarlyAccessOpensAt(sundayDate: Date): Date {
  return addDays(
    getBookingOpensAt(sundayDate),
    -SUNDAY_CONSULT_CONFIG.earlyAccessHours / 24,
  );
}

export function canBookNow(
  sundayDate: Date,
  earlyAccess: boolean,
  now = new Date(),
): boolean {
  const opens = earlyAccess
    ? getEarlyAccessOpensAt(sundayDate)
    : getBookingOpensAt(sundayDate);
  return now >= opens && now < sundayDate;
}

/** Build UTC slot times from local HH:mm on a Sunday date key */
export function localTimeToUtc(sundayDateKey: string, timeLocal: string): Date {
  return fromZonedTime(new Date(`${sundayDateKey}T${timeLocal}:00`), TZ);
}

export function generateSlotTimes(
  sundayDateKey: string,
  startTimeLocal: string,
  endTimeLocal: string,
  durationMins: number,
  maxSlots: number,
): { slotId: string; startAt: Date; endAt: Date }[] {
  const slots: { slotId: string; startAt: Date; endAt: Date }[] = [];
  let cursor = localTimeToUtc(sundayDateKey, startTimeLocal);
  const end = localTimeToUtc(sundayDateKey, endTimeLocal);

  while (cursor < end && slots.length < maxSlots) {
    const slotEnd = new Date(cursor.getTime() + durationMins * 60 * 1000);
    if (slotEnd > end) break;
    slots.push({
      slotId: crypto.randomUUID(),
      startAt: new Date(cursor),
      endAt: slotEnd,
    });
    cursor = slotEnd;
  }
  return slots;
}
