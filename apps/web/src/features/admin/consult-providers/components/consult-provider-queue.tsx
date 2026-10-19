"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Eye } from "lucide-react";
import { cn, VerificationStatuses } from "@zindagi/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LoadingScreen } from "@/components/ui/loading-screen";
import { errorMessage } from "@/features/admin/consult-providers/api";
import type { ConsultProviderKind } from "@/features/admin/consult-providers/config";
import { formatDate } from "@/features/admin/consult-providers/format";
import { useConsultProviderAdmin } from "@/features/admin/consult-providers/hooks";
import type { AdminConsultProviderRow } from "@/features/admin/consult-providers/types";
import {
  ProviderAvatar,
  ProviderStatusBadge,
} from "@/features/admin/consult-providers/components/shared";

const FILTERS = [
  { value: VerificationStatuses.PENDING, label: "Pending" },
  { value: VerificationStatuses.APPROVED, label: "Approved" },
  { value: VerificationStatuses.REJECTED, label: "Rejected" },
  { value: "", label: "All" },
] as const;

/** Verification queue: applications filtered by status, each linking to its review page. */
export function ConsultProviderQueue({ kind }: { kind: ConsultProviderKind }) {
  const { config, api } = useConsultProviderAdmin(kind);
  const [filter, setFilter] = useState<string>(VerificationStatuses.PENDING);
  const [rows, setRows] = useState<AdminConsultProviderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  useEffect(() => {
    let cancelled = false;
    api
      .list({ status: filter || undefined })
      .then((next) => {
        if (cancelled) return;
        setRows(next);
        setError(undefined);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(errorMessage(e, `Failed to load ${config.labels.pluralLower}`));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [api, config, filter]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => {
                if (f.value === filter) return;
                setLoading(true);
                setFilter(f.value);
              }}
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
        <Button variant="outline" size="sm" asChild>
          <Link href={config.routes.manage}>{config.labels.singular} management</Link>
        </Button>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm">
          <LoadingScreen message={`Loading ${config.labels.pluralLower}…`} size="md" />
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
          {error}
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-slate-200/80 bg-white p-12 text-center shadow-sm">
          <p className="font-medium text-slate-900">No {config.labels.pluralLower} in this list</p>
          <p className="mt-2 text-sm text-slate-500">
            {config.labels.plural} appear in the pending queue after signing up and submitting
            their verification documents.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {rows.map((row) => (
            <QueueCard key={row.id} row={row} reviewHref={config.routes.review(row.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

function QueueCard({ row, reviewHref }: { row: AdminConsultProviderRow; reviewHref: string }) {
  const hasSubmitted = Boolean(row.verificationSubmittedAt);
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition hover:border-slate-300">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 gap-4">
          <ProviderAvatar name={row.name} avatarUrl={row.avatarUrl} size="md" />
          <div className="min-w-0 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-semibold text-slate-900">{row.name}</p>
              <ProviderStatusBadge status={row.verificationStatus} />
              {!hasSubmitted && row.verificationStatus === VerificationStatuses.PENDING && (
                <Badge variant="outline" className="text-xs">
                  Documents not submitted
                </Badge>
              )}
            </div>
            <p className="text-sm text-slate-500">
              {[row.email, row.phone, row.city].filter(Boolean).join(" · ") || "—"}
            </p>
            <dl className="grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
              <QueueField label="Registration" mono value={row.licenseNumber} />
              <QueueField label="Primary specialty" value={row.primarySpecialty} />
              <QueueField label="Experience" value={`${row.experienceYears} yrs`} />
              <QueueField label="Submitted" value={formatDate(row.verificationSubmittedAt)} />
            </dl>
            {row.verificationStatus === VerificationStatuses.REJECTED && row.rejectionReason && (
              <p className="text-sm text-red-700">Rejection reason: {row.rejectionReason}</p>
            )}
          </div>
        </div>
        <div className="flex shrink-0">
          <Button size="sm" asChild>
            <Link href={reviewHref}>
              <Eye className="h-4 w-4" />
              View application
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

function QueueField({ label, value, mono }: { label: string; value?: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className={cn("text-slate-800", mono && "font-mono text-xs")}>{value || "—"}</dd>
    </div>
  );
}
