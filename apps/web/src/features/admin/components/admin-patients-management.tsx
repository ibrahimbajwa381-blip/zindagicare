"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Search, Settings2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { AdminPatientRow } from "@/server/services/admin-patient.service";
import { cn } from "@zindagi/shared";

function formatCurrency(amount: number) {
  return `PKR ${amount.toLocaleString("en-PK")}`;
}

function AccountStatusBadge({ patient }: { patient: AdminPatientRow }) {
  if (!patient.isActive) {
    return <Badge variant="outline">Inactive</Badge>;
  }
  if (patient.isBanned) {
    return (
      <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-800">
        Banned
      </span>
    );
  }
  if (patient.sundayBanned) {
    return (
      <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
        Sunday restricted
      </span>
    );
  }
  if (patient.noShowCount >= 2) {
    return (
      <span className="rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-semibold text-orange-800">
        {patient.noShowCount} no-shows
      </span>
    );
  }
  return (
    <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
      Active
    </span>
  );
}

export function AdminPatientsManagement() {
  const [patients, setPatients] = useState<AdminPatientRow[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "banned" | "inactive">("all");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const q = search ? `?search=${encodeURIComponent(search)}` : "";
    const res = await fetch(`/api/v1/admin/patients${q}`);
    const json = await res.json();
    if (json.success) setPatients(json.data?.patients ?? []);
    setLoading(false);
  }, [search]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    return patients.filter((p) => {
      if (filter === "active") return p.isActive && !p.isBanned;
      if (filter === "banned") return p.isBanned || p.sundayBanned;
      if (filter === "inactive") return !p.isActive;
      return true;
    });
  }, [patients, filter]);

  const stats = useMemo(
    () => ({
      total: patients.length,
      active: patients.filter((p) => p.isActive && !p.isBanned).length,
      banned: patients.filter((p) => p.isBanned || p.sundayBanned).length,
      withBookings: patients.filter((p) => p.stats.totalAppointments > 0).length,
    }),
    [patients],
  );

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Total patients", value: stats.total },
          { label: "Active accounts", value: stats.active },
          { label: "Restricted / banned", value: stats.banned },
          { label: "With bookings", value: stats.withBookings },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm"
          >
            <p className="text-sm font-medium text-slate-500">{s.label}</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="relative flex-1 sm:max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Search by name, email, or phone…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {(
            [
              { value: "all", label: "All" },
              { value: "active", label: "Active" },
              { value: "banned", label: "Restricted" },
              { value: "inactive", label: "Inactive" },
            ] as const
          ).map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-sm font-medium transition",
                filter === f.value
                  ? "bg-brand text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200",
              )}
            >
              {f.label}
            </button>
          ))}
          <Button type="button" variant="outline" onClick={() => load()}>
            Search
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        {loading ? (
          <div className="p-12 text-center text-sm text-slate-500">Loading patients…</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 p-16 text-center">
            <Users className="h-10 w-10 text-slate-300" />
            <p className="text-sm text-slate-500">No patients found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-5 py-4">Patient</th>
                  <th className="px-5 py-4">City</th>
                  <th className="px-5 py-4">Account</th>
                  <th className="px-5 py-4">Care activity</th>
                  <th className="px-5 py-4">Spend</th>
                  <th className="px-5 py-4">Joined</th>
                  <th className="px-5 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((patient) => (
                  <tr key={patient.id} className="transition hover:bg-slate-50/60">
                    <td className="px-5 py-4">
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900">{patient.name}</p>
                        <p className="truncate text-xs text-slate-500">
                          {[patient.email, patient.phone].filter(Boolean).join(" · ") || "—"}
                        </p>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {patient.emailVerified && (
                            <Badge variant="outline" className="text-[10px]">
                              Email verified
                            </Badge>
                          )}
                          {patient.phoneVerified && (
                            <Badge variant="outline" className="text-[10px]">
                              Phone verified
                            </Badge>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-slate-600">{patient.city ?? "—"}</td>
                    <td className="px-5 py-4">
                      <AccountStatusBadge patient={patient} />
                      {patient.noShowCount > 0 && !patient.sundayBanned && (
                        <p className="mt-1 text-xs text-slate-500">
                          {patient.noShowCount} no-show{patient.noShowCount === 1 ? "" : "s"}
                        </p>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <p className="font-medium text-slate-900">
                        {patient.stats.totalAppointments} appointments
                      </p>
                      <p className="text-xs text-slate-500">
                        {patient.stats.upcomingAppointments} upcoming ·{" "}
                        {patient.stats.homeVisitsTotal} home visits
                        {patient.stats.homeVisitsActive > 0 &&
                          ` · ${patient.stats.homeVisitsActive} active`}
                      </p>
                    </td>
                    <td className="px-5 py-4">
                      <p className="font-medium text-slate-900">
                        {formatCurrency(patient.stats.totalSpend)}
                      </p>
                      <p className="text-xs text-slate-500">
                        {formatCurrency(patient.stats.spendThisMonth)} this month
                      </p>
                    </td>
                    <td className="px-5 py-4 text-slate-600">
                      {new Date(patient.createdAt).toLocaleDateString("en-PK", {
                        dateStyle: "medium",
                      })}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <Button size="sm" variant="outline" asChild>
                        <Link href={`/admin/patients/${patient.id}`}>
                          <Settings2 className="h-4 w-4" />
                          Manage
                        </Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
