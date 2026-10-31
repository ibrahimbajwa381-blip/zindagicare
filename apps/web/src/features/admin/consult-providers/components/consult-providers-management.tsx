"use client";

import Link from "next/link";
import { Fragment, useEffect, useMemo, useState } from "react";
import { Check, Copy, Eye, Plus, Search, Settings2, Star, Trash2, Users } from "lucide-react";
import { cn, VerificationStatuses } from "@zindagi/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadingScreen } from "@/components/ui/loading-screen";
import { dispatchAdminNavCountsRefresh } from "@/features/admin/lib/nav-counts-events";
import { errorMessage } from "@/features/admin/consult-providers/api";
import type { ConsultProviderKind } from "@/features/admin/consult-providers/config";
import { formatCurrency } from "@/features/admin/consult-providers/format";
import { useConsultProviderAdmin } from "@/features/admin/consult-providers/hooks";
import type { AdminConsultProviderRow } from "@/features/admin/consult-providers/types";
import {
  changeVerificationStatus,
  RESTRICTED_STATUS,
  statusRequiresReason,
} from "@/features/admin/consult-providers/verification";
import { ConsultProviderCreateForm } from "@/features/admin/consult-providers/components/consult-provider-create-form";
import {
  DeleteProviderDialog,
  NoticeBanner,
  ProviderAvatar,
  ProviderStatusBadge,
  ReasonDialog,
  StatTile,
  VerificationStatusSelect,
} from "@/features/admin/consult-providers/components/shared";

const SEARCH_DEBOUNCE_MS = 300;

const STATUS_FILTERS = [
  { value: "", label: "All" },
  { value: VerificationStatuses.APPROVED, label: "Approved" },
  { value: VerificationStatuses.PENDING, label: "Pending" },
  { value: VerificationStatuses.REJECTED, label: "Rejected" },
  { value: RESTRICTED_STATUS, label: "Restricted" },
] as const;

function isBookable(row: AdminConsultProviderRow): boolean {
  return (
    row.verificationStatus === VerificationStatuses.APPROVED &&
    row.isActive &&
    row.isListed &&
    row.videoConsultEnabled
  );
}

type PendingStatus = { row: AdminConsultProviderRow; next: string };

