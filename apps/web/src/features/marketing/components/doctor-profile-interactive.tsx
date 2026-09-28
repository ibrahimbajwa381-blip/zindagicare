"use client";

import { useEffect, useState } from "react";
import { CalendarCheck } from "lucide-react";
import { cn } from "@zindagi/shared";
import type { PublicDoctorWeeklyWindow } from "@/features/marketing/types/doctor-public";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
/** Pakistani week starts Monday. */
const DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

function formatTime12h(time: string): string {
  const [h, m] = time.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return time;
  const period = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${period}`;
}

function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

/** Current weekday + minutes in Asia/Karachi, independent of the visitor's own timezone. */
function karachiNow(): { day: number; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Karachi",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
  return { day, minutes: Number(get("hour")) * 60 + Number(get("minute")) };
}

/**
 * Weekly consultation hours with today highlighted and an "available now" hint. "Today" is
 * resolved after mount so server HTML and hydration always match.
 */
export function DoctorWeeklyHours({ windows }: { windows: PublicDoctorWeeklyWindow[] }) {
  const [now, setNow] = useState<{ day: number; minutes: number } | null>(null);

  useEffect(() => {
    const update = () => setNow(karachiNow());
    update();
    const timer = window.setInterval(update, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const byDay = new Map<number, PublicDoctorWeeklyWindow[]>();
  for (const w of windows) {
    const list = byDay.get(w.dayOfWeek) ?? [];
    list.push(w);
    byDay.set(w.dayOfWeek, list);
  }
  for (const list of byDay.values()) {
    list.sort((a, b) => toMinutes(a.startTimeLocal) - toMinutes(b.startTimeLocal));
  }

  const openNow =
    now !== null &&
    (byDay.get(now.day) ?? []).some(
      (w) => now.minutes >= toMinutes(w.startTimeLocal) && now.minutes < toMinutes(w.endTimeLocal),
    );

  return (
    <div>
      {now !== null && (
        <p
          className={cn(
            "mb-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
            openNow ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600",
          )}
        >
          <span
            className={cn("h-1.5 w-1.5 rounded-full", openNow ? "bg-emerald-500" : "bg-slate-400")}
          />
          {openNow ? "Consulting now" : "Not consulting right now"}
        </p>
      )}
      <dl className="divide-y divide-slate-100 rounded-xl border border-slate-100">
        {DISPLAY_ORDER.map((day) => {
          const list = byDay.get(day) ?? [];
          const isToday = now?.day === day;
          return (
            <div
              key={day}
              className={cn(
                "flex items-start justify-between gap-4 px-4 py-2.5 text-sm",
                isToday && "bg-brand-muted/50",
              )}
            >
              <dt className={cn("text-slate-600", isToday && "font-semibold text-slate-900")}>
                {DAY_NAMES[day]}
                {isToday && <span className="ml-2 text-xs font-medium text-brand">Today</span>}
              </dt>
              <dd className="text-right">
                {list.length ? (
                  list.map((w, i) => (
                    <span key={i} className="block tabular-nums text-slate-800">
                      {formatTime12h(w.startTimeLocal)} – {formatTime12h(w.endTimeLocal)}
                    </span>
                  ))
                ) : (
                  <span className="text-slate-400">Closed</span>
                )}
              </dd>
            </div>
          );
        })}
      </dl>
      <p className="mt-2 text-xs text-slate-400">Times shown in Pakistan Standard Time (PKT).</p>
    </div>
  );
}

/**
 * Phone-only booking bar pinned to the bottom of the screen. Hides itself while the booking
 * panel (#book) is on screen so it never covers the real form.
 */
export function DoctorMobileBookBar({
  fee,
  label = "Book consultation",
}: {
  fee: number;
  label?: string;
}) {
  const [panelVisible, setPanelVisible] = useState(false);

  useEffect(() => {
    const panel = document.getElementById("book");
    if (!panel || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => setPanelVisible(entry.isIntersecting),
      { threshold: 0.1 },
    );
    observer.observe(panel);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      className={cn(
        "fixed z-30 transition-all duration-200 lg:hidden",
        "bottom-[max(1.25rem,env(safe-area-inset-bottom))] start-[max(1rem,env(safe-area-inset-left))] end-[calc(max(1rem,env(safe-area-inset-right))+4.25rem)]",
        panelVisible ? "pointer-events-none translate-y-4 opacity-0" : "opacity-100",
      )}
      aria-hidden={panelVisible}
    >
      <a
        href="#book"
        tabIndex={panelVisible ? -1 : undefined}
        className="flex h-14 items-center justify-between gap-3 rounded-2xl bg-brand px-4 text-white shadow-lg ring-2 ring-white"
      >
        <span className="inline-flex items-center gap-2 text-sm font-semibold">
          <CalendarCheck className="h-5 w-5" />
          {label}
        </span>
        {fee > 0 && (
          <span className="text-sm font-medium text-white/90">
            Rs. {fee.toLocaleString("en-PK")}
          </span>
        )}
      </a>
    </div>
  );
}
