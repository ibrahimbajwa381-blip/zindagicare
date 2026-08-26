"use client";

import { useEffect, useState } from "react";
import { Receipt } from "lucide-react";
import { formatPkr } from "@/features/herbalist/types";
import type { HerbalistFinanceAppointmentRow } from "@/server/services/admin-herbalist-finance.service";

export function HerbalistEarningEligibilityCard() {
  const [rows, setRows] = useState<HerbalistFinanceAppointmentRow[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/v1/herbalist/earnings/eligibility")
      .then((res) => res.json())
      .then((json) => {
        if (!cancelled && json.success) {
          setRows(json.data.appointments as HerbalistFinanceAppointmentRow[]);
        }
      })
      .catch(() => null);
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-4">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600">
            <Receipt className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-slate-900">
              Why a consult did or didn&rsquo;t pay
            </h3>
            <p className="mt-0.5 text-xs text-slate-500">
              Every appointment and whether it counted toward your earnings.
            </p>
          </div>
        </div>
      </div>

      {rows === null ? (
        <p className="px-5 py-8 text-center text-sm text-slate-500">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-slate-500">
          No appointments yet.
        </p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {rows.map((row) => (
            <li key={row.id} className="px-5 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-slate-900">
                  {row.patientName}
                  <span className="ml-2 text-xs font-normal text-slate-500">
                    {new Date(row.scheduledStart).toLocaleDateString("en-PK", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                </p>
                <span
                  className={
                    row.earningCounted
                      ? "rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700"
                      : "rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600"
                  }
                >
                  {row.earningCounted ? formatPkr(row.earningAmount) : "Not counted"}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500">{row.reason}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
