"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Video } from "lucide-react";
import { formatPkr } from "@/features/herbalist/types";
import type { HerbalistRequestRow } from "@/server/services/herbalist-dashboard.service";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "upcoming", label: "Upcoming" },
  { key: "completed", label: "Completed" },
  { key: "missed", label: "Missed" },
  { key: "cancelled", label: "Cancelled" },
] as const;

type FilterKey = (typeof FILTERS)[number]["key"];

const OUTCOME_STYLES: Record<string, string> = {
  completed: "bg-emerald-50 text-emerald-700",
  missed: "bg-red-50 text-red-700",
  cancelled: "bg-slate-100 text-slate-600",
  upcoming: "bg-blue-50 text-blue-700",
  in_progress: "bg-amber-50 text-amber-700",
  pending: "bg-amber-50 text-amber-700",
};

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString("en-PK", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function HerbalistConsultRequestsPanel({
  requests,
}: {
  requests: HerbalistRequestRow[];
}) {
  const [filter, setFilter] = useState<FilterKey>("all");

  const visible = useMemo(() => {
    if (filter === "all") return requests;
    if (filter === "upcoming") {
      return requests.filter(
        (r) =>
          r.outcome === "upcoming" ||
          r.outcome === "pending" ||
          r.outcome === "in_progress",
      );
    }
    return requests.filter((r) => r.outcome === filter);
  }, [requests, filter]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={
              filter === f.key
                ? "rounded-full bg-brand px-3.5 py-1.5 text-xs font-semibold text-white"
                : "rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-medium text-slate-600 hover:border-brand/40 hover:text-brand"
            }
          >
            {f.label}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="rounded-2xl border border-slate-200/80 bg-white p-8 text-center shadow-sm">
          <p className="text-sm text-slate-500">No consultations to show.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {visible.map((request) => (
            <li
              key={request.id}
              className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900">
                    {request.patient.name}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {formatWhen(request.scheduledStart)}
                    {request.consultationFee
                      ? ` · ${formatPkr(request.consultationFee)}`
                      : ""}
                  </p>
                  {request.patientNotes && (
                    <p className="mt-2 text-sm text-slate-600">
                      {request.patientNotes}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      OUTCOME_STYLES[request.outcome] ??
                      "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {request.outcome.replace("_", " ")}
                  </span>
                  {request.canJoin && (
                    <Link
                      href={`/consult/video/${request.id}`}
                      className="inline-flex items-center gap-1.5 rounded-full bg-brand px-3.5 py-1.5 text-xs font-semibold text-white"
                    >
                      <Video className="h-3.5 w-3.5" />
                      Join
                    </Link>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
