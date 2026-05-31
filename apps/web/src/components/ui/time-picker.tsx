"use client";

import { cn } from "@zindagi/shared";

type TimePickerProps = {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  className?: string;
  disabled?: boolean;
};

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);
const MINUTES = [0, 15, 30, 45];

function parseTime(value: string): { hour: number; minute: number } {
  const [hourPart, minutePart] = value.split(":");
  const hour = Number(hourPart);
  const minute = Number(minutePart);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
    return { hour: 9, minute: 0 };
  }
  return {
    hour: Math.min(23, Math.max(0, hour)),
    minute: MINUTES.includes(minute) ? minute : 0,
  };
}

function toTimeValue(hour: number, minute: number): string {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function formatHourLabel(hour: number): string {
  const period = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 || 12;
  return `${hour12} ${period}`;
}

const selectClassName =
  "h-10 min-w-[5.5rem] rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-900 shadow-sm focus:border-brand-light focus:outline-none focus:ring-2 focus:ring-brand-light/25 disabled:cursor-not-allowed disabled:opacity-50";

export function TimePicker({
  value,
  onChange,
  id,
  className,
  disabled,
}: TimePickerProps) {
  const { hour, minute } = parseTime(value);

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <select
        id={id}
        aria-label="Hour"
        value={hour}
        disabled={disabled}
        onChange={(e) => onChange(toTimeValue(Number(e.target.value), minute))}
        className={selectClassName}
      >
        {HOURS.map((h) => (
          <option key={h} value={h}>
            {formatHourLabel(h)}
          </option>
        ))}
      </select>
      <span className="text-slate-400">:</span>
      <select
        aria-label="Minute"
        value={minute}
        disabled={disabled}
        onChange={(e) => onChange(toTimeValue(hour, Number(e.target.value)))}
        className={cn(selectClassName, "min-w-[4.25rem]")}
      >
        {MINUTES.map((m) => (
          <option key={m} value={m}>
            {String(m).padStart(2, "0")}
          </option>
        ))}
      </select>
    </div>
  );
}

export function formatTime12h(time: string): string {
  const { hour, minute } = parseTime(time);
  const period = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 || 12;
  return `${hour12}:${String(minute).padStart(2, "0")} ${period}`;
}
