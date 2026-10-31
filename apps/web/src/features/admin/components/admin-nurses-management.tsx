"use client";

import Link from "next/link";
import { Fragment, useEffect, useMemo, useState } from "react";
import {
  Activity,
  Check,
  ChevronDown,
  Copy,
  Eye,
  Plus,
  Search,
  Settings2,
  Trash2,
  X,
} from "lucide-react";
import {
  cn,
  MAX_NURSING_SPECIALTIES,
  NURSING_HOME_VISIT_SPLIT as SPLIT,
  NURSING_SPECIALTIES_ALPHABETICAL,
  VerificationStatuses,
} from "@zindagi/shared";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { LoadingScreen } from "@/components/ui/loading-screen";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SpecialtyMultiSelect } from "@/components/forms/specialty-multi-select";
import { NurseAvatar } from "@/features/nurse/components/nurse-avatar";
import { nurseProfilePath } from "@/lib/nurses/profile-path";
import type { AdminNurseManageRow } from "@/features/admin/types/nurse-admin";
import { cityAreaError } from "@/lib/geo/city-area-error";
import {
  DEFAULT_STAFF_FILTERS,
  GenderQuickSelect,
  matchesStaffFilters,
  StaffFilterPanel,
  type StaffFilters,
} from "@/features/admin/components/admin-list-filters";

const SEARCH_DEBOUNCE_MS = 300;

const EMPTY_FORM = {
  name: "",
  email: "",
  password: "",
  phone: "",
  licenseNumber: "",
  qualification: "",
  experienceYears: "",
  city: "",
  area: "",
  gender: "",
  homeVisitEnabled: true,
};

function formatCurrency(amount: number) {
  return `PKR ${Math.round(amount).toLocaleString("en-PK")}`;
}

async function readError(res: Response, fallback: string) {
  try {
    const json = await res.json();
    return (json?.error?.message as string | undefined) ?? fallback;
  } catch {
    return fallback;
  }
}

export function NurseStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    approved: "bg-emerald-100 text-emerald-800",
    rejected: "bg-red-100 text-red-800",
    pending: "bg-amber-100 text-amber-800",
  };
  return (
    <span
      className={cn(
        "rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize",
        styles[status] ?? "bg-slate-100 text-slate-700",
      )}
    >
      {status}
    </span>
  );
}

function WorkloadBadge({ row }: { row: AdminNurseManageRow }) {
  const { stats } = row;
  if (stats.activeVisits > 0) {
    return (
      <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">
        {stats.activeVisits} active
      </Badge>
    );
  }
  if (!row.isAvailable) {
    return <span className="text-xs text-slate-500">Off duty</span>;
  }
  return <span className="text-xs text-slate-500">Idle</span>;
}

