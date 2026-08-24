"use client";

import { useEffect, useState } from "react";
import {
  BadgeCheck,
  Banknote,
  Clock,
  Home,
  Stethoscope,
  Sun,
  UserCheck,
  Users,
  Video,
  Zap,
} from "lucide-react";
import { cn } from "@zindagi/shared";

type AdminDoctorStats = {
  totals: {
    total: number;
    listed: number;
    approved: number;
    pending: number;
    rejected: number;
    restricted: number;
    pmdcVerified: number;
    videoConsultEnabled: number;
    urgentConsultEnabled: number;
    sundayConsultEnabled: number;
    homeVisitEnabled: number;
  };
  bySpecialty: { specialty: string; count: number }[];
  byCity: { city: string; count: number }[];
  byExperienceBand: { band: string; count: number }[];
  ratingDistribution: { band: string; count: number }[];
  feeStats: {
    avgConsultationFee: number;
    minConsultationFee: number;
    maxConsultationFee: number;
  };
  recentlyJoined: {
    id: string;
    name: string;
    specialty: string | null;
    city: string | null;
    verificationStatus: string;
    createdAt: string;
  }[];
};

const KPI_CONFIG = [
  {
    key: "total" as const,
    label: "Total doctors",
    icon: Stethoscope,
    accent: "text-brand bg-brand/10 border-brand/20",
  },
  {
    key: "listed" as const,
    label: "Live on platform",
    icon: Users,
    accent: "text-blue-600 bg-blue-50 border-blue-100",
  },
  {
    key: "approved" as const,
    label: "Approved",
    icon: BadgeCheck,
    accent: "text-emerald-600 bg-emerald-50 border-emerald-100",
  },
  {
    key: "pending" as const,
    label: "Pending review",
    icon: UserCheck,
    accent: "text-amber-600 bg-amber-50 border-amber-100",
  },
  {
    key: "pmdcVerified" as const,
    label: "PMDC verified",
    icon: BadgeCheck,
    accent: "text-teal-600 bg-teal-50 border-teal-100",
  },
  {
    key: "videoConsultEnabled" as const,
    label: "Video consult enabled",
    icon: Video,
    accent: "text-violet-600 bg-violet-50 border-violet-100",
  },
  {
    key: "urgentConsultEnabled" as const,
    label: "Urgent care enabled",
    icon: Zap,
    accent: "text-red-600 bg-red-50 border-red-100",
  },
  {
    key: "sundayConsultEnabled" as const,
    label: "Sunday free consult",
    icon: Sun,
    accent: "text-orange-600 bg-orange-50 border-orange-100",
  },
  {
    key: "homeVisitEnabled" as const,
    label: "Home visits enabled",
    icon: Home,
    accent: "text-cyan-600 bg-cyan-50 border-cyan-100",
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

function verificationBadge(status: string) {
  const map: Record<string, string> = {
    approved: "bg-emerald-100 text-emerald-800",
    pending: "bg-amber-100 text-amber-800",
    rejected: "bg-red-100 text-red-800",
    restricted: "bg-slate-200 text-slate-700",
  };
  return map[status] ?? "bg-slate-100 text-slate-700";
}

export function AdminDoctorStats() {
  const [stats, setStats] = useState<AdminDoctorStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/v1/admin/doctor-stats")
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setStats(json.data);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 9 }).map((_, i) => (
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
        Failed to load doctor statistics.
      </div>
    );
  }

  const maxSpecialtyCount = Math.max(...stats.bySpecialty.map((s) => s.count), 1);
  const maxCityCount = Math.max(...stats.byCity.map((c) => c.count), 1);
  const maxExperienceCount = Math.max(
    ...stats.byExperienceBand.map((e) => e.count),
    1,
  );
  const maxRatingCount = Math.max(...stats.ratingDistribution.map((r) => r.count), 1);

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

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">By specialty</h2>
          <p className="mt-1 text-sm text-slate-600">
            Admin-verified specialties across all doctors (top 20).
          </p>
          <div className="mt-6 space-y-3">
            {stats.bySpecialty.length === 0 && (
              <p className="text-sm text-slate-500">No specialty data yet.</p>
            )}
            {stats.bySpecialty.map((row) => (
              <BarRow
                key={row.specialty}
                label={row.specialty}
                count={row.count}
                max={maxSpecialtyCount}
              />
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">By city</h2>
          <p className="mt-1 text-sm text-slate-600">
            Hospital/clinic city coverage across doctors.
          </p>
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
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Experience</h2>
          <div className="mt-6 space-y-3">
            {stats.byExperienceBand.map((row) => (
              <BarRow
                key={row.band}
                label={row.band}
                count={row.count}
                max={maxExperienceCount}
                colorClass="bg-violet-500"
              />
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Rating distribution</h2>
          <div className="mt-6 space-y-3">
            {stats.ratingDistribution.map((row) => (
              <BarRow
                key={row.band}
                label={row.band}
                count={row.count}
                max={maxRatingCount}
                colorClass="bg-amber-500"
              />
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2">
            <Banknote className="h-5 w-5 text-brand" />
            <h2 className="text-lg font-semibold text-slate-900">Consultation fee</h2>
          </div>
          <dl className="mt-6 space-y-4">
            <div className="rounded-xl bg-slate-50 p-4">
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Average
              </dt>
              <dd className="mt-1 text-2xl font-semibold text-slate-900">
                Rs {stats.feeStats.avgConsultationFee.toLocaleString()}
              </dd>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-slate-50 p-4">
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Min
                </dt>
                <dd className="mt-1 text-lg font-semibold text-slate-900">
                  Rs {stats.feeStats.minConsultationFee.toLocaleString()}
                </dd>
              </div>
              <div className="rounded-xl bg-slate-50 p-4">
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Max
                </dt>
                <dd className="mt-1 text-lg font-semibold text-slate-900">
                  Rs {stats.feeStats.maxConsultationFee.toLocaleString()}
                </dd>
              </div>
            </div>
          </dl>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-brand" />
          <h2 className="text-lg font-semibold text-slate-900">Recently joined</h2>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs font-medium uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-4">Name</th>
                <th className="py-2 pr-4">Specialty</th>
                <th className="py-2 pr-4">City</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4">Joined</th>
              </tr>
            </thead>
            <tbody>
              {stats.recentlyJoined.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-4 text-slate-500">
                    No doctors yet.
                  </td>
                </tr>
              )}
              {stats.recentlyJoined.map((doc) => (
                <tr key={doc.id} className="border-b border-slate-100 last:border-0">
                  <td className="py-2.5 pr-4 font-medium text-slate-900">{doc.name}</td>
                  <td className="py-2.5 pr-4 text-slate-600">
                    {doc.specialty ?? "—"}
                  </td>
                  <td className="py-2.5 pr-4 text-slate-600">{doc.city ?? "—"}</td>
                  <td className="py-2.5 pr-4">
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize",
                        verificationBadge(doc.verificationStatus),
                      )}
                    >
                      {doc.verificationStatus}
                    </span>
                  </td>
                  <td className="py-2.5 pr-4 text-slate-600">
                    {new Date(doc.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
