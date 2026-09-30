"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, Clock, Moon, Sun, Sunrise } from "lucide-react";
import { cn } from "@zindagi/shared";
import { useOptionalLocale, useTranslations } from "@/i18n/locale-provider";

type VisitTimePickerProps = {
  id?: string;
  /** `YYYY-MM-DDTHH:mm` in local time, or "" when nothing is chosen. */
  value: string;
  onChange: (value: string) => void;
};

const DAYS_AHEAD = 14;
const FIRST_SLOT_HOUR = 8;
const LAST_SLOT_HOUR = 21;
const SLOT_MINUTES = 30;
const LEAD_TIME_MS = 60 * 60 * 1000;

const pad = (n: number) => String(n).padStart(2, "0");

function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function buildDays(now: Date): Date[] {
  return Array.from(
    { length: DAYS_AHEAD },
    (_, i) => new Date(now.getFullYear(), now.getMonth(), now.getDate() + i),
  );
}

function buildSlots(day: Date): Date[] {
  const slots: Date[] = [];
  for (let minutes = FIRST_SLOT_HOUR * 60; minutes <= LAST_SLOT_HOUR * 60; minutes += SLOT_MINUTES) {
    slots.push(
      new Date(day.getFullYear(), day.getMonth(), day.getDate(), Math.floor(minutes / 60), minutes % 60),
    );
  }
  return slots;
}

function formatSlot(date: Date): string {
  const hour12 = date.getHours() % 12 || 12;
  const period = date.getHours() >= 12 ? "PM" : "AM";
  return `${hour12}:${pad(date.getMinutes())} ${period}`;
}

export function VisitTimePicker({ id, value, onChange }: VisitTimePickerProps) {
  const h = useTranslations().homeCare;
  const locale = useOptionalLocale();
  const intlLocale = locale === "ur" ? "ur-PK" : "en-PK";

  // "Now" is only known on the client — rendering it on the server would mismatch hydration.
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const earliest = now ? now.getTime() + LEAD_TIME_MS : Infinity;
  const days = useMemo(() => (now ? buildDays(now) : []), [now]);
  const isAvailable = (slot: Date) => slot.getTime() >= earliest;
  const dayHasSlots = (day: Date) => buildSlots(day).some(isAvailable);

  const [selectedDay, setSelectedDay] = useState<string>("");
  const valueDay = value.slice(0, 10);
  const firstOpenDay = days.find(dayHasSlots);
  const activeDayKey =
    selectedDay || valueDay || (firstOpenDay ? toDateKey(firstOpenDay) : "");
  const activeDay = days.find((d) => toDateKey(d) === activeDayKey) ?? firstOpenDay;

  // Drop a chosen time once it slips inside the lead window (page left open for a while).
  useEffect(() => {
    if (value && now && new Date(value).getTime() < earliest) onChange("");
  }, [value, now, earliest, onChange]);

  const selectedChipRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    selectedChipRef.current?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [activeDayKey]);

  if (!now || !activeDay) {
    return <div className="h-40 animate-pulse rounded-xl bg-slate-100" aria-hidden />;
  }

  const today = toDateKey(now);
  const tomorrow = toDateKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1));
  const dayLabel = (day: Date) => {
    const key = toDateKey(day);
    if (key === today) return h.today;
    if (key === tomorrow) return h.tomorrow;
    return day.toLocaleDateString(intlLocale, { weekday: "short" });
  };

  const slots = buildSlots(activeDay);
  const groups = [
    { label: h.morning, icon: Sunrise, slots: slots.filter((s) => s.getHours() < 12) },
    {
      label: h.afternoon,
      icon: Sun,
      slots: slots.filter((s) => s.getHours() >= 12 && s.getHours() < 17),
    },
    { label: h.evening, icon: Moon, slots: slots.filter((s) => s.getHours() >= 17) },
  ]
    .map((g) => ({ ...g, slots: g.slots.filter(isAvailable) }))
    .filter((g) => g.slots.length > 0);

  const selectedDate = value ? new Date(value) : null;

  return (
    <div id={id} className="mt-2 space-y-4">
      <div>
        <p className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">
          <CalendarDays className="h-3.5 w-3.5" />
          {h.pickDay}
        </p>
        <div
          role="radiogroup"
          aria-label={h.pickDay}
          className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-2 [scrollbar-width:thin]"
        >
          {days.map((day) => {
            const key = toDateKey(day);
            const selected = key === toDateKey(activeDay);
            const open = dayHasSlots(day);
            return (
              <button
                key={key}
                ref={selected ? selectedChipRef : undefined}
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={!open}
                onClick={() => {
                  setSelectedDay(key);
                  if (valueDay !== key) onChange("");
                }}
                className={cn(
                  "flex min-w-[4.5rem] shrink-0 snap-start flex-col items-center rounded-xl border px-3 py-2 transition",
                  selected
                    ? "border-brand bg-brand text-white shadow-sm"
                    : "border-slate-200 bg-white text-slate-700 hover:border-brand/40 hover:bg-brand-muted/40",
                  !open && "cursor-not-allowed opacity-40 hover:border-slate-200 hover:bg-white",
                )}
              >
                <span className={cn("text-xs", selected ? "text-white/85" : "text-slate-500")}>
                  {dayLabel(day)}
                </span>
                <span className="text-lg font-semibold leading-tight">{day.getDate()}</span>
                <span className={cn("text-xs", selected ? "text-white/85" : "text-slate-500")}>
                  {day.toLocaleDateString(intlLocale, { month: "short" })}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <p className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">
          <Clock className="h-3.5 w-3.5" />
          {h.pickTime}
        </p>
        <div className="space-y-3">
          {groups.map(({ label, icon: Icon, slots: groupSlots }) => (
            <div key={label}>
              <p className="mb-1.5 flex items-center gap-1.5 text-sm text-slate-600">
                <Icon className="h-4 w-4 text-brand" />
                {label}
              </p>
              <div role="radiogroup" aria-label={label} className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
                {groupSlots.map((slot) => {
                  const slotValue = `${toDateKey(slot)}T${pad(slot.getHours())}:${pad(slot.getMinutes())}`;
                  const selected = slotValue === value;
                  return (
                    <button
                      key={slotValue}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => onChange(slotValue)}
                      className={cn(
                        "rounded-lg border px-2 py-2 text-sm font-medium transition",
                        selected
                          ? "border-brand bg-brand text-white shadow-sm"
                          : "border-slate-200 bg-white text-slate-700 hover:border-brand/40 hover:bg-brand-muted/40",
                      )}
                    >
                      {formatSlot(slot)}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div
        aria-live="polite"
        className={cn(
          "rounded-xl border px-4 py-3 text-sm",
          selectedDate
            ? "border-brand/25 bg-brand-muted/40 text-brand-dark"
            : "border-dashed border-slate-300 text-slate-500",
        )}
      >
        {selectedDate ? (
          <>
            {h.visitOn}{" "}
            <span className="font-semibold">
              {selectedDate.toLocaleDateString(intlLocale, {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
              {" · "}
              {formatSlot(selectedDate)}
            </span>
          </>
        ) : (
          h.noTimeSelected
        )}
      </div>
    </div>
  );
}
