"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, Fragment } from "react";
import {
  Check,
  ChevronDown,
  Copy,
  Eye,
  Filter,
  Plus,
  Search,
  Settings2,
  Stethoscope,
  Trash2,
  X,
} from "lucide-react";
import { VerificationStatuses } from "@zindagi/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CitySelect } from "@/components/forms/city-select";
import { Badge } from "@/components/ui/badge";
import { LoadingScreen } from "@/components/ui/loading-screen";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AdminDoctorAvatar } from "@/features/admin/components/admin-doctor-avatar";
import { formatDayOfWeek } from "@/features/doctor/types";
import type { AdminDoctorRow } from "@/server/services/admin-doctor.service";
import { cn } from "@zindagi/shared";

const DAYS = [1, 2, 3, 4, 5, 6, 0];

function formatCurrency(amount: number) {
  return `PKR ${amount.toLocaleString("en-PK")}`;
}

type YesNoFilter = "all" | "yes" | "no";

type DoctorFilters = {
  city: string;
  gender: "all" | "male" | "female" | "unset";
  homeVisit: YesNoFilter;
  sunday: YesNoFilter;
  listed: YesNoFilter;
  status: string;
  specialty: string;
};

const DEFAULT_FILTERS: DoctorFilters = {
  city: "all",
  gender: "all",
  homeVisit: "all",
  sunday: "all",
  listed: "all",
  status: "all",
  specialty: "all",
};

const YES_NO_OPTIONS = [
  { value: "all", label: "All" },
  { value: "yes", label: "Enabled" },
  { value: "no", label: "Disabled" },
];

function matchesYesNo(filter: YesNoFilter, value: boolean) {
  return filter === "all" || (filter === "yes") === value;
}

