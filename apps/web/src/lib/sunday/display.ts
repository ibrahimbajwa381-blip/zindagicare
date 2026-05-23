import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { SUNDAY_CONSULT_CONFIG } from "@zindagi/shared";
import {
  canBookNow,
  formatSundayDateKey,
  getBookingOpensAt,
  getNextSundayDate,
} from "./date-utils";

const TZ = SUNDAY_CONSULT_CONFIG.timezone;

export function getNextSundayDateKey(from = new Date()): string {
  return formatSundayDateKey(getNextSundayDate(from));
}

/** e.g. "Sunday, 25 May 2026" */
export function formatNextSundayLong(from = new Date()): string {
  const sunday = getNextSundayDate(from);
  return format(toZonedTime(sunday, TZ), "EEEE, d MMMM yyyy");
}

export function formatBookingOpensLabel(from = new Date()): string {
  const sunday = getNextSundayDate(from);
  const opens = getBookingOpensAt(sunday);
  return format(toZonedTime(opens, TZ), "EEEE, d MMMM 'at' h:mm a");
}

export function isSundayBookingOpenNow(from = new Date()): boolean {
  return canBookNow(getNextSundayDate(from), false, from);
}
