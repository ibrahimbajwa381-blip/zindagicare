import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { formatTime12h } from "@/components/ui/time-picker";
import { SUNDAY_CONSULT_CONFIG } from "@zindagi/shared";
import {
  canBookNow,
  formatSundayDateKey,
  getBookingOpensAt,
  getNextSundayDate,
} from "./date-utils";

const TZ = SUNDAY_CONSULT_CONFIG.timezone;

export type SundaySlotPreview = {
  id: string;
  label: string;
};

/** Preview Sunday slot labels for doctor profile / verification forms. */
export function previewSundaySlots(
  start: string,
  end: string,
  durationMins: number,
): SundaySlotPreview[] {
  if (!Number.isFinite(durationMins) || durationMins < 1) return [];

  const [startH, startM] = start.split(":").map(Number);
  const [endH, endM] = end.split(":").map(Number);
  const startTotal = startH * 60 + startM;
  const endTotal = endH * 60 + endM;
  if (endTotal <= startTotal) return [];

  const slots: SundaySlotPreview[] = [];
  for (let t = startTotal; t + durationMins <= endTotal; t += durationMins) {
    const h = Math.floor(t / 60);
    const m = t % 60;
    const slotStart = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    const endSlot = t + durationMins;
    const eh = Math.floor(endSlot / 60);
    const em = endSlot % 60;
    const slotEnd = `${String(eh).padStart(2, "0")}:${String(em).padStart(2, "0")}`;
    slots.push({
      id: slotStart,
      label: `${formatTime12h(slotStart)} – ${formatTime12h(slotEnd)}`,
    });
  }
  return slots;
}

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