function matchesFilters(doc: AdminDoctorRow, filters: DoctorFilters) {
  if (
    filters.city !== "all" &&
    !doc.cities.some((c) => c.toLowerCase() === filters.city.toLowerCase())
  ) {
    return false;
  }
  if (filters.gender === "unset" && doc.gender) return false;
  if (
    filters.gender !== "all" &&
    filters.gender !== "unset" &&
    doc.gender !== filters.gender
  ) {
    return false;
  }
  if (filters.status !== "all" && doc.verificationStatus !== filters.status) return false;
  if (filters.specialty !== "all" && !doc.specialties.includes(filters.specialty)) return false;
  return (
    matchesYesNo(filters.homeVisit, doc.homeVisitEnabled) &&
    matchesYesNo(filters.sunday, doc.sundayConsultEnabled) &&
    matchesYesNo(filters.listed, doc.isListed)
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1 text-xs font-medium text-slate-500">
      {label}
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cn(
            "w-full appearance-none rounded-lg border bg-white py-2 pl-3 pr-8 text-sm font-medium text-slate-700 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand",
            value === "all" ? "border-slate-200" : "border-brand/50 bg-brand/[0.04]",
          )}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
      </div>
    </label>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    approved: "bg-emerald-100 text-emerald-800",
    restricted: "bg-orange-100 text-orange-800",
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

function WorkloadBadge({ doctor }: { doctor: AdminDoctorRow }) {
  const { stats } = doctor;
  if (stats.isWorkingNow) {
    return (
      <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">
        In consult
      </Badge>
    );
  }
  if (stats.upcomingToday > 0) {
    return (
      <Badge variant="secondary">
        {stats.upcomingToday} today
      </Badge>
    );
  }
  return <span className="text-xs text-slate-500">Idle</span>;
}

export function AdminDoctorsManagement() {
  const [doctors, setDoctors] = useState<AdminDoctorRow[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminDoctorRow | null>(null);
  const [deleteInput, setDeleteInput] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [copiedPhoneId, setCopiedPhoneId] = useState<string | null>(null);
  const [filters, setFilters] = useState<DoctorFilters>(DEFAULT_FILTERS);
  const setFilter = <K extends keyof DoctorFilters>(key: K, value: DoctorFilters[K]) =>
    setFilters((current) => ({ ...current, [key]: value }));

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
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    phone: "",
    pmdcNumber: "",
    city: "",
    specialties: "",
    sundayConsultEnabled: false,
    gender: "",
  });

  const hasLoadedRef = useRef(false);
  const load = useCallback(async () => {
    if (!hasLoadedRef.current) setLoading(true);
    const q = search ? `?search=${encodeURIComponent(search)}` : "";
    const res = await fetch(`/api/v1/admin/doctors/manage${q}`);
    const json = await res.json();
    if (json.success) setDoctors(json.data?.doctors ?? []);
    hasLoadedRef.current = true;
    setLoading(false);
  }, [search]);

  useEffect(() => {
    load();
  }, [load]);

  const stats = useMemo(
    () => ({
      total: doctors.length,
      approved: doctors.filter((d) => d.verificationStatus === VerificationStatuses.APPROVED)
        .length,
      restricted: doctors.filter((d) => d.verificationStatus === VerificationStatuses.RESTRICTED)
        .length,
      pending: doctors.filter((d) => d.verificationStatus === VerificationStatuses.PENDING).length,
      listed: doctors.filter((d) => d.isListed).length,
    }),
    [doctors],
  );

  const cityOptions = useMemo(() => {
    const byKey = new Map<string, string>();
    for (const d of doctors) {
      for (const c of d.cities) {
        const key = c.toLowerCase();
        if (!byKey.has(key)) byKey.set(key, c);
      }
    }
    return [...byKey.values()].sort((a, b) => a.localeCompare(b));
  }, [doctors]);

  const specialtyOptions = useMemo(
    () => [...new Set(doctors.flatMap((d) => d.specialties))].sort((a, b) => a.localeCompare(b)),
    [doctors],
  );

  const filteredDoctors = useMemo(
    () => doctors.filter((d) => matchesFilters(d, filters)),
    [doctors, filters],
  );

  const activeFilterCount = Object.values(filters).filter((v) => v !== "all").length;

  const updateDoctor = async (id: string, patch: Record<string, unknown>) => {
    setPending(id);
    const res = await fetch(`/api/v1/admin/doctors/${id}/manage`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    setPending(null);
    if (res.ok) await load();
    else {
      const json = await res.json();
      alert(json?.error?.message ?? "Update failed");
    }
  };

  const createDoctor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.city.trim()) {
      alert("Select the doctor's city.");
      return;
    }
    setPending("create");
    const res = await fetch("/api/v1/admin/doctors/manage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        email: form.email,
        password: form.password || undefined,
        phone: form.phone || undefined,
        pmdcNumber: form.pmdcNumber,
        city: form.city.trim(),
        specialties: form.specialties.split(",").map((s) => s.trim()).filter(Boolean),
        sundayConsultEnabled: form.sundayConsultEnabled,
        gender: form.gender || undefined,
      }),
    });
    setPending(null);
    if (res.ok) {
      setShowForm(false);
      setForm({
        name: "",
        email: "",
        password: "",
        phone: "",
        pmdcNumber: "",
        city: "",
        specialties: "",
        sundayConsultEnabled: false,
        gender: "",
      });
      await load();
    } else {
      const json = await res.json();
      alert(json?.error?.message ?? "Failed to create doctor");
    }
  };

  const openDeleteDialog = (doc: AdminDoctorRow) => {
    setDeleteTarget(doc);
    setDeleteInput("");
    setDeleteError(null);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    if (deleteInput.trim().toLowerCase() !== deleteTarget.name.trim().toLowerCase()) {
      setDeleteError("Name didn't match — please type it exactly as shown.");
      return;
    }
    setPending(deleteTarget.id);
    const res = await fetch(`/api/v1/admin/doctors/${deleteTarget.id}`, {
      method: "DELETE",
    });
    setPending(null);
    if (res.ok) {
      setExpandedId(null);
      setDeleteTarget(null);
      await load();
    } else {
      const json = await res.json();
      setDeleteError(json?.error?.message ?? "Failed to delete doctor");
    }
  };

  const handleStatusChange = (doc: AdminDoctorRow, next: string) => {
    if (next === doc.verificationStatus) return;
    if (next === VerificationStatuses.RESTRICTED) {
      if (
        !window.confirm(
          `Restrict ${doc.name}? They will be unlisted and blocked from new bookings.`,
        )
      ) {
        return;
      }
      void updateDoctor(doc.id, { verificationStatus: VerificationStatuses.RESTRICTED });
      return;
    }
    if (next === VerificationStatuses.REJECTED) {
      const reason = window.prompt("Rejection reason:");
      if (!reason?.trim()) return;
      void updateDoctor(doc.id, {
        verificationStatus: VerificationStatuses.REJECTED,
        rejectionReason: reason.trim(),
      });
      return;
    }
    void updateDoctor(doc.id, { verificationStatus: next });
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {[
          { label: "Total doctors", value: stats.total },
          { label: "Approved", value: stats.approved },
          { label: "Restricted", value: stats.restricted },
          { label: "Pending review", value: stats.pending },
          { label: "Publicly listed", value: stats.listed },
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
            className="pl-9 sm:pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => load()}>
            Search
          </Button>
          <Button type="button" onClick={() => setShowForm((v) => !v)}>
            <Plus className="h-4 w-4" />
            {showForm ? "Cancel" : "Add doctor"}
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <Filter className="h-4 w-4 text-slate-400" />
            Filters
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="text-xs">
                {activeFilterCount} active
              </Badge>
            )}
          </p>
          <div className="flex items-center gap-3 text-sm text-slate-500">
            <span>
              Showing {filteredDoctors.length} of {doctors.length}
            </span>
            {activeFilterCount > 0 && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setFilters(DEFAULT_FILTERS)}
              >
                <X className="h-4 w-4" />
                Clear
              </Button>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
          <FilterSelect
            label="City"
            value={filters.city}
            onChange={(v) => setFilter("city", v)}
            options={[
              { value: "all", label: "All cities" },
              ...cityOptions.map((c) => ({ value: c, label: c })),
            ]}
          />
          <FilterSelect
            label="Gender"
            value={filters.gender}
            onChange={(v) => setFilter("gender", v as DoctorFilters["gender"])}
            options={[
              { value: "all", label: "All" },
              { value: "male", label: "Male" },
              { value: "female", label: "Female" },
              { value: "unset", label: "Not set" },
            ]}
          />
          <FilterSelect
            label="Home visits"
            value={filters.homeVisit}
            onChange={(v) => setFilter("homeVisit", v as YesNoFilter)}
            options={YES_NO_OPTIONS}
          />
          <FilterSelect
            label="Sunday free consult"
            value={filters.sunday}
            onChange={(v) => setFilter("sunday", v as YesNoFilter)}
            options={YES_NO_OPTIONS}
          />
          <FilterSelect
            label="Listed publicly"
            value={filters.listed}
            onChange={(v) => setFilter("listed", v as YesNoFilter)}
            options={[
              { value: "all", label: "All" },
              { value: "yes", label: "Listed" },
              { value: "no", label: "Unlisted" },
            ]}
          />
          <FilterSelect
            label="Status"
            value={filters.status}
            onChange={(v) => setFilter("status", v)}
            options={[
              { value: "all", label: "All statuses" },
              { value: VerificationStatuses.APPROVED, label: "Approved" },
              { value: VerificationStatuses.RESTRICTED, label: "Restricted" },
              { value: VerificationStatuses.REJECTED, label: "Rejected" },
            ]}
          />
          <FilterSelect
            label="Specialty"
            value={filters.specialty}
            onChange={(v) => setFilter("specialty", v)}
            options={[
              { value: "all", label: "All specialties" },
              ...specialtyOptions.map((s) => ({ value: s, label: s })),
            ]}
          />
        </div>
      </div>

      {showForm && (
        <Card className="rounded-2xl border-slate-200/80 bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Add doctor manually</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={createDoctor} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Input
                placeholder="Full name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
              <Input
                type="email"
                placeholder="Email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
              <Input
                placeholder="Password (default: Doctor@123)"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
              <Input
                placeholder="Phone"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
              <Input
                placeholder="PMDC ID"
                value={form.pmdcNumber}
                onChange={(e) => setForm({ ...form, pmdcNumber: e.target.value })}
                required
              />
              <CitySelect
                id="new-doctor-city"
                value={form.city}
                onChange={(city) => setForm({ ...form, city })}
              />
              <Input
                placeholder="Specialties (comma-separated)"
                value={form.specialties}
                onChange={(e) => setForm({ ...form, specialties: e.target.value })}
                required
              />
              <select
                value={form.gender}
                onChange={(e) => setForm({ ...form, gender: e.target.value })}
                className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
              >
                <option value="">Gender (optional)</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
              <label className="flex items-center gap-2 text-sm sm:col-span-2 lg:col-span-3">
                <input
                  type="checkbox"
                  checked={form.sundayConsultEnabled}
                  onChange={(e) =>
                    setForm({ ...form, sundayConsultEnabled: e.target.checked })
                  }
                />
                Enable Sunday free consult
              </label>
              <Button type="submit" disabled={pending === "create"} className="w-fit">
                Create doctor
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        {loading ? (
          <LoadingScreen message="Loading doctors…" size="md" />
        ) : filteredDoctors.length === 0 ? (
          <div className="flex flex-col items-center gap-3 p-16 text-center">
            <Stethoscope className="h-10 w-10 text-slate-300" />
            <p className="text-sm text-slate-500">
              {doctors.length === 0 ? "No doctors found." : "No doctors match these filters."}
            </p>
            {doctors.length > 0 && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setFilters(DEFAULT_FILTERS)}
              >
                Clear filters
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full table-fixed text-left text-sm">
              <colgroup>
                <col className="w-[24%]" />
                <col className="w-[15%]" />
                <col className="hidden lg:table-column lg:w-[10%]" />
                <col className="w-[14%]" />
                <col className="hidden md:table-column md:w-[12%]" />
                <col className="hidden xl:table-column xl:w-[13%]" />
                <col />
              </colgroup>
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-5 py-4">Doctor</th>
                  <th className="px-5 py-4">Specialty</th>
                  <th className="hidden px-5 py-4 lg:table-cell">PMDC</th>
                  <th className="px-5 py-4">Status</th>
                  <th className="hidden px-5 py-4 md:table-cell">Working</th>
                  <th className="hidden px-5 py-4 xl:table-cell">Earnings</th>
                  <th className="px-5 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredDoctors.map((doc) => (
                  <Fragment key={doc.id}>
                    <tr className="transition hover:bg-slate-50/60">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <AdminDoctorAvatar
                            name={doc.name}
                            avatarUrl={doc.avatarUrl}
                            size="md"
                          />
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-slate-900">{doc.name}</p>
                            {doc.phone ? (
                              <div className="flex items-center gap-1 text-xs text-slate-500">
                                <span className="select-all font-mono">{doc.phone}</span>
                                <button
                                  type="button"
                                  onClick={() => void copyPhone(doc.id, doc.phone!)}
                                  className="rounded p-0.5 text-slate-400 transition hover:bg-slate-100 hover:text-brand"
                                  aria-label={`Copy phone number of ${doc.name}`}
                                  title={copiedPhoneId === doc.id ? "Copied" : "Copy phone number"}
                                >
                                  {copiedPhoneId === doc.id ? (
                                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                                  ) : (
                                    <Copy className="h-3.5 w-3.5" />
                                  )}
                                </button>
                              </div>
                            ) : (
                              <p className="text-xs text-slate-500">—</p>
                            )}
                            {(doc.cities.length > 0 || doc.gender) && (
                              <p className="truncate text-xs capitalize text-slate-400">
                                {[doc.cities.join(", "), doc.gender].filter(Boolean).join(" · ")}
                              </p>
                            )}
                            {!doc.isActive && (
                              <Badge variant="outline" className="mt-1 text-[10px]">
                                Inactive
                              </Badge>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap gap-1">
                          {doc.specialties.slice(0, 1).map((s) => (
                            <Badge key={s} variant="secondary" className="max-w-full truncate text-xs">
                              {s}
                            </Badge>
                          ))}
                          {doc.specialties.length > 1 && (
                            <Badge variant="outline" className="text-xs">
                              +{doc.specialties.length - 1}
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="hidden truncate px-5 py-4 font-mono text-xs text-slate-600 lg:table-cell">
                        {doc.pmdcNumber ?? "—"}
                      </td>
                      <td className="px-5 py-4">
                        <div className="relative inline-flex items-center">
                          <select
                            value={doc.verificationStatus}
                            disabled={pending === doc.id}
                            onChange={(e) => handleStatusChange(doc, e.target.value)}
                            className="appearance-none rounded-lg border border-slate-200 bg-white py-1.5 pl-3 pr-8 text-xs font-medium text-slate-700 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand disabled:opacity-50"
                          >
                            <option value={VerificationStatuses.APPROVED}>Approved</option>
                            <option value={VerificationStatuses.RESTRICTED}>Restricted</option>
                            <option value={VerificationStatuses.PENDING}>Pending</option>
                            <option value={VerificationStatuses.REJECTED}>Rejected</option>
                          </select>
                          <ChevronDown className="pointer-events-none absolute right-2 h-3.5 w-3.5 text-slate-400" />
                        </div>
                        <div className="mt-1.5">
                          <StatusBadge status={doc.verificationStatus} />
                        </div>
                      </td>
                      <td className="hidden px-5 py-4 md:table-cell">
                        <WorkloadBadge doctor={doc} />
                        <p className="mt-1 text-xs text-slate-500">
                          {doc.stats.completedThisMonth} completed this month
                        </p>
                      </td>
                      <td className="hidden px-5 py-4 xl:table-cell">
                        <p className="font-medium text-slate-900">
                          {formatCurrency(doc.stats.totalEarnings)}
                        </p>
                        <p className="text-xs text-slate-500">
                          {formatCurrency(doc.stats.earningsThisMonth)} this month
                        </p>
                        {doc.referredPatientCount > 0 && (
                          <Badge
                            variant="outline"
                            className="mt-1 border-brand/30 bg-brand/[0.06] text-[10px] text-brand"
                          >
                            {doc.referredPatientCount} referred
                          </Badge>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          <Button size="sm" variant="outline" asChild>
                            <Link href={`/admin/doctors/manage/${doc.id}`}>
                              <Settings2 className="h-4 w-4" />
                              <span className="hidden 2xl:inline">Manage</span>
                            </Link>
                          </Button>
                          <Button size="sm" variant="ghost" asChild>
                            <Link href={`/admin/doctors/review/${doc.id}`}>
                              <Eye className="h-4 w-4" />
                            </Link>
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              setExpandedId(expandedId === doc.id ? null : doc.id)
                            }
                          >
                            Quick actions
                          </Button>
                        </div>
                      </td>
                    </tr>
                    {expandedId === doc.id && (
                      <tr className="bg-slate-50/50">
                        <td colSpan={7} className="px-5 py-4">
                          <div className="flex flex-wrap gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={pending === doc.id}
                              onClick={() => updateDoctor(doc.id, { isListed: !doc.isListed })}
                            >
                              {doc.isListed ? "Unlist" : "List publicly"}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={pending === doc.id}
                              onClick={() => updateDoctor(doc.id, { isActive: !doc.isActive })}
                            >
                              {doc.isActive ? "Deactivate account" : "Activate account"}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={
                                pending === doc.id ||
                                doc.verificationStatus === VerificationStatuses.RESTRICTED
                              }
                              onClick={() =>
                                updateDoctor(doc.id, {
                                  sundayConsultEnabled: !doc.sundayConsultEnabled,
                                })
                              }
                            >
                              {doc.sundayConsultEnabled ? "Disable Sunday" : "Enable Sunday"}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={
                                pending === doc.id ||
                                doc.verificationStatus !== VerificationStatuses.APPROVED
                              }
                              onClick={() =>
                                updateDoctor(doc.id, {
                                  homeVisitEnabled: !doc.homeVisitEnabled,
                                })
                              }
                            >
                              {doc.homeVisitEnabled ? "Disable home visits" : "Enable home visits"}
                            </Button>
                            <select
                              value={doc.gender ?? ""}
                              disabled={pending === doc.id}
                              onChange={(e) =>
                                updateDoctor(doc.id, { gender: e.target.value || null })
                              }
                              aria-label={`Gender of ${doc.name}`}
                              className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand disabled:opacity-50"
                            >
                              <option value="">Gender: not set</option>
                              <option value="male">Gender: male</option>
                              <option value="female">Gender: female</option>
                            </select>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={pending === doc.id}
                              onClick={() => {
                                const availability = DAYS.map((day) => ({
                                  dayOfWeek: day,
                                  startTimeLocal: "09:00",
                                  endTimeLocal: "17:00",
                                }));
                                updateDoctor(doc.id, { weeklyAvailability: availability });
                              }}
                            >
                              Set 9–5 schedule
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={pending === doc.id}
                              onClick={() => openDeleteDialog(doc)}
                              className="ml-auto border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                            >
                              <Trash2 className="h-4 w-4" />
                              Delete permanently
                            </Button>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {doc.sundayConsultEnabled && (
                              <Badge variant="secondary" className="text-xs">
                                Sunday consult
                              </Badge>
                            )}
                            {doc.homeVisitEnabled && (
                              <Badge variant="secondary" className="text-xs">
                                Home visits
                              </Badge>
                            )}
                            {doc.isListed && (
                              <Badge variant="secondary" className="text-xs">
                                Listed online
                              </Badge>
                            )}
                          </div>
                          {doc.weeklyAvailability.length > 0 && (
                            <p className="mt-3 text-xs text-slate-500">
                              Schedule:{" "}
                              {doc.weeklyAvailability
                                .map(
                                  (a) =>
                                    `${formatDayOfWeek(a.dayOfWeek)} ${a.startTimeLocal}–${a.endTimeLocal}`,
                                )
                                .join(", ")}
                            </p>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          onClick={() => setDeleteTarget(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <h3 className="text-lg font-semibold text-slate-900">Delete doctor</h3>
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mt-2 text-sm text-slate-600">
              This permanently deletes <strong>{deleteTarget.name}</strong>&apos;s account and
              doctor profile. This cannot be undone.
            </p>
            <p className="mt-3 text-sm text-slate-600">
              Type <strong>{deleteTarget.name}</strong> to confirm:
            </p>
            <Input
              autoFocus
              value={deleteInput}
              onChange={(e) => {
                setDeleteInput(e.target.value);
                if (deleteError) setDeleteError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") confirmDelete();
              }}
              placeholder={deleteTarget.name}
              className="mt-2"
            />
            {deleteError && <p className="mt-2 text-sm text-red-600">{deleteError}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setDeleteTarget(null)}>
                Cancel
              </Button>
              <Button
                type="button"
                onClick={confirmDelete}
                disabled={pending === deleteTarget.id}
                className="bg-red-600 text-white hover:bg-red-700"
              >
                Delete permanently
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
