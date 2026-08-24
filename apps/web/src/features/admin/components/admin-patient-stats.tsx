"use client";

import { useEffect, useState } from "react";
import {
  Ban,
  CalendarCheck,
  Heart,
  TrendingUp,
  UserPlus,
  Users,
  UserCheck2,
  Users2,
} from "lucide-react";
import { cn } from "@zindagi/shared";

type AdminPatientStats = {
  totals: {
    total: number;
    active: number;
    banned: number;
    onboardingCompleted: number;
    withFamilyMembers: number;
    newThisMonth: number;
    newLast30Days: number;
  };
  byCity: { city: string; count: number }[];
  byGender: { gender: string; count: number }[];
  byBloodGroup: { bloodGroup: string; count: number }[];
  byAgeBand: { band: string; count: number }[];
  appointmentActivity: {
    totalAppointments: number;
    completedAppointments: number;
    cancelledAppointments: number;
    noShowAppointments: number;
    byType: { type: string; count: number }[];
  };
  growth: { month: string; count: number }[];
  topChronicConditions: { condition: string; count: number }[];
  recentlyJoined: {
    id: string;
    name: string;
    city: string | null;
    isActive: boolean;
    createdAt: string;
  }[];
};

const KPI_CONFIG = [
  {
    key: "total" as const,
    label: "Total patients",
    icon: Users,
    accent: "text-brand bg-brand/10 border-brand/20",
  },
  {
    key: "active" as const,
    label: "Active accounts",
    icon: UserCheck2,
    accent: "text-emerald-600 bg-emerald-50 border-emerald-100",
  },
  {
    key: "newThisMonth" as const,
    label: "New this month",
    icon: UserPlus,
    accent: "text-blue-600 bg-blue-50 border-blue-100",
  },
  {
    key: "newLast30Days" as const,
    label: "New last 30 days",
    icon: TrendingUp,
    accent: "text-violet-600 bg-violet-50 border-violet-100",
  },
  {
    key: "onboardingCompleted" as const,
    label: "Onboarding complete",
    icon: CalendarCheck,
    accent: "text-teal-600 bg-teal-50 border-teal-100",
  },
  {
    key: "withFamilyMembers" as const,
    label: "With family members",
    icon: Users2,
    accent: "text-cyan-600 bg-cyan-50 border-cyan-100",
  },
  {
    key: "banned" as const,
    label: "Banned",
    icon: Ban,
    accent: "text-red-600 bg-red-50 border-red-100",
  },
];

function BarRow({
  label,
  count,
  max,
  colorClass = "bg-brand",
}: {
  label: string;
  count: number;
  max: number;
  colorClass?: string;
}) {
  const pct = max > 0 ? Math.max((count / max) * 100, 3) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="w-36 shrink-0 truncate text-sm text-slate-700" title={label}>
        {label}
      </span>
      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
        <div
          className={cn("h-full rounded-full", colorClass)}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-10 shrink-0 text-right text-sm font-semibold tabular-nums text-slate-900">
        {count}
      </span>
    </div>
  );
}

