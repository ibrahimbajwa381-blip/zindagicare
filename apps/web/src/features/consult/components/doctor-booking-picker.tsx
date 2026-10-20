"use client";

import { Moon, Sun, Sunrise, type LucideIcon } from "lucide-react";
import { SlotStatuses, cn } from "@zindagi/shared";
import { formatKarachiTime } from "@/lib/format/datetime";

const KARACHI_TZ = "Asia/Karachi";

export type BookingSlot = {
  slotId: string;
  startAt: string;
  endAt: string;
  status: string;
  /** The signed-in patient's own unpaid checkout for this slot — selectable to resume payment. */
  heldByYou?: boolean;
};

export const isSlotAvailable = (slot: BookingSlot) => slot.status === SlotStatuses.AVAILABLE;

function karachiTodayKey(offsetDays = 0): string {
  const date = new Date(Date.now() + offsetDays * 86_400_000);
  // en-CA formats as YYYY-MM-DD, matching consult slot date keys.
  return new Intl.DateTimeFormat("en-CA", { timeZone: KARACHI_TZ }).format(date);
}

function karachiHour(iso: string): number {
  return Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: KARACHI_TZ,
      hour: "2-digit",
      hourCycle: "h23",
    }).format(new Date(iso)),
  );
}

/** "Today" / "Tomorrow" / "Wed" plus day + month for a YYYY-MM-DD key (PKT). */
export function describeDateKey(key: string) {
  const date = new Date(`${key}T12:00:00+05:00`);
  const part = (options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("en-PK", { timeZone: KARACHI_TZ, ...options }).format(date);
  const weekday = part({ weekday: "short" });
  const relative =
    key === karachiTodayKey() ? "Today" : key === karachiTodayKey(1) ? "Tomorrow" : null;
  return {
    label: relative ?? weekday,
    weekday,
    day: part({ day: "numeric" }),
    month: part({ month: "short" }),
    long: part({ weekday: "long", day: "numeric", month: "long" }),
  };
}

type DateStripProps = {
  dateKeys: string[];
  availableByDate: Map<string, number>;
  selectedDateKey: string | null;
  onSelect: (key: string) => void;
  className?: string;
};

/** Horizontally scrolling day cards with open-slot counts. */
export function BookingDateStrip({
  dateKeys,
  availableByDate,
  selectedDateKey,
  onSelect,
  className,
}: DateStripProps) {
  return (
    <div
      role="listbox"
      aria-label="Choose a day"
      className={cn(
        "-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:thin]",
        className,
      )}
    >
      {dateKeys.map((key) => {
        const info = describeDateKey(key);
        const open = availableByDate.get(key) ?? 0;
        const selected = key === selectedDateKey;
        return (
          <button
            key={key}
            type="button"
            role="option"
            aria-selected={selected}
            aria-label={`${info.long}, ${open} open slot${open === 1 ? "" : "s"}`}
            disabled={open === 0}
            onClick={() => onSelect(key)}
            className={cn(
              "flex w-[4.75rem] shrink-0 snap-start flex-col items-center rounded-2xl border px-2 py-2.5 text-center transition-all active:scale-[0.97]",
              selected
                ? "border-brand bg-brand text-white shadow-md shadow-brand/25"
                : "border-slate-200 bg-white text-slate-700 hover:border-brand-light hover:bg-brand-muted/60",
              open === 0 && "cursor-not-allowed opacity-45 hover:border-slate-200 hover:bg-white",
            )}
          >
            <span
              className={cn(
                "text-[10px] font-semibold uppercase tracking-wide",
                selected ? "text-white/85" : "text-slate-500",
              )}
            >
              {info.label}
            </span>
            <span className="font-display text-xl font-semibold leading-tight">{info.day}</span>
            <span className={cn("text-[11px]", selected ? "text-white/85" : "text-slate-500")}>
              {info.month}
            </span>
            <span
              className={cn(
                "mt-1 rounded-full px-1.5 text-[10px] font-medium",
                selected ? "bg-white/20 text-white" : "bg-emerald-50 text-emerald-700",
                open === 0 && "bg-slate-100 text-slate-500",
              )}
            >
              {open === 0 ? "Full" : `${open} open`}
            </span>
          </button>
        );
      })}
    </div>
  );
}

const PERIODS: { id: string; label: string; icon: LucideIcon; from: number; to: number }[] = [
  { id: "morning", label: "Morning", icon: Sunrise, from: 0, to: 12 },
  { id: "afternoon", label: "Afternoon", icon: Sun, from: 12, to: 17 },
  { id: "evening", label: "Evening", icon: Moon, from: 17, to: 24 },
];

type TimeGroupsProps = {
  slots: BookingSlot[];
  selectedSlotId: string | null;
  onSelect: (slotId: string) => void;
  disabled?: boolean;
  loading?: boolean;
  emptyMessage: string;
  /** Narrow containers (sidebar) use 3 columns; the sheet can fit 4. */
  dense?: boolean;
};

/** Time slots split into morning / afternoon / evening so long days are easy to scan. */
export function BookingTimeGroups({
  slots,
  selectedSlotId,
  onSelect,
  disabled,
  loading,
  emptyMessage,
  dense,
}: TimeGroupsProps) {
  const grid = cn("grid gap-2", dense ? "grid-cols-3" : "grid-cols-3 sm:grid-cols-4");

  if (loading) {
    return (
      <div className={grid}>
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="h-11 animate-pulse rounded-xl bg-slate-200/70" />
        ))}
      </div>
    );
  }

  if (!slots.length) {
    return (
      <p className="rounded-xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500">
        {emptyMessage}
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {PERIODS.map((period) => {
        const list = slots.filter((s) => {
          const hour = karachiHour(s.startAt);
          return hour >= period.from && hour < period.to;
        });
        if (!list.length) return null;
        const Icon = period.icon;
        const open = list.filter(isSlotAvailable).length;
        return (
          <div key={period.id}>
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <Icon className="h-3.5 w-3.5 text-brand" aria-hidden />
              {period.label}
              <span className="font-normal normal-case tracking-normal text-slate-400">
                · {open} open
              </span>
            </p>
            <div className={grid}>
              {list.map((slot) => {
                const available = isSlotAvailable(slot);
                const selected = slot.slotId === selectedSlotId;
                return (
                  <button
                    key={slot.slotId}
                    type="button"
                    aria-pressed={selected}
                    disabled={disabled || !available}
                    onClick={() => onSelect(slot.slotId)}
                    className={cn(
                      "min-h-11 whitespace-nowrap rounded-xl border px-1 py-2 text-[13px] font-medium tabular-nums transition-all active:scale-[0.97] min-[360px]:text-sm",
                      selected
                        ? "border-brand bg-brand text-white shadow-md shadow-brand/25"
                        : "border-slate-200 bg-white text-slate-800 hover:border-brand-light hover:bg-brand-muted/70",
                      !available &&
                        "cursor-not-allowed border-slate-100 bg-slate-50 text-slate-400 line-through hover:border-slate-100 hover:bg-slate-50",
                    )}
                  >
                    {formatKarachiTime(slot.startAt)}
                    {slot.heldByYou && (
                      <span
                        className={cn(
                          "block text-[10px] font-semibold leading-tight",
                          selected ? "text-white/85" : "text-amber-600",
                        )}
                      >
                        Your hold
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