export function AdminNursesManagement() {
  const [rows, setRows] = useState<AdminNurseManageRow[]>([]);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminNurseManageRow | null>(null);
  const [deleteInput, setDeleteInput] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [copiedPhoneId, setCopiedPhoneId] = useState<string | null>(null);
  const [filters, setFilters] = useState<StaffFilters>(DEFAULT_STAFF_FILTERS);

  const copyPhone = async (rowId: string, phone: string) => {
    try {
      await navigator.clipboard.writeText(phone);
      setCopiedPhoneId(rowId);
      setTimeout(() => {
        setCopiedPhoneId((current) => (current === rowId ? null : current));
      }, 2000);
    } catch {
      // Clipboard API unavailable (e.g. non-HTTPS host) — let the admin copy manually.
      window.prompt("Copy the phone number:", phone);
    }
  };

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [search]);

  // Bumping this re-runs the fetch effect (after create / delete / "Try again").
  const [reloadKey, setReloadKey] = useState(0);
  const reload = () => setReloadKey((k) => k + 1);

  useEffect(() => {
    // Ignore responses from superseded requests (fast typing, reloads).
    let cancelled = false;
    const q = debouncedSearch ? `?search=${encodeURIComponent(debouncedSearch)}` : "";
    fetch(`/api/v1/admin/nurses/manage${q}`, { cache: "no-store" })
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return;
        if (json.success) {
          setRows(json.data?.nurses ?? []);
          setLoadError(null);
        } else {
          setLoadError(json?.error?.message ?? "Failed to load nurses");
        }
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setLoadError("Failed to load nurses");
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedSearch, reloadKey]);

  const stats = useMemo(
    () => ({
      total: rows.length,
      approved: rows.filter((r) => r.verificationStatus === VerificationStatuses.APPROVED)
        .length,
      rejected: rows.filter((r) => r.verificationStatus === VerificationStatuses.REJECTED)
        .length,
      onDuty: rows.filter(
        (r) =>
          r.verificationStatus === VerificationStatuses.APPROVED &&
          r.isActive &&
          r.isAvailable &&
          r.homeVisitEnabled,
      ).length,
      activeVisits: rows.reduce((sum, r) => sum + r.stats.activeVisits, 0),
    }),
    [rows],
  );

  const filteredRows = useMemo(
    () => rows.filter((r) => matchesStaffFilters(r, filters)),
    [rows, filters],
  );

  const updateRow = async (id: string, patch: Record<string, unknown>) => {
    setPending(id);
    setActionError(null);
    try {
      const res = await fetch(`/api/v1/admin/nurses/${id}/manage`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (res.ok) {
        const json = await res.json();
        const updated = json.data?.nurse as AdminNurseManageRow | undefined;
        if (updated) {
          setRows((prev) => prev.map((r) => (r.id === id ? updated : r)));
        } else {
          reload();
        }
      } else {
        setActionError(await readError(res, "Update failed"));
      }
    } catch {
      setActionError("Update failed — check your connection and try again.");
    } finally {
      setPending(null);
    }
  };

  const handleStatusChange = (row: AdminNurseManageRow, next: string) => {
    if (next === row.verificationStatus) return;
    if (next === VerificationStatuses.REJECTED) {
      const reason = window.prompt(`Reason for rejecting ${row.name}:`);
      if (!reason?.trim()) return;
      if (reason.trim().length < 3) {
        setActionError("Rejection reason must be at least 3 characters.");
        return;
      }
      void updateRow(row.id, {
        verificationStatus: VerificationStatuses.REJECTED,
        rejectionReason: reason.trim(),
      });
      return;
    }
    void updateRow(row.id, { verificationStatus: next });
  };

  const createNurse = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const locationError = cityAreaError(form.city, form.area);
    if (locationError) {
      setFormError(locationError);
      return;
    }
    if (specialties.length === 0) {
      setFormError("Select at least one specialty.");
      return;
    }
    if (form.password && form.password.length < 8) {
      setFormError("Password must be at least 8 characters.");
      return;
    }
    const experience = form.experienceYears.trim();
    setPending("create");
    try {
      const res = await fetch("/api/v1/admin/nurses/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim(),
          password: form.password || undefined,
          phone: form.phone.trim() || undefined,
          licenseNumber: form.licenseNumber.trim(),
          qualification: form.qualification.trim() || undefined,
          experienceYears: experience ? Number(experience) : undefined,
          specialties,
          city: form.city.trim(),
          area: form.area.trim() || undefined,
          gender: form.gender || undefined,
          homeVisitEnabled: form.homeVisitEnabled,
        }),
      });
      if (res.ok) {
        setShowForm(false);
        setForm(EMPTY_FORM);
        setSpecialties([]);
        reload();
      } else {
        setFormError(await readError(res, "Failed to create nurse"));
      }
    } catch {
      setFormError("Failed to create nurse — check your connection.");
    } finally {
      setPending(null);
    }
  };

  const openDeleteDialog = (row: AdminNurseManageRow) => {
    setDeleteTarget(row);
    setDeleteInput("");
    setDeleteError(null);
  };

  const confirmDelete = async () => {
    if (!deleteTarget || pending === deleteTarget.id) return;
    if (deleteInput.trim().toLowerCase() !== deleteTarget.name.trim().toLowerCase()) {
      setDeleteError("Name didn't match — please type it exactly as shown.");
      return;
    }
    setPending(deleteTarget.id);
    try {
      const res = await fetch(`/api/v1/admin/nurses/${deleteTarget.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setExpandedId(null);
        setDeleteTarget(null);
        reload();
      } else {
        setDeleteError(await readError(res, "Failed to delete nurse"));
      }
    } catch {
      setDeleteError("Failed to delete nurse — check your connection.");
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {[
          { label: "Total nurses", value: stats.total },
          { label: "Approved", value: stats.approved },
          { label: "Rejected", value: stats.rejected },
          { label: "Taking visits now", value: stats.onDuty },
          { label: "Active visits", value: stats.activeVisits },
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
            placeholder="Search by name, email, phone, license, or area…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 sm:pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" asChild>
            <Link href="/admin/nurses">Pending applications</Link>
          </Button>
          <Button
            type="button"
            onClick={() => {
              setShowForm((v) => !v);
              setFormError(null);
            }}
          >
            <Plus className="h-4 w-4" />
            {showForm ? "Cancel" : "Add nurse"}
          </Button>
        </div>
      </div>

      {rows.length > 0 && (
        <StaffFilterPanel
          rows={rows}
          filters={filters}
          onChange={setFilters}
          shown={filteredRows.length}
        />
      )}

      {actionError && (
        <div className="flex items-start justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <p>{actionError}</p>
          <button
            type="button"
            onClick={() => setActionError(null)}
            className="text-red-500 hover:text-red-700"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {showForm && (
        <Card className="rounded-2xl border-slate-200/80 bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Add nurse manually</CardTitle>
            <p className="text-sm text-slate-500">
              Creates an approved account. The nurse can set their exact map location and
              photo from their own profile after signing in.
            </p>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={createNurse}
              className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
            >
              <div>
                <Label htmlFor="pt-name">Full name</Label>
                <Input
                  id="pt-name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  minLength={2}
                  required
                />
              </div>
              <div>
                <Label htmlFor="pt-email">Email</Label>
                <Input
                  id="pt-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="pt-password">Password</Label>
                <Input
                  id="pt-password"
                  placeholder="Default: Nurse@123"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="pt-phone">Mobile number</Label>
                <Input
                  id="pt-phone"
                  type="tel"
                  placeholder="03XX XXXXXXX"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="pt-license">License / registration no.</Label>
                <Input
                  id="pt-license"
                  value={form.licenseNumber}
                  onChange={(e) => setForm({ ...form, licenseNumber: e.target.value })}
                  minLength={3}
                  maxLength={40}
                  required
                />
              </div>
              <div>
                <Label htmlFor="pt-qualification">Qualification</Label>
                <Input
                  id="pt-qualification"
                  placeholder="e.g. BSN"
                  value={form.qualification}
                  onChange={(e) => setForm({ ...form, qualification: e.target.value })}
                  maxLength={120}
                />
              </div>
              <div>
                <Label htmlFor="pt-experience">Experience (years)</Label>
                <Input
                  id="pt-experience"
                  type="number"
                  min={0}
                  max={60}
                  value={form.experienceYears}
                  onChange={(e) => setForm({ ...form, experienceYears: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="pt-city">City</Label>
                <Input
                  id="pt-city"
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                  minLength={2}
                  required
                />
              </div>
              <div>
                <Label htmlFor="pt-area">Area / neighborhood</Label>
                <Input
                  id="pt-area"
                  value={form.area}
                  onChange={(e) => setForm({ ...form, area: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="pt-gender">Gender</Label>
                <select
                  id="pt-gender"
                  value={form.gender}
                  onChange={(e) => setForm({ ...form, gender: e.target.value })}
                  className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                >
                  <option value="">Not set</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
              </div>
              <div className="sm:col-span-2 lg:col-span-3">
                <Label htmlFor="pt-specialties">Specialties</Label>
                <SpecialtyMultiSelect
                  id="pt-specialties"
                  values={specialties}
                  onChange={setSpecialties}
                  max={MAX_NURSING_SPECIALTIES}
                  options={NURSING_SPECIALTIES_ALPHABETICAL}
                  placeholder="Add nursing specialties"
                />
              </div>
              <label className="flex items-center gap-2 text-sm sm:col-span-2 lg:col-span-3">
                <input
                  type="checkbox"
                  checked={form.homeVisitEnabled}
                  onChange={(e) => setForm({ ...form, homeVisitEnabled: e.target.checked })}
                />
                Enable home visits
              </label>
              {formError && (
                <p className="text-sm text-red-600 sm:col-span-2 lg:col-span-3">{formError}</p>
              )}
              <Button type="submit" disabled={pending === "create"} className="w-fit">
                {pending === "create" ? "Creating…" : "Create nurse"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        {loading ? (
          <LoadingScreen message="Loading nurses…" size="md" />
        ) : loadError ? (
          <div className="flex flex-col items-center gap-3 p-16 text-center">
            <p className="text-sm text-red-600">{loadError}</p>
            <Button type="button" variant="outline" size="sm" onClick={() => {
                setLoading(true);
                reload();
              }}>
              Try again
            </Button>
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="flex flex-col items-center gap-3 p-16 text-center">
            <Activity className="h-10 w-10 text-slate-300" />
            <p className="text-sm text-slate-500">
              {rows.length > 0
                ? "No results match these filters."
                : debouncedSearch
                ? "No nurses match your search."
                : "No nurses yet. Approved applications appear here."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full table-fixed text-left text-sm">
              <colgroup>
                <col className="w-[26%]" />
                <col className="w-[16%]" />
                <col className="hidden lg:table-column lg:w-[11%]" />
                <col className="w-[14%]" />
                <col className="hidden md:table-column md:w-[12%]" />
                <col className="hidden xl:table-column xl:w-[13%]" />
                <col />
              </colgroup>
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-5 py-4">Nurse</th>
                  <th className="px-5 py-4">Specialty</th>
                  <th className="hidden px-5 py-4 lg:table-cell">License</th>
                  <th className="px-5 py-4">Status</th>
                  <th className="hidden px-5 py-4 md:table-cell">Working</th>
                  <th className="hidden px-5 py-4 xl:table-cell">Earnings</th>
                  <th className="px-5 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRows.map((row) => {
                  const isApproved = row.verificationStatus === VerificationStatuses.APPROVED;
                  return (
                    <Fragment key={row.id}>
                      <tr className="transition hover:bg-slate-50/60">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <NurseAvatar
                              name={row.name}
                              avatarUrl={row.avatarUrl}
                              size="md"
                            />
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-slate-900">{row.name}</p>
                              <p className="truncate text-xs text-slate-500">
                                {row.email ?? (row.phone ? "" : "—")}
                              </p>
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
                              <p className="truncate text-xs text-slate-400">
                                {[
                                  [row.area, row.city].filter(Boolean).join(", "),
                                  row.gender === "male" ? "Male" : row.gender === "female" ? "Female" : null,
                                ]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </p>
                              {!row.isActive && (
                                <Badge variant="outline" className="mt-1 text-[10px]">
                                  Inactive
                                </Badge>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex flex-wrap gap-1">
                            {row.specialties.slice(0, 1).map((s) => (
                              <Badge
                                key={s}
                                variant="secondary"
                                className="max-w-full truncate text-xs"
                              >
                                {s}
                              </Badge>
                            ))}
                            {row.specialties.length > 1 && (
                              <Badge variant="outline" className="text-xs">
                                +{row.specialties.length - 1}
                              </Badge>
                            )}
                            {row.specialties.length === 0 && (
                              <span className="text-xs text-slate-400">—</span>
                            )}
                          </div>
                        </td>
                        <td className="hidden truncate px-5 py-4 font-mono text-xs text-slate-600 lg:table-cell">
                          {row.licenseNumber ?? "—"}
                        </td>
                        <td className="px-5 py-4">
                          <div className="relative inline-flex items-center">
                            <select
                              value={row.verificationStatus}
                              disabled={pending === row.id}
                              onChange={(e) => handleStatusChange(row, e.target.value)}
                              aria-label={`Verification status for ${row.name}`}
                              className="appearance-none rounded-lg border border-slate-200 bg-white py-1.5 pl-3 pr-8 text-xs font-medium text-slate-700 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand disabled:opacity-50"
                            >
                              <option value={VerificationStatuses.APPROVED}>Approved</option>
                              <option value={VerificationStatuses.REJECTED}>Rejected</option>
                            </select>
                            <ChevronDown className="pointer-events-none absolute right-2 h-3.5 w-3.5 text-slate-400" />
                          </div>
                          <div className="mt-1.5">
                            <NurseStatusBadge status={row.verificationStatus} />
                          </div>
                        </td>
                        <td className="hidden px-5 py-4 md:table-cell">
                          <WorkloadBadge row={row} />
                          <p className="mt-1 text-xs text-slate-500">
                            {row.stats.completedThisMonth} completed this month
                          </p>
                        </td>
                        <td className="hidden px-5 py-4 xl:table-cell">
                          <p className="font-medium text-slate-900">
                            {row.stats.totalEarnings === undefined ? "—" : formatCurrency(row.stats.totalEarnings)}
                          </p>
                          <p className="text-xs text-slate-500">
                            {row.stats.earningsThisMonth === undefined ? "—" : `${formatCurrency(row.stats.earningsThisMonth)} this month`}
                          </p>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex flex-wrap items-center justify-end gap-2">
                            <Button size="sm" variant="outline" asChild>
                              <Link href={`/admin/nurses/manage/${row.id}`}>
                                <Settings2 className="h-4 w-4" />
                                <span className="hidden 2xl:inline">Manage</span>
                              </Link>
                            </Button>
                            <Button size="sm" variant="ghost" asChild>
                              <Link
                                href={`/admin/nurses/review/${row.id}`}
                                aria-label="View application"
                              >
                                <Eye className="h-4 w-4" />
                              </Link>
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                setExpandedId(expandedId === row.id ? null : row.id)
                              }
                            >
                              Quick actions
                            </Button>
                          </div>
                        </td>
                      </tr>
                      {expandedId === row.id && (
                        <tr className="bg-slate-50/50">
                          <td colSpan={7} className="px-5 py-4">
                            <div className="flex flex-wrap gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={pending === row.id}
                                onClick={() =>
                                  updateRow(row.id, { isAvailable: !row.isAvailable })
                                }
                              >
                                {row.isAvailable ? "Mark off duty" : "Mark on duty"}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={
                                  pending === row.id || (!isApproved && !row.homeVisitEnabled)
                                }
                                onClick={() =>
                                  updateRow(row.id, { homeVisitEnabled: !row.homeVisitEnabled })
                                }
                              >
                                {row.homeVisitEnabled
                                  ? "Disable home visits"
                                  : "Enable home visits"}
                              </Button>
                              <GenderQuickSelect
                                name={row.name}
                                value={row.gender}
                                disabled={pending === row.id}
                                onChange={(gender) => updateRow(row.id, { gender })}
                              />
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={pending === row.id}
                                onClick={() => {
                                  if (
                                    row.isActive &&
                                    !window.confirm(
                                      `Deactivate ${row.name}? They will be hidden from patients and cannot be booked.`,
                                    )
                                  ) {
                                    return;
                                  }
                                  void updateRow(row.id, { isActive: !row.isActive });
                                }}
                              >
                                {row.isActive ? "Deactivate account" : "Activate account"}
                              </Button>
                              {isApproved && row.isActive && row.slug && (
                                <Button size="sm" variant="outline" asChild>
                                  <Link
                                    href={nurseProfilePath(row.slug)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  >
                                    View public profile
                                  </Link>
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={pending === row.id}
                                onClick={() => openDeleteDialog(row)}
                                className="ml-auto border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                              >
                                <Trash2 className="h-4 w-4" />
                                Delete permanently
                              </Button>
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2">
                              {row.homeVisitEnabled && (
                                <Badge variant="secondary" className="text-xs">
                                  Home visits
                                </Badge>
                              )}
                              {row.isAvailable && (
                                <Badge variant="secondary" className="text-xs">
                                  On duty
                                </Badge>
                              )}
                              {row.commissionPercent !== undefined && (
                                <Badge variant="secondary" className="text-xs">
                                  {row.commissionOverride == null
                                    ? `Keeps ${SPLIT.nursePercent}% of visit fees`
                                    : `Keeps ${row.commissionPercent}% of visit fees`}
                                </Badge>
                              )}
                            </div>
                            {row.verificationStatus === VerificationStatuses.REJECTED &&
                              row.rejectionReason && (
                                <p className="mt-3 text-xs text-red-700">
                                  Rejection reason: {row.rejectionReason}
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

      {deleteTarget && (
        <DeleteNurseDialog
          name={deleteTarget.name}
          value={deleteInput}
          error={deleteError}
          busy={pending === deleteTarget.id}
          onChange={(v) => {
            setDeleteInput(v);
            if (deleteError) setDeleteError(null);
          }}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => void confirmDelete()}
        />
      )}
    </div>
  );
}

export function DeleteNurseDialog({
  name,
  value,
  error,
  busy,
  onChange,
  onCancel,
  onConfirm,
}: {
  name: string;
  value: string;
  error: string | null;
  busy: boolean;
  onChange: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-nurse-title"
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <h3 id="delete-nurse-title" className="text-lg font-semibold text-slate-900">
            Delete nurse
          </h3>
          <button
            type="button"
            onClick={onCancel}
            className="text-slate-400 hover:text-slate-600"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="mt-2 text-sm text-slate-600">
          This permanently deletes <strong>{name}</strong>&apos;s account, nurse profile,
          and uploaded documents. Past visit records are kept. This cannot be undone.
        </p>
        <p className="mt-3 text-sm text-slate-600">
          Type <strong>{name}</strong> to confirm:
        </p>
        <Input
          autoFocus
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onConfirm();
            if (e.key === "Escape") onCancel();
          }}
          placeholder={name}
          className="mt-2"
        />
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="bg-red-600 text-white hover:bg-red-700"
          >
            {busy ? "Deleting…" : "Delete permanently"}
          </Button>
        </div>
      </div>
    </div>
  );
}
