"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@zindagi/shared";
import {
  DOCTOR_WORKSPACE_ACTIONS,
  doctorNavBadgeCount,
} from "@/features/doctor/data/doctor-workspace-nav";
import { useDoctorNavStats } from "@/features/doctor/hooks/use-doctor-nav-stats";

const SHORT_LABELS: Record<string, string> = {
  "/doctor/messages": "Messages",
  "/doctor/patients": "Patients",
  "/doctor/requests": "Requests",
  "/doctor/urgent-calls": "Urgent",
  "/doctor/prescriptions": "Rx",
  "/doctor/sunday-consult": "Sunday",
  "/doctor/home-visits": "Visits",
};

type Props = {
  className?: string;
};

export function DoctorMobilePracticeNav({ className }: Props) {
  const pathname = usePathname();
  const stats = useDoctorNavStats();

  return (
    <nav
      aria-label="Practice shortcuts"
      className={cn(className)}
    >
      <ul className="flex w-full items-stretch justify-between gap-0.5 overflow-x-auto px-1 py-1.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:px-2">
        {DOCTOR_WORKSPACE_ACTIONS.map((item) => {
          const Icon = item.icon;
          const badge = doctorNavBadgeCount(item, stats);
          const shortLabel = SHORT_LABELS[item.href] ?? item.label;
          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <li key={item.href} className="min-w-0 flex-1">
              <Link
                href={item.href}
                title={item.label}
                aria-current={active ? "page" : undefined}
                aria-label={
                  badge !== null ? `${item.label}, ${badge} pending` : item.label
                }
                className={cn(
                  "relative flex w-full flex-col items-center gap-0.5 rounded-lg px-0.5 py-1 transition-colors",
                  active
                    ? "text-brand"
                    : "text-slate-600 hover:bg-slate-100 hover:text-brand active:bg-slate-200",
                )}
              >
                <span
                  className={cn(
                    "relative flex h-8 w-8 items-center justify-center rounded-full",
                    active ? "bg-brand/10 text-brand" : "bg-slate-100 text-slate-700",
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {badge !== null && (
                    <span className="absolute -right-1 -top-1 inline-flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-brand px-0.5 text-[8px] font-bold leading-none text-white tabular-nums">
                      {badge > 99 ? "99+" : badge}
                    </span>
                  )}
                </span>
                <span className="max-w-full truncate text-[9px] font-medium leading-none sm:text-[10px]">
                  {shortLabel}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
