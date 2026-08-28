"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Search, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadingScreen } from "@/components/ui/loading-screen";
import type {
  AdminUserAnalyticsRow,
  UserAnalyticsSummary,
} from "@/server/services/admin-user-analytics.service";
import { cn } from "@zindagi/shared";

const PAGE_SIZE = 20;

function DistributionList({
  title,
  rows,
}: {
  title: string;
  rows: { label: string; count: number }[];
}) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
      <p className="text-sm font-semibold text-slate-800">{title}</p>
      <div className="mt-4 space-y-2.5">
        {rows.length === 0 ? (
          <p className="text-sm text-slate-400">No data yet.</p>
        ) : (
          rows.slice(0, 8).map((row) => (
            <div key={row.label} className="flex items-center gap-3">
              <span className="w-28 shrink-0 truncate text-xs font-medium text-slate-600">
                {row.label}
              </span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-brand"
                  style={{ width: `${(row.count / max) * 100}%` }}
                />
              </div>
              <span className="w-10 shrink-0 text-right text-xs font-semibold tabular-nums text-slate-700">
                {row.count}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export function AdminUserAnalytics() {
  const [summary, setSummary] = useState<UserAnalyticsSummary | null>(null);
  const [users, setUsers] = useState<AdminUserAnalyticsRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [loading, setLoading] = useState(true);

  const loadSummary = useCallback(async () => {
    const res = await fetch("/api/v1/admin/users/summary");
    const json = await res.json();
    if (json.success) setSummary(json.data as UserAnalyticsSummary);
  }, []);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (roleFilter) params.set("role", roleFilter);
    if (cityFilter) params.set("city", cityFilter);
    params.set("page", String(page));
    params.set("pageSize", String(PAGE_SIZE));

    const res = await fetch(`/api/v1/admin/users?${params.toString()}`);
    const json = await res.json();
    if (json.success) {
      setUsers(json.data.users ?? []);
      setTotal(json.data.total ?? 0);
    }
    setLoading(false);
  }, [search, roleFilter, cityFilter, page]);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    setPage(1);
  }, [search, roleFilter, cityFilter]);

  const roleOptions = useMemo(
    () => summary?.byRole.map((r) => r.role) ?? [],
    [summary],
  );
  const cityOptions = useMemo(
    () => summary?.byCity.map((c) => c.city) ?? [],
    [summary],
  );

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Total users", value: summary?.totalUsers ?? "—" },
          { label: "New today", value: summary?.newToday ?? "—" },
          { label: "New this week", value: summary?.newThisWeek ?? "—" },
          { label: "New this month", value: summary?.newThisMonth ?? "—" },
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

      <div className="grid gap-4 lg:grid-cols-3">
        <DistributionList
          title="By role"
          rows={(summary?.byRole ?? []).map((r) => ({ label: r.role, count: r.count }))}
        />
        <DistributionList
          title="By city"
          rows={(summary?.byCity ?? []).map((c) => ({ label: c.city, count: c.count }))}
        />
        <DistributionList
          title="By age group"
          rows={(summary?.byAgeGroup ?? []).map((a) => ({ label: a.ageGroup, count: a.count }))}
        />
      </div>

      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="relative flex-1 sm:max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Search by name, email, or phone…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700"
          >
            <option value="">All roles</option>
            {roleOptions.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <select
            value={cityFilter}
            onChange={(e) => setCityFilter(e.target.value)}
            className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700"
          >
            <option value="">All cities</option>
            {cityOptions.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <Button type="button" variant="outline" onClick={() => loadUsers()}>
            Search
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        {loading ? (
          <LoadingScreen message="Loading users…" size="md" />
        ) : users.length === 0 ? (
          <div className="flex flex-col items-center gap-3 p-16 text-center">
            <Users className="h-10 w-10 text-slate-300" />
            <p className="text-sm text-slate-500">No users found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-5 py-4">Name</th>
                  <th className="px-5 py-4">Email</th>
                  <th className="px-5 py-4">Phone</th>
                  <th className="px-5 py-4">City</th>
                  <th className="px-5 py-4">Age</th>
                  <th className="px-5 py-4">Role</th>
                  <th className="px-5 py-4">Registered</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((user) => (
                  <tr key={user.id} className="transition hover:bg-slate-50/60">
                    <td className="px-5 py-4 font-semibold text-slate-900">{user.name}</td>
                    <td className="px-5 py-4 text-slate-600">{user.email}</td>
                    <td className="px-5 py-4 text-slate-600">{user.phone}</td>
                    <td className="px-5 py-4 text-slate-600">{user.city}</td>
                    <td className="px-5 py-4 text-slate-600">{user.age}</td>
                    <td className="px-5 py-4 text-slate-600">{user.role}</td>
                    <td className="px-5 py-4 text-slate-600">
                      {new Date(user.registeredAt).toLocaleDateString("en-PK", {
                        dateStyle: "medium",
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="flex items-center justify-between border-t border-slate-200 px-5 py-3 text-sm text-slate-600">
          <span>
            Page {page} of {totalPages} · {total} users
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className={cn(
                "flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium",
                page <= 1 ? "cursor-not-allowed text-slate-300" : "text-slate-700 hover:bg-slate-50",
              )}
            >
              <ChevronLeft className="h-3.5 w-3.5" /> Prev
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className={cn(
                "flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium",
                page >= totalPages
                  ? "cursor-not-allowed text-slate-300"
                  : "text-slate-700 hover:bg-slate-50",
              )}
            >
              Next <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