export function AdminPatientStats() {
  const [stats, setStats] = useState<AdminPatientStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/v1/admin/patient-stats")
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
            className="h-28 animate-pulse rounded-2xl border border-slate-200 bg-white"
          />
        ))}
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        Failed to load patient statistics.
      </div>
    );
  }

  const maxCityCount = Math.max(...stats.byCity.map((c) => c.count), 1);
  const maxGenderCount = Math.max(...stats.byGender.map((g) => g.count), 1);
  const maxBloodGroupCount = Math.max(...stats.byBloodGroup.map((b) => b.count), 1);
  const maxAgeCount = Math.max(...stats.byAgeBand.map((a) => a.count), 1);
  const maxTypeCount = Math.max(
    ...stats.appointmentActivity.byType.map((t) => t.count),
    1,
  );
  const maxConditionCount = Math.max(
    ...stats.topChronicConditions.map((c) => c.count),
    1,
  );
  const maxGrowthCount = Math.max(...stats.growth.map((g) => g.count), 1);

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {KPI_CONFIG.map((kpi) => {
          const Icon = kpi.icon;
          const value = stats.totals[kpi.key];
          return (
            <div
              key={kpi.key}
              className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm"
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
            </div>
          );
        })}
      </div>

      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-brand" />
          <h2 className="text-lg font-semibold text-slate-900">Signup growth</h2>
        </div>
        <p className="mt-1 text-sm text-slate-600">New patient signups over the last 6 months.</p>
        <div className="mt-6 flex items-end gap-3 sm:gap-4">
          {stats.growth.length === 0 && (
            <p className="text-sm text-slate-500">No signup data yet.</p>
          )}
          {stats.growth.map((row) => {
            const heightPct = Math.max((row.count / maxGrowthCount) * 100, 4);
            return (
              <div key={row.month} className="flex flex-1 flex-col items-center gap-2">
                <div className="flex h-32 w-full items-end">
                  <div
                    className="w-full rounded-t-lg bg-brand/80"
                    style={{ height: `${heightPct}%` }}
                    title={`${row.count} signups`}
                  />
                </div>
                <span className="text-xs font-semibold text-slate-900">{row.count}</span>
                <span className="text-xs text-slate-500">{row.month}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">By city</h2>
          <p className="mt-1 text-sm text-slate-600">Registered patients by city.</p>
          <div className="mt-6 space-y-3">
            {stats.byCity.length === 0 && (
              <p className="text-sm text-slate-500">No city data yet.</p>
            )}
            {stats.byCity.map((row) => (
              <BarRow
                key={row.city}
                label={row.city}
                count={row.count}
                max={maxCityCount}
                colorClass="bg-blue-500"
              />
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Age distribution</h2>
          <p className="mt-1 text-sm text-slate-600">Based on recorded date of birth.</p>
          <div className="mt-6 space-y-3">
            {stats.byAgeBand.map((row) => (
              <BarRow
                key={row.band}
                label={row.band}
                count={row.count}
                max={maxAgeCount}
                colorClass="bg-violet-500"
              />
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Gender</h2>
          <div className="mt-6 space-y-3">
            {stats.byGender.map((row) => (
              <BarRow
                key={row.gender}
                label={row.gender}
                count={row.count}
                max={maxGenderCount}
                colorClass="bg-cyan-500"
              />
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2">
            <Heart className="h-5 w-5 text-red-500" />
            <h2 className="text-lg font-semibold text-slate-900">Blood group</h2>
          </div>
          <div className="mt-6 space-y-3">
            {stats.byBloodGroup.map((row) => (
              <BarRow
                key={row.bloodGroup}
                label={row.bloodGroup}
                count={row.count}
                max={maxBloodGroupCount}
                colorClass="bg-red-500"
              />
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Top chronic conditions</h2>
          <div className="mt-6 space-y-3">
            {stats.topChronicConditions.length === 0 && (
              <p className="text-sm text-slate-500">No chronic conditions recorded.</p>
            )}
            {stats.topChronicConditions.map((row) => (
              <BarRow
                key={row.condition}
                label={row.condition}
                count={row.count}
                max={maxConditionCount}
                colorClass="bg-amber-500"
              />
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm lg:col-span-2">
          <h2 className="text-lg font-semibold text-slate-900">Appointment activity</h2>
          <p className="mt-1 text-sm text-slate-600">
            Lifetime appointment engagement across the patient base.
          </p>
          <dl className="mt-6 grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl bg-slate-50 p-4">
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Total booked
              </dt>
              <dd className="mt-1 text-2xl font-semibold text-slate-900">
                {stats.appointmentActivity.totalAppointments}
              </dd>
            </div>
            <div className="rounded-xl bg-slate-50 p-4">
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Completed
              </dt>
              <dd className="mt-1 text-2xl font-semibold text-slate-900">
                {stats.appointmentActivity.completedAppointments}
              </dd>
            </div>
            <div className="rounded-xl bg-slate-50 p-4">
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Cancelled
              </dt>
              <dd className="mt-1 text-2xl font-semibold text-slate-900">
                {stats.appointmentActivity.cancelledAppointments}
              </dd>
            </div>
            <div className="rounded-xl bg-slate-50 p-4 sm:col-span-3">
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                No-shows
              </dt>
              <dd className="mt-1 text-2xl font-semibold text-slate-900">
                {stats.appointmentActivity.noShowAppointments}
              </dd>
            </div>
          </dl>
          <div className="mt-6 space-y-3">
            {stats.appointmentActivity.byType.map((row) => (
              <BarRow
                key={row.type}
                label={row.type}
                count={row.count}
                max={maxTypeCount}
                colorClass="bg-emerald-500"
              />
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Recently joined</h2>
          <ul className="mt-4 space-y-3">
            {stats.recentlyJoined.length === 0 && (
              <p className="text-sm text-slate-500">No patients yet.</p>
            )}
            {stats.recentlyJoined.map((patient) => (
              <li
                key={patient.id}
                className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900">
                    {patient.name}
                  </p>
                  <p className="text-xs text-slate-500">
                    {patient.city ?? "Unknown city"} ·{" "}
                    {new Date(patient.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold",
                    patient.isActive
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-slate-200 text-slate-700",
                  )}
                >
                  {patient.isActive ? "Active" : "Inactive"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
