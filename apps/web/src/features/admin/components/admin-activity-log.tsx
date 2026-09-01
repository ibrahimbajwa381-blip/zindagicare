"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Activity as ActivityIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoadingScreen } from "@/components/ui/loading-screen";
import type {
  ActivityFeedRow,
  ActivitySummary,
} from "@/server/services/activity-log.service";
import { cn } from "@zindagi/shared";

const PAGE_SIZE = 25;

function DistributionList({
  title,
  rows,
  emphasis,
}: {
  title: string;
  rows: { label: string; count: number }[];
  emphasis?: "danger";
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
              <span className="w-32 shrink-0 truncate text-xs font-medium text-slate-600">
                {row.label}
              </span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                <div
                  className={cn(
                    "h-full rounded-full",
                    emphasis === "danger" ? "bg-red-500" : "bg-brand",
                  )}
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

function formatAction(action: string) {
  return action
    .split(/[._-]/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}

export function AdminActivityLog() {
  const [summary, setSummary] = useState<ActivitySummary | null>(null);
  const [events, setEvents] = useState<ActivityFeedRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);

  const loadSummary = useCallback(async () => {
    const res = await fetch("/api/v1/admin/activity/summary");
    const json = await res.json();
    if (json.success) setSummary(json.data as ActivitySummary);
  }, []);

  const loadEvents = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (actionFilter) params.set("action", actionFilter);
    if (roleFilter) params.set("role", roleFilter);
    if (statusFilter) params.set("status", statusFilter);
    params.set("page", String(page));
    params.set("pageSize", String(PAGE_SIZE));

    const res = await fetch(`/api/v1/admin/activity?${params.toString()}`);
    const json = await res.json();
    if (json.success) {
      setEvents(json.data.events ?? []);
      setTotal(json.data.total ?? 0);
    }
    setLoading(false);
  }, [actionFilter, roleFilter, statusFilter, page]);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  useEffect(() => {
    setPage(1);
  }, [actionFilter, roleFilter, statusFilter]);

  const actionOptions = useMemo(
    () => summary?.topActions.map((a) => a.action) ?? [],
    [summary],
  );
  const roleOptions = useMemo(
    () => summary?.byRole.map((r) => r.role) ?? [],
    [summary],
  );

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Total events", value: summary?.totalEvents ?? "—" },
          { label: "Last 24 hours", value: summary?.last24h ?? "—" },
          {
            label: "Error rate (7d)",
            value: summary ? `${(summary.errorRate7d * 100).toFixed(1)}%` : "—",
          },
          {
            label: "Active roles (7d)",
            value: summary?.byRole.length ?? "—",
          },
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
          title="Most-used features (7d)"
          rows={(summary?.topActions ?? []).map((a) => ({
            label: formatAction(a.action),
            count: a.count,
          }))}
        />
        <DistributionList
          title="Where users hit errors (7d)"
          rows={(summary?.topErrorActions ?? []).map((a) => ({
            label: formatAction(a.action),
            count: a.count,
          }))}
          emphasis="danger"
        />
        <DistributionList
          title="Activity by role (7d)"
          rows={(summary?.byRole ?? []).map((r) => ({ label: r.role, count: r.count }))}
        />
      </div>

      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="flex flex-wrap gap-2">
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700"
          >
            <option value="">All actions</option>
            {actionOptions.map((a) => (
              <option key={a} value={a}>
                {formatAction(a)}
              </option>
            ))}
          </select>
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
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700"
          >
            <option value="">All outcomes</option>
            <option value="success">Success</option>
            <option value="error">Error</option>
          </select>
          <Button type="button" variant="outline" onClick={() => loadEvents()}>
            Refresh
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        {loading ? (
          <LoadingScreen message="Loading activity…" size="md" />
        ) : events.length === 0 ? (
          <div className="flex flex-col items-center gap-3 p-16 text-center">
            <ActivityIcon className="h-10 w-10 text-slate-300" />
            <p className="text-sm text-slate-500">No activity recorded yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-5 py-4">User</th>
                  <th className="px-5 py-4">Role</th>
                  <th className="px-5 py-4">Action</th>
                  <th className="px-5 py-4">Outcome</th>
                  <th className="px-5 py-4">Platform</th>
                  <th className="px-5 py-4">When</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {events.map((event) => (
                  <tr key={event.id} className="transition hover:bg-slate-50/60">
                    <td className="px-5 py-4 font-semibold text-slate-900">
                      {event.userName}
                    </td>
                    <td className="px-5 py-4 text-slate-600">{event.userRole}</td>
                    <td className="px-5 py-4 text-slate-600">
                      {formatAction(event.action)}
                      {event.path ? (
                        <span className="ml-2 text-xs text-slate-400">{event.path}</span>
                      ) : null}
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-xs font-medium",
                          event.status === "error"
                            ? "bg-red-50 text-red-600"
                            : "bg-emerald-50 text-emerald-600",
                        )}
                      >
                        {event.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-slate-600">{event.platform ?? "—"}</td>
                    <td className="px-5 py-4 text-slate-600">
                      {new Date(event.createdAt).toLocaleString("en-PK", {
                        dateStyle: "medium",
                        timeStyle: "short",
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
            Page {page} of {totalPages} · {total} events
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
