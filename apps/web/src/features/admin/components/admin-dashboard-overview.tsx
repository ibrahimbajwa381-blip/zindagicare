"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity,
  CalendarDays,
  Home,
  Stethoscope,
  Sun,
  UserCheck,
  Users,
} from "lucide-react";
import { cn } from "@zindagi/shared";

type Stats = {
  pendingDoctorVerifications: number;
  activeDoctors: number;
  totalPatients: number;
  appointmentsToday: number;
  pendingHomeVisits: number;
  pendingUrgentCare: number;
  sundayBookingsThisWeek: number;
  systemHealth: {
    database: "ok" | "error";
    sundayConsultEnabled: boolean;
    maintenanceMode: boolean;
  };
};

const KPI_CONFIG = [
  {
    key: "pendingDoctorVerifications" as const,
    label: "Pending verifications",
    href: "/admin/doctors",
    icon: UserCheck,
    accent: "text-amber-600 bg-amber-50 border-amber-100",
  },
  {
    key: "pendingUrgentCare" as const,
    label: "Urgent care active",
    href: "/admin/urgent-care",
    icon: Activity,
    accent: "text-red-600 bg-red-50 border-red-100",
  },
  {
    key: "activeDoctors" as const,
    label: "Active doctors",
    href: "/admin/doctors/manage",
    icon: Stethoscope,
    accent: "text-brand bg-brand/10 border-brand/20",
  },
  {
    key: "totalPatients" as const,
    label: "Registered patients",
    href: "/admin/patients",
    icon: Users,
    accent: "text-blue-600 bg-blue-50 border-blue-100",
  },
  {
    key: "appointmentsToday" as const,
    label: "Appointments today",
    href: "/admin/appointments",
    icon: CalendarDays,
    accent: "text-violet-600 bg-violet-50 border-violet-100",
  },
  {
    key: "pendingHomeVisits" as const,
    label: "Home care pending",
    href: "/admin/home-visits",
    icon: Home,
    accent: "text-emerald-600 bg-emerald-50 border-emerald-100",
  },
  {
    key: "sundayBookingsThisWeek" as const,
    label: "Sunday bookings",
    href: "/admin/sunday-consult",
    icon: Sun,
    accent: "text-orange-600 bg-orange-50 border-orange-100",
  },
];

export function AdminDashboardOverview() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/v1/admin/dashboard")
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setStats(json.data);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 7 }).map((_, i) => (
          <div
            key={i}
            className="h-32 animate-pulse rounded-2xl border border-slate-200 bg-white"
          />
        ))}
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        Failed to load dashboard statistics.
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {KPI_CONFIG.map((kpi) => {
          const Icon = kpi.icon;
          const value = stats[kpi.key];
          return (
            <Link
              key={kpi.key}
              href={kpi.href}
              className="group rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition hover:border-slate-300 hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-slate-500">{kpi.label}</p>
                  <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
                    {value.toLocaleString()}
                  </p>
                </div>
                <span
                  className={cn(
                    "flex h-11 w-11 items-center justify-center rounded-xl border",
                    kpi.accent,
                  )}
                >
                  <Icon className="h-5 w-5" />
                </span>
              </div>
              <p className="mt-4 text-xs font-medium text-brand opacity-0 transition group-hover:opacity-100">
                View details →
              </p>
            </Link>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm lg:col-span-2">
          <h2 className="text-lg font-semibold text-slate-900">Operations summary</h2>
          <p className="mt-1 text-sm text-slate-600">
            Real-time counts across doctor onboarding, patient care, and home treatment
            dispatch.
          </p>
          <dl className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl bg-slate-50 p-4">
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Doctors awaiting review
              </dt>
              <dd className="mt-1 text-2xl font-semibold text-slate-900">
                {stats.pendingDoctorVerifications}
              </dd>
            </div>
            <div className="rounded-xl bg-slate-50 p-4">
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Home visits to assign
              </dt>
              <dd className="mt-1 text-2xl font-semibold text-slate-900">
                {stats.pendingHomeVisits}
              </dd>
            </div>
            <div className="rounded-xl bg-slate-50 p-4">
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Urgent care in queue
              </dt>
              <dd className="mt-1 text-2xl font-semibold text-slate-900">
                {stats.pendingUrgentCare}
              </dd>
            </div>
            <div className="rounded-xl bg-slate-50 p-4">
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Today&apos;s appointments
              </dt>
              <dd className="mt-1 text-2xl font-semibold text-slate-900">
                {stats.appointmentsToday}
              </dd>
            </div>
            <div className="rounded-xl bg-slate-50 p-4 sm:col-span-2">
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Sunday bookings (week)
              </dt>
              <dd className="mt-1 text-2xl font-semibold text-slate-900">
                {stats.sundayBookingsThisWeek}
              </dd>
            </div>
          </dl>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-brand" />
            <h2 className="text-lg font-semibold text-slate-900">System health</h2>
          </div>
          <ul className="mt-6 space-y-4">
            <li className="flex items-center justify-between text-sm">
              <span className="text-slate-600">Database</span>
              <span
                className={cn(
                  "rounded-full px-2.5 py-0.5 text-xs font-semibold",
                  stats.systemHealth.database === "ok"
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-red-100 text-red-800",
                )}
              >
                {stats.systemHealth.database === "ok" ? "Operational" : "Error"}
              </span>
            </li>
            <li className="flex items-center justify-between text-sm">
              <span className="text-slate-600">Sunday consult</span>
              <span
                className={cn(
                  "rounded-full px-2.5 py-0.5 text-xs font-semibold",
                  stats.systemHealth.sundayConsultEnabled
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-slate-100 text-slate-700",
                )}
              >
                {stats.systemHealth.sundayConsultEnabled ? "Enabled" : "Disabled"}
              </span>
            </li>
            <li className="flex items-center justify-between text-sm">
              <span className="text-slate-600">Maintenance mode</span>
              <span
                className={cn(
                  "rounded-full px-2.5 py-0.5 text-xs font-semibold",
                  stats.systemHealth.maintenanceMode
                    ? "bg-amber-100 text-amber-800"
                    : "bg-emerald-100 text-emerald-800",
                )}
              >
                {stats.systemHealth.maintenanceMode ? "Active" : "Off"}
              </span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
