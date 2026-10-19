"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Banknote, TrendingUp, Wallet, Stethoscope } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingScreen } from "@/components/ui/loading-screen";
import { AdminDoctorAvatar } from "@/features/admin/components/admin-doctor-avatar";
import { AdminManualEarnings } from "@/features/admin/components/admin-manual-earnings";
import { surfaceCard } from "@/lib/ui/surfaces";
import type { AdminPlatformEarningsOverview } from "@/server/services/admin-platform-earnings.service";

function formatCurrency(amount: number) {
  return `PKR ${amount.toLocaleString("en-PK")}`;
}

export function AdminPlatformEarnings() {
  const [data, setData] = useState<AdminPlatformEarningsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const hasLoadedRef = useRef(false);
  const load = useCallback(async () => {
    if (!hasLoadedRef.current) setLoading(true);
    setError(undefined);
    const res = await fetch("/api/v1/admin/platform-earnings");
    const json = await res.json();
    if (json.success) {
      setData(json.data as AdminPlatformEarningsOverview);
    } else {
      setError(json?.error?.message ?? "Could not load platform earnings");
    }
    hasLoadedRef.current = true;
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return <LoadingScreen message="Loading platform earnings…" />;
  }

  if (error || !data) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        {error ?? "Could not load platform earnings."}
      </div>
    );
  }

  const { totals, byDoctor, unresolvedPayments, unresolvedPaymentsTotal, manualEntries, manualTotals } =
    data;

  const deleteAppointment = async (appointmentId: string, doctorName: string, patientName: string) => {
    if (
      !window.confirm(
        `Permanently delete this appointment (${doctorName} ↔ ${patientName})? This removes it and its payment record from the database and cannot be undone.`,
      )
    ) {
      return;
    }
    setDeletingId(appointmentId);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/v1/admin/appointments/${appointmentId}`, { method: "DELETE" });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.error?.message ?? "Failed to delete appointment");
      }
      await load();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Failed to delete appointment");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "ZindagiCare commission (all time)",
            value: formatCurrency(totals.platformCommission),
            icon: Wallet,
            accent: "text-brand bg-brand/10 border-brand/20",
          },
          {
            label: "Commission this month",
            value: formatCurrency(totals.platformCommissionThisMonth),
            icon: TrendingUp,
            accent: "text-emerald-600 bg-emerald-50 border-emerald-100",
          },
          {
            label: "Gross revenue collected",
            value: formatCurrency(totals.grossRevenue),
            icon: Banknote,
            accent: "text-blue-600 bg-blue-50 border-blue-100",
          },
          {
            label: "Paid to doctors & physios",
            value: formatCurrency(totals.doctorEarnings),
            icon: Stethoscope,
            accent: "text-violet-600 bg-violet-50 border-violet-100",
          },
        ].map((tile) => {
          const Icon = tile.icon;
          return (
            <div
              key={tile.label}
              className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-slate-500">{tile.label}</p>
                  <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
                    {tile.value}
                  </p>
                </div>
                <span
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${tile.accent}`}
                >
                  <Icon className="h-5 w-5" />
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <Card className={surfaceCard}>
        <CardHeader>
          <CardTitle className="text-base">Commission earned per doctor</CardTitle>
          <p className="text-sm text-slate-500">
            Gross revenue collected from patients, what each doctor was credited, and what
            ZindagiCare kept as commission — from completed, paid consultations only.
          </p>
        </CardHeader>
        <CardContent>
          {byDoctor.length === 0 ? (
            <p className="text-sm text-slate-500">No completed, paid consultations yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-3 py-2 font-medium">Doctor</th>
                    <th className="px-3 py-2 font-medium">Consults</th>
                    <th className="px-3 py-2 font-medium">Gross revenue</th>
                    <th className="px-3 py-2 font-medium">Paid to doctor</th>
                    <th className="px-3 py-2 font-medium">ZindagiCare commission</th>
                    <th className="px-3 py-2 font-medium">Amount to pay doctor</th>
                    <th className="px-3 py-2 font-medium">Commission %</th>
                    <th className="px-3 py-2 font-medium">Referrals</th>
                    <th className="px-3 py-2 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {byDoctor.map((doctor) => (
                    <tr key={doctor.id} className="border-b border-slate-100">
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-3">
                          <AdminDoctorAvatar
                            name={doctor.name}
                            avatarUrl={doctor.avatarUrl}
                            size="sm"
                          />
                          <div className="min-w-0">
                            <p className="font-medium text-slate-900">{doctor.name}</p>
                            <p className="truncate text-xs text-slate-500">
                              {doctor.specialties.join(", ") || "—"}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-slate-600">
                        {doctor.consultCount}
                        {doctor.manualCount > 0 && (
                          <span className="block text-xs text-slate-400">
                            incl. {doctor.manualCount} manual
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-slate-600">
                        {formatCurrency(doctor.grossRevenue)}
                      </td>
                      <td className="px-3 py-3 text-slate-600">
                        {formatCurrency(doctor.doctorEarnings)}
                      </td>
                      <td className="px-3 py-3 font-semibold text-slate-900">
                        {formatCurrency(doctor.platformCommission)}
                      </td>
                      <td className="px-3 py-3">
                        {doctor.balanceDue > 0 ? (
                          <span className="font-semibold text-amber-700">
                            {formatCurrency(doctor.balanceDue)}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">Settled</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-slate-600">
                        {doctor.platformOnlineCommissionPercent}% online ·{" "}
                        {doctor.platformHomeVisitCommissionPercent}% in-house
                      </td>
                      <td className="px-3 py-3">
                        {doctor.referredPatientCount > 0 ? (
                          <span className="rounded-full bg-brand/10 px-2.5 py-0.5 text-xs font-semibold text-brand">
                            {doctor.referredPatientCount} referred
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <Link
                          href={`/admin/finances/${doctor.id}`}
                          className="text-sm font-medium text-brand hover:underline"
                        >
                          Details
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <AdminManualEarnings entries={manualEntries} totals={manualTotals} onChange={load} />

      <Card className="border-amber-200 bg-amber-50/40 shadow-sm">
        <CardHeader className="flex flex-row items-start gap-3 space-y-0">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-amber-200 bg-amber-100 text-amber-700">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-base">
              Payments collected, consult never held ({formatCurrency(unresolvedPaymentsTotal)})
            </CardTitle>
            <p className="mt-1 text-sm text-slate-600">
              Money was collected from the patient, but neither the doctor nor the patient
              joined a video call — like Dr. Aamina and Sajid Mehmood Awan. These consults
              haven&apos;t been marked completed, so nothing has been credited to the doctor
              yet. Review and either reschedule, mark as a no-show, or refund.
            </p>
          </div>
        </CardHeader>
        <CardContent>
          {unresolvedPayments.length === 0 ? (
            <p className="text-sm text-slate-500">
              None right now — every paid consult has had at least one side join.
            </p>
          ) : (
            <div className="overflow-x-auto">
              {deleteError && <p className="mb-2 text-sm text-red-600">{deleteError}</p>}
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-amber-200/60 text-xs uppercase tracking-wide text-amber-800/70">
                    <th className="px-3 py-2 font-medium">Scheduled</th>
                    <th className="px-3 py-2 font-medium">Doctor</th>
                    <th className="px-3 py-2 font-medium">Patient</th>
                    <th className="px-3 py-2 font-medium">Amount</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Age</th>
                    <th className="px-3 py-2 font-medium" />
                    <th className="px-3 py-2 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {unresolvedPayments.map((row) => (
                    <tr key={row.appointmentId} className="border-b border-amber-100">
                      <td className="whitespace-nowrap px-3 py-3 text-slate-700">
                        {new Date(row.scheduledStart).toLocaleString("en-PK", {
                          timeZone: "Asia/Karachi",
                        })}
                      </td>
                      <td className="px-3 py-3 font-medium text-slate-900">{row.doctorName}</td>
                      <td className="px-3 py-3 text-slate-700">{row.patientName}</td>
                      <td className="px-3 py-3 text-slate-700">
                        {formatCurrency(row.amountPkr)}
                      </td>
                      <td className="px-3 py-3 capitalize text-slate-700">{row.status}</td>
                      <td className="px-3 py-3">
                        <span
                          className={
                            row.daysSinceScheduled >= 1
                              ? "rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800"
                              : "text-xs text-slate-500"
                          }
                        >
                          {row.daysSinceScheduled === 0
                            ? "Today"
                            : `${row.daysSinceScheduled}d ago`}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        {row.doctorId && (
                          <Link
                            href={`/admin/finances/${row.doctorId}`}
                            className="text-sm font-medium text-brand hover:underline"
                          >
                            Details
                          </Link>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <button
                          type="button"
                          onClick={() =>
                            deleteAppointment(row.appointmentId, row.doctorName, row.patientName)
                          }
                          disabled={deletingId === row.appointmentId}
                          className="rounded-md border border-red-200 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                        >
                          {deletingId === row.appointmentId ? "Deleting…" : "Delete"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
