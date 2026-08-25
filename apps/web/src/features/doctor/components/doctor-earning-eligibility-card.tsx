"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, ListChecks, XCircle } from "lucide-react";
import { cn } from "@zindagi/shared";

type EarningEligibilityAppointment = {
  id: string;
  scheduledStart: string;
  type: string;
  status: string;
  patientName: string;
  amountPkr?: number;
  paymentStatus?: string;
  patientJoinedAt?: string;
  doctorJoinedAt?: string;
  earningCounted: boolean;
  earningAmount: number;
  reason: string;
};

function formatCurrency(amount: number) {
  return `PKR ${amount.toLocaleString("en-PK")}`;
}

export function DoctorEarningEligibilityCard() {
  const [appointments, setAppointments] = useState<EarningEligibilityAppointment[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  const load = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    const res = await fetch("/api/v1/doctor/earnings/eligibility");
    const json = await res.json();
    if (json.success) {
      setAppointments(json.data.appointments as EarningEligibilityAppointment[]);
    } else {
      setError(json?.error?.message ?? "Could not load earning eligibility");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-4">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600">
            <ListChecks className="h-4.5 w-4.5" />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              How your consults get paid
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Your last 100 appointments, with the exact reason each one did or didn&apos;t
              count toward your earnings.
            </p>
          </div>
        </div>
      </div>

      <div className="p-5">
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : !appointments || appointments.length === 0 ? (
          <p className="text-sm text-slate-500">No appointments yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-2 font-medium">Date</th>
                  <th className="px-3 py-2 font-medium">Patient</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Payment</th>
                  <th className="px-3 py-2 font-medium">Patient joined</th>
                  <th className="px-3 py-2 font-medium">You joined</th>
                  <th className="px-3 py-2 font-medium">Earning</th>
                  <th className="px-3 py-2 font-medium">Reason</th>
                </tr>
              </thead>
              <tbody>
                {appointments.map((a) => (
                  <tr key={a.id} className="border-b border-slate-100 align-top">
                    <td className="whitespace-nowrap px-3 py-3 text-slate-600">
                      {new Date(a.scheduledStart).toLocaleString("en-PK", {
                        timeZone: "Asia/Karachi",
                      })}
                    </td>
                    <td className="px-3 py-3 font-medium text-slate-900">{a.patientName}</td>
                    <td className="px-3 py-3 capitalize text-slate-600">{a.status}</td>
                    <td className="px-3 py-3 text-slate-600">
                      {a.amountPkr != null ? formatCurrency(a.amountPkr) : "—"}
                      {a.paymentStatus && (
                        <span className="ml-1 text-xs capitalize text-slate-400">
                          ({a.paymentStatus})
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      {a.patientJoinedAt ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <XCircle className="h-4 w-4 text-slate-300" />
                      )}
                    </td>
                    <td className="px-3 py-3">
                      {a.doctorJoinedAt ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <XCircle className="h-4 w-4 text-slate-300" />
                      )}
                    </td>
                    <td className="px-3 py-3">
                      {a.earningCounted ? (
                        <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
                          +{formatCurrency(a.earningAmount)}
                        </span>
                      ) : (
                        <span className={cn(
                          "rounded-full px-2.5 py-0.5 text-xs font-semibold",
                          "bg-slate-100 text-slate-600",
                        )}>
                          Not counted
                        </span>
                      )}
                    </td>
                    <td className="max-w-xs px-3 py-3 text-xs text-slate-500">{a.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
