"use client";

import { useSyncExternalStore } from "react";
import { useLocale } from "@/i18n/locale-provider";
import { formatQaDate, formatQaRelative } from "../lib/format";

const TICK_MS = 60_000;
let minuteNow = Date.now();

function subscribe(onChange: () => void) {
  const id = window.setInterval(() => {
    minuteNow = Date.now();
    onChange();
  }, TICK_MS);
  return () => window.clearInterval(id);
}

/**
 * Renders the absolute date on the server and during hydration (no
 * mismatch), then "4 hours ago" on the client, refreshed every minute.
 */
export function RelativeTime({ iso, className }: { iso: string; className?: string }) {
  const { locale } = useLocale();
  const now = useSyncExternalStore(
    subscribe,
    () => minuteNow,
    () => null,
  );

  return (
    <time dateTime={iso} title={formatQaDate(iso, locale)} className={className}>
      {now === null ? formatQaDate(iso, locale) : formatQaRelative(iso, locale, now)}
    </time>
  );
}
