"use client";

import type { ReactNode } from "react";
import { ChevronDown, Filter, X } from "lucide-react";
import { cn } from "@zindagi/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export type YesNoFilter = "all" | "yes" | "no";
export type GenderFilter = "all" | "male" | "female" | "unset";

export const YES_NO_OPTIONS = [
  { value: "all", label: "All" },
  { value: "yes", label: "Enabled" },
  { value: "no", label: "Disabled" },
];

export const GENDER_OPTIONS = [
  { value: "all", label: "All" },
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "unset", label: "Not set" },
];

export function matchesYesNo(filter: YesNoFilter, value: boolean) {
  return filter === "all" || (filter === "yes") === value;
}

export function matchesGender(filter: GenderFilter, gender?: string) {
  if (filter === "all") return true;
  if (filter === "unset") return !gender;
  return gender === filter;
}

/** Case-insensitive de-duplicated, sorted list for filter dropdowns. */
export function uniqueSorted(values: Iterable<string | undefined | null>) {
  const byKey = new Map<string, string>();
  for (const v of values) {
    const trimmed = v?.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (!byKey.has(key)) byKey.set(key, trimmed);
  }
  return [...byKey.values()].sort((a, b) => a.localeCompare(b));
}

export function countActiveFilters(filters: Record<string, string>) {
  return Object.values(filters).filter((v) => v !== "all").length;
}

export function FilterSelect({
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

export function FilterPanel({
  activeCount,
  shown,
  total,
  onClear,
  children,
}: {
  activeCount: number;
  shown: number;
  total: number;
  onClear: () => void;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <Filter className="h-4 w-4 text-slate-400" />
          Filters
          {activeCount > 0 && (
            <Badge variant="secondary" className="text-xs">
              {activeCount} active
            </Badge>
          )}
        </p>
        <div className="flex items-center gap-3 text-sm text-slate-500">
          <span>
            Showing {shown} of {total}
          </span>
          {activeCount > 0 && (
            <Button type="button" size="sm" variant="ghost" onClick={onClear}>
              <X className="h-4 w-4" />
              Clear
            </Button>
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">{children}</div>
    </div>
  );
}

export function GenderQuickSelect({
  name,
  value,
  disabled,
  onChange,
}: {
  name: string;
  value?: string;
  disabled?: boolean;
  onChange: (gender: "male" | "female" | null) => void;
}) {
  return (
    <select
      value={value ?? ""}
      disabled={disabled}
      onChange={(e) => onChange((e.target.value || null) as "male" | "female" | null)}
      aria-label={`Gender of ${name}`}
      className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand disabled:opacity-50"
    >
      <option value="">Gender: not set</option>
      <option value="male">Gender: male</option>
      <option value="female">Gender: female</option>
    </select>
  );
}

/** Shared by the nurse and physiotherapist management lists (same row shape). */
export type StaffFilters = {
  city: string;
  gender: GenderFilter;
  homeVisit: YesNoFilter;
  onDuty: YesNoFilter;
  account: YesNoFilter;
  status: string;
  specialty: string;
};

export const DEFAULT_STAFF_FILTERS: StaffFilters = {
  city: "all",
  gender: "all",
  homeVisit: "all",
  onDuty: "all",
  account: "all",
  status: "all",
  specialty: "all",
};

type StaffFilterable = {
  city: string;
  gender?: string;
  specialties: string[];
  verificationStatus: string;
  homeVisitEnabled: boolean;
  isAvailable: boolean;
  isActive: boolean;
};

export function matchesStaffFilters(row: StaffFilterable, filters: StaffFilters) {
  if (filters.city !== "all" && row.city.trim().toLowerCase() !== filters.city.toLowerCase()) {
    return false;
  }
  if (!matchesGender(filters.gender, row.gender)) return false;
  if (filters.status !== "all" && row.verificationStatus !== filters.status) return false;
  if (filters.specialty !== "all" && !row.specialties.includes(filters.specialty)) return false;
  return (
    matchesYesNo(filters.homeVisit, row.homeVisitEnabled) &&
    matchesYesNo(filters.onDuty, row.isAvailable) &&
    matchesYesNo(filters.account, row.isActive)
  );
}

export function StaffFilterPanel({
  rows,
  filters,
  onChange,
  shown,
}: {
  rows: StaffFilterable[];
  filters: StaffFilters;
  onChange: (filters: StaffFilters) => void;
  shown: number;
}) {
  const cities = uniqueSorted(rows.map((r) => r.city));
  const specialties = uniqueSorted(rows.flatMap((r) => r.specialties));
  const set = <K extends keyof StaffFilters>(key: K, value: StaffFilters[K]) =>
    onChange({ ...filters, [key]: value });

  return (
    <FilterPanel
      activeCount={countActiveFilters(filters)}
      shown={shown}
      total={rows.length}
      onClear={() => onChange(DEFAULT_STAFF_FILTERS)}
    >
      <FilterSelect
        label="City"
        value={filters.city}
        onChange={(v) => set("city", v)}
        options={[{ value: "all", label: "All cities" }, ...cities.map((c) => ({ value: c, label: c }))]}
      />
      <FilterSelect
        label="Gender"
        value={filters.gender}
        onChange={(v) => set("gender", v as GenderFilter)}
        options={GENDER_OPTIONS}
      />
      <FilterSelect
        label="Home visits"
        value={filters.homeVisit}
        onChange={(v) => set("homeVisit", v as YesNoFilter)}
        options={YES_NO_OPTIONS}
      />
      <FilterSelect
        label="Duty"
        value={filters.onDuty}
        onChange={(v) => set("onDuty", v as YesNoFilter)}
        options={[
          { value: "all", label: "All" },
          { value: "yes", label: "On duty" },
          { value: "no", label: "Off duty" },
        ]}
      />
      <FilterSelect
        label="Account"
        value={filters.account}
        onChange={(v) => set("account", v as YesNoFilter)}
        options={[
          { value: "all", label: "All" },
          { value: "yes", label: "Active" },
          { value: "no", label: "Inactive" },
        ]}
      />
      <FilterSelect
        label="Status"
        value={filters.status}
        onChange={(v) => set("status", v)}
        options={[
          { value: "all", label: "All statuses" },
          { value: "approved", label: "Approved" },
          { value: "rejected", label: "Rejected" },
        ]}
      />
      <FilterSelect
        label="Specialty"
        value={filters.specialty}
        onChange={(v) => set("specialty", v)}
        options={[
          { value: "all", label: "All specialties" },
          ...specialties.map((s) => ({ value: s, label: s })),
        ]}
      />
    </FilterPanel>
  );
}
