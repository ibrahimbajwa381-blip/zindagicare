"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { cn } from "@zindagi/shared";
import { Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingScreen } from "@/components/ui/loading-screen";

type AdminNurseRow = {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  city: string;
  licenseNumber?: string;
  qualification?: string;
  experienceYears?: number;
  cnicLast4?: string;
  verificationStatus: string;
  verificationSubmittedAt?: string;
  rejectionReason?: string;
  isAvailable: boolean;
  documents: { label: string; url: string }[];
  createdAt: string;
};

const FILTERS = [
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "", label: "All" },
] as const;

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  approved: { label: "Approved", className: "bg-emerald-100 text-emerald-800" },
  pending: { label: "Pending", className: "bg-amber-100 text-amber-800" },
  rejected: { label: "Rejected", className: "bg-red-100 text-red-700" },
};

export function AdminNurseQueue() {
  const [filter, setFilter] = useState<string>("pending");
  const [nurses, setNurses] = useState<AdminNurseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  const hasLoadedRef = useRef(false);
  useEffect(() => {
    let cancelled = false;
    if (!hasLoadedRef.current) setLoading(true);
    const qs = filter ? `?status=${filter}` : "";
    fetch(`/api/v1/admin/nurses${qs}`)
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return;
        if (json.success) {
          setError(undefined);
          setNurses(json.data?.nurses ?? []);
        } else {
          setError(json?.error?.message ?? "Failed to load nurses");
        }
        hasLoadedRef.current = true;
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setError("Failed to load nurses");
        hasLoadedRef.current = true;
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [filter]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setFilter(f.value)}
            className={cn(
              "rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
              filter === f.value
                ? "border-brand bg-brand text-white"
                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm">
          <LoadingScreen message="Loading nurses…" size="md" />
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
          {error}
        </div>
      ) : nurses.length === 0 ? (
        <div className="rounded-2xl border border-slate-200/80 bg-white p-12 text-center shadow-sm">
          <p className="font-medium text-slate-900">No nurses in this list</p>
          <p className="mt-2 text-sm text-slate-500">
            Nurses appear in the pending queue after onboarding and submitting their
            license documents.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {nurses.map((nurse) => {
            const badge =
              STATUS_BADGE[nurse.verificationStatus] ?? STATUS_BADGE.pending;
            const hasSubmitted = Boolean(nurse.verificationSubmittedAt);

            return (
              <div
                key={nurse.id}
                className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition hover:border-slate-300"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-slate-900">{nurse.name}</p>
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-0.5 text-xs font-semibold",
                          badge.className,
                        )}
                      >
                        {badge.label}
                      </span>
                      {!hasSubmitted && nurse.verificationStatus === "pending" && (
                        <Badge variant="outline" className="text-xs">
                          Documents not submitted
                        </Badge>
                      )}
                    </div>

                    <p className="text-sm text-slate-500">
                      {nurse.email ?? "—"} · {nurse.phone ?? "—"} · {nurse.city}
                    </p>

                    <dl className="grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
                      <div>
                        <dt className="text-xs uppercase tracking-wide text-slate-400">
                          License / PNC
                        </dt>
                        <dd className="font-mono text-xs text-slate-800">
                          {nurse.licenseNumber ?? "—"}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs uppercase tracking-wide text-slate-400">
                          Qualification
                        </dt>
                        <dd className="text-slate-800">
                          {nurse.qualification ?? "—"}
                          {nurse.experienceYears !== undefined
                            ? ` · ${nurse.experienceYears} yrs`
                            : ""}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs uppercase tracking-wide text-slate-400">
                          CNIC
                        </dt>
                        <dd className="text-slate-800">
                          {nurse.cnicLast4 ? `•••••-•••••${nurse.cnicLast4}` : "—"}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs uppercase tracking-wide text-slate-400">
                          Submitted
                        </dt>
                        <dd className="text-slate-800">
                          {nurse.verificationSubmittedAt
                            ? new Date(nurse.verificationSubmittedAt).toLocaleDateString(
                                "en-PK",
                                { dateStyle: "medium" },
                              )
                            : "—"}
                        </dd>
                      </div>
                    </dl>

                    {nurse.verificationStatus === "rejected" &&
                      nurse.rejectionReason && (
                        <p className="text-sm text-red-700">
                          Rejection reason: {nurse.rejectionReason}
                        </p>
                      )}
                  </div>

                  <div className="flex shrink-0">
                    <Button size="sm" asChild>
                      <Link href={`/admin/nurses/review/${nurse.id}`}>
                        <Eye className="h-4 w-4" />
                        View application
                      </Link>
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
