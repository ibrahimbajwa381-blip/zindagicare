import type { Locale } from "@/i18n/config";

/**
 * Absolute date in Pakistan time. Fixed zone + locale keeps server and
 * client output identical (no hydration mismatch, unlike relative times).
 */
export function formatQaDate(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === "ur" ? "ur-PK" : "en-PK", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Karachi",
  }).format(new Date(iso));
}

export function formatAnswerCount(
  count: number,
  t: { answerOne: string; answersMany: string; noAnswersYet: string },
): string {
  if (count === 0) return t.noAnswersYet;
  if (count === 1) return t.answerOne;
  return t.answersMany.replace("{count}", String(count));
}

const RELATIVE_STEPS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ["second", 60],
  ["minute", 60],
  ["hour", 24],
  ["day", 7],
  ["week", 4.35],
  ["month", 12],
  ["year", Infinity],
];

/** "4 hours ago". Client-only (depends on the current time) — see RelativeTime. */
export function formatQaRelative(iso: string, locale: Locale, now: number): string {
  let value = (new Date(iso).getTime() - now) / 1000;
  const rtf = new Intl.RelativeTimeFormat(locale === "ur" ? "ur-PK" : "en-PK", { numeric: "auto" });
  for (const [unit, size] of RELATIVE_STEPS) {
    if (Math.abs(value) < size) return rtf.format(Math.round(value), unit);
    value /= size;
  }
  return formatQaDate(iso, locale);
}