/** Directory of every provider of one kind with inline account controls. */
export function ConsultProvidersManagement({ kind }: { kind: ConsultProviderKind }) {
  const { config, api } = useConsultProviderAdmin(kind);
  const { singular, singularLower, plural, pluralLower } = config.labels;

  const [rows, setRows] = useState<AdminConsultProviderRow[]>([]);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [statusChange, setStatusChange] = useState<PendingStatus | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminConsultProviderRow | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [copiedPhoneId, setCopiedPhoneId] = useState<string | null>(null);
  // Bumping this re-runs the fetch effect (after create / delete / status change / retry).
  const [reloadKey, setReloadKey] = useState(0);
  const reload = () => setReloadKey((k) => k + 1);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    // Ignore responses from superseded requests (fast typing, reloads).
    let cancelled = false;
    api
      .list({ search: debouncedSearch || undefined, status: statusFilter || undefined })
      .then((next) => {
        if (cancelled) return;
        setRows(next);
        setLoadError(null);
      })
      .catch((e: unknown) => {
        if (!cancelled) setLoadError(errorMessage(e, `Failed to load ${pluralLower}`));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [api, debouncedSearch, statusFilter, reloadKey, pluralLower]);

  const stats = useMemo(
    () => ({
      total: rows.length,
      approved: rows.filter((r) => r.verificationStatus === VerificationStatuses.APPROVED).length,
      pending: rows.filter((r) => r.verificationStatus === VerificationStatuses.PENDING).length,
      bookable: rows.filter(isBookable).length,
      consults: rows.reduce((sum, r) => sum + r.completedConsults, 0),
    }),
    [rows],
  );

  const runRowAction = async (id: string, action: () => Promise<void>) => {
    setPendingId(id);
    setActionError(null);
    try {
      await action();
    } catch (e) {
      setActionError(errorMessage(e, "Update failed"));
    } finally {
      setPendingId(null);
    }
  };

  const updateRow = (row: AdminConsultProviderRow, patch: Record<string, unknown>) =>
    runRowAction(row.id, async () => {
      const updated = await api.update(row.id, patch);
      setRows((prev) => prev.map((r) => (r.id === row.id ? updated : r)));
    });

  const applyStatus = (row: AdminConsultProviderRow, next: string, reason?: string) =>
    runRowAction(row.id, async () => {
      await changeVerificationStatus(api, row, next, reason);
      setStatusChange(null);
      dispatchAdminNavCountsRefresh();
      reload();
    });

  const handleStatusSelect = (row: AdminConsultProviderRow, next: string) => {
    if (next === row.verificationStatus) return;
    if (statusRequiresReason(next)) {
      setStatusChange({ row, next });
      return;
    }
    void applyStatus(row, next);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setPendingId(deleteTarget.id);
    setDeleteError(null);
    try {
      await api.remove(deleteTarget.id);
      setDeleteTarget(null);
      setExpandedId(null);
      dispatchAdminNavCountsRefresh();
      reload();
    } catch (e) {
      setDeleteError(errorMessage(e, `Failed to remove ${singularLower}`));
    } finally {
      setPendingId(null);
    }
  };

  const copyPhone = async (rowId: string, phone: string) => {
    try {
      await navigator.clipboard.writeText(phone);
      setCopiedPhoneId(rowId);
      setTimeout(() => setCopiedPhoneId((c) => (c === rowId ? null : c)), 2000);
    } catch {
      // Clipboard API unavailable (e.g. non-HTTPS host) — let the admin copy manually.
      window.prompt("Copy the phone number:", phone);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatTile label={`Total ${pluralLower}`} value={String(stats.total)} />
        <StatTile label="Approved" value={String(stats.approved)} />
        <StatTile label="Pending" value={String(stats.pending)} />
        <StatTile label="Bookable now" value={String(stats.bookable)} />
        <StatTile label="Completed consults" value={String(stats.consults)} />
      </div>

      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1 sm:max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Search by name, email, phone, license, or specialty…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 sm:pl-9"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" asChild>
              <Link href={config.routes.queue}>Pending applications</Link>
            </Button>
            <Button type="button" onClick={() => setShowForm((v) => !v)}>
              <Plus className="h-4 w-4" />
              {showForm ? "Cancel" : `Add ${singularLower}`}
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => {
                if (f.value === statusFilter) return;
                setLoading(true);
                setStatusFilter(f.value);
              }}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                statusFilter === f.value
                  ? "border-brand bg-brand text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <NoticeBanner error={actionError} onDismiss={() => setActionError(null)} />

      {showForm && (
        <ConsultProviderCreateForm
          config={config}
          api={api}
          onCreated={() => {
            setShowForm(false);
            reload();
          }}
        />
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        {loading ? (
          <LoadingScreen message={`Loading ${pluralLower}…`} size="md" />
        ) : loadError ? (
          <div className="flex flex-col items-center gap-3 p-16 text-center">
            <p className="text-sm text-red-600">{loadError}</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setLoading(true);
                reload();
              }}
            >
              Try again
            </Button>
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center gap-3 p-16 text-center">
            <Users className="h-10 w-10 text-slate-300" />
            <p className="text-sm text-slate-500">
              {debouncedSearch || statusFilter
                ? `No ${pluralLower} match these filters.`
                : `No ${pluralLower} yet. Approved applications and manually added ${pluralLower} appear here.`}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full table-fixed text-left text-sm">
              <colgroup>
                <col className="w-[28%]" />
                <col className="w-[18%]" />
                <col className="hidden lg:table-column lg:w-[12%]" />
                <col className="w-[15%]" />
                <col className="hidden md:table-column md:w-[12%]" />
                <col />
              </colgroup>
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-5 py-4">{singular}</th>
                  <th className="px-5 py-4">Specialty</th>
                  <th className="hidden px-5 py-4 lg:table-cell">License</th>
                  <th className="px-5 py-4">Status</th>
                  <th className="hidden px-5 py-4 md:table-cell">Consults</th>
                  <th className="px-5 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row) => {
                  const busy = pendingId === row.id;
                  const isApproved = row.verificationStatus === VerificationStatuses.APPROVED;
                  const publicPath =
                    isApproved && row.isActive && row.slug
                      ? config.publicProfilePath(row.slug)
                      : null;
                  return (
                    <Fragment key={row.id}>
                      <tr className="transition hover:bg-slate-50/60">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <ProviderAvatar name={row.name} avatarUrl={row.avatarUrl} size="md" />
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-slate-900">{row.name}</p>
                              {row.email && (
                                <p className="truncate text-xs text-slate-500">{row.email}</p>
                              )}
                              {row.phone && (
                                <div className="flex items-center gap-1 text-xs text-slate-500">
                                  <span className="select-all font-mono">{row.phone}</span>
                                  <button
                                    type="button"
                                    onClick={() => void copyPhone(row.id, row.phone!)}
                                    className="rounded p-0.5 text-slate-400 transition hover:bg-slate-100 hover:text-brand"
                                    aria-label={`Copy phone number of ${row.name}`}
                                    title={copiedPhoneId === row.id ? "Copied" : "Copy phone number"}
                                  >
                                    {copiedPhoneId === row.id ? (
                                      <Check className="h-3.5 w-3.5 text-emerald-600" />
                                    ) : (
                                      <Copy className="h-3.5 w-3.5" />
                                    )}
                                  </button>
                                </div>
                              )}
                              {row.city && (
                                <p className="truncate text-xs text-slate-400">{row.city}</p>
                              )}
                              {!row.isActive && (
                                <Badge variant="outline" className="mt-1 text-[10px]">
                                  Inactive
                                </Badge>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <SpecialtyCell
                            specialties={row.specialties}
                            fallback={row.primarySpecialty}
                          />
                        </td>
                        <td className="hidden truncate px-5 py-4 font-mono text-xs text-slate-600 lg:table-cell">
                          {row.licenseNumber ?? "—"}
                        </td>
                        <td className="px-5 py-4">
                          <VerificationStatusSelect
                            compact
                            value={row.verificationStatus}
                            disabled={busy}
                            ariaLabel={`Verification status for ${row.name}`}
                            onChange={(next) => handleStatusSelect(row, next)}
                          />
                          <div className="mt-1.5">
                            <ProviderStatusBadge status={row.verificationStatus} />
                          </div>
                        </td>
                        <td className="hidden px-5 py-4 md:table-cell">
                          <p className="font-medium text-slate-900">{row.completedConsults}</p>
                          <p className="flex items-center gap-1 text-xs text-slate-500">
                            <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                            {row.ratingCount
                              ? `${row.ratingAvg.toFixed(1)} (${row.ratingCount})`
                              : "No reviews"}
                          </p>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex flex-wrap items-center justify-end gap-2">
                            <Button size="sm" variant="outline" asChild>
                              <Link href={config.routes.manageDetail(row.id)}>
                                <Settings2 className="h-4 w-4" />
                                <span className="hidden 2xl:inline">Manage</span>
                              </Link>
                            </Button>
                            <Button size="sm" variant="ghost" asChild>
                              <Link
                                href={config.routes.review(row.id)}
                                aria-label="View application"
                              >
                                <Eye className="h-4 w-4" />
                              </Link>
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              aria-expanded={expandedId === row.id}
                              onClick={() => setExpandedId(expandedId === row.id ? null : row.id)}
                            >
                              Quick actions
                            </Button>
                          </div>
                        </td>
                      </tr>
                      {expandedId === row.id && (
                        <tr className="bg-slate-50/50">
                          <td colSpan={6} className="px-5 py-4">
                            <div className="flex flex-wrap gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={busy || (!isApproved && !row.isListed)}
                                onClick={() => void updateRow(row, { isListed: !row.isListed })}
                              >
                                {row.isListed ? "Hide from directory" : "List in directory"}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={busy || (!isApproved && !row.videoConsultEnabled)}
                                onClick={() =>
                                  void updateRow(row, {
                                    videoConsultEnabled: !row.videoConsultEnabled,
                                  })
                                }
                              >
                                {row.videoConsultEnabled
                                  ? "Disable video consults"
                                  : "Enable video consults"}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={busy}
                                onClick={() => {
                                  if (
                                    row.isActive &&
                                    !window.confirm(
                                      `Deactivate ${row.name}? They will be hidden from patients and cannot be booked.`,
                                    )
                                  ) {
                                    return;
                                  }
                                  void updateRow(row, { isActive: !row.isActive });
                                }}
                              >
                                {row.isActive ? "Deactivate account" : "Activate account"}
                              </Button>
                              {publicPath && (
                                <Button size="sm" variant="outline" asChild>
                                  <Link href={publicPath} target="_blank" rel="noopener noreferrer">
                                    View public profile
                                  </Link>
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={busy}
                                onClick={() => {
                                  setDeleteError(null);
                                  setDeleteTarget(row);
                                }}
                                className="ml-auto border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                              >
                                <Trash2 className="h-4 w-4" />
                                Remove
                              </Button>
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2">
                              {isBookable(row) && (
                                <Badge variant="secondary" className="text-xs">
                                  Bookable
                                </Badge>
                              )}
                              <Badge variant="secondary" className="text-xs">
                                Fee {formatCurrency(row.consultationFee)}
                              </Badge>
                              {row.onlineCommissionPercent !== undefined && (
                                <Badge variant="secondary" className="text-xs">
                                {row.onlineCommissionPercent == null
                                  ? "Default commission"
                                  : `Keeps ${row.onlineCommissionPercent}% of consult fees`}
                                </Badge>
                              )}
                            </div>
                            {row.rejectionReason &&
                              row.verificationStatus !== VerificationStatuses.APPROVED && (
                                <p className="mt-3 text-xs text-red-700">
                                  Reason: {row.rejectionReason}
                                </p>
                              )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {statusChange && (
        <ReasonDialog
          title={
            statusChange.next === RESTRICTED_STATUS
              ? `Restrict ${singularLower}`
              : `Reject ${singularLower}`
          }
          description={`${statusChange.row.name} will be unlisted and shown this reason.`}
          confirmLabel={statusChange.next === RESTRICTED_STATUS ? "Restrict" : "Reject"}
          busy={pendingId === statusChange.row.id}
          onCancel={() => setStatusChange(null)}
          onConfirm={(reason) => void applyStatus(statusChange.row, statusChange.next, reason)}
        />
      )}

      {deleteTarget && (
        <DeleteProviderDialog
          name={deleteTarget.name}
          providerLabel={singularLower}
          busy={pendingId === deleteTarget.id}
          error={deleteError}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => void confirmDelete()}
        />
      )}

      <p className="text-xs text-slate-400">
        {plural} must be approved, active, listed and have video consults enabled to be bookable.
      </p>
    </div>
  );
}

function SpecialtyCell({ specialties, fallback }: { specialties: string[]; fallback?: string }) {
  const list = specialties.length ? specialties : fallback ? [fallback] : [];
  if (list.length === 0) return <span className="text-xs text-slate-400">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      <Badge variant="secondary" className="max-w-full truncate text-xs">
        {list[0]}
      </Badge>
      {list.length > 1 && (
        <Badge variant="outline" className="text-xs">
          +{list.length - 1}
        </Badge>
      )}
    </div>
  );
}
