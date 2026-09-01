"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, ShieldCheck } from "lucide-react";
import { LoadingScreen } from "@/components/ui/loading-screen";
import { Button } from "@/components/ui/button";
import { cn } from "@zindagi/shared";
import type { AdminActivityRow } from "@/server/services/admin-activity.service";

const PAGE_SIZE = 25;

function formatAction(action: string) {
  return action
    .split(/[._-]/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}

function ChangesCell({ changes }: { changes?: Record<string, unknown> }) {
  const [open, setOpen] = useState(false);
  if (!changes || Object.keys(changes).length === 0) {
    return <span className="text-slate-300">—</span>;
  }
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline"
      >
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
        {open ? "Hide" : "Details"}
      </button>
      {open && (
        <pre className="mt-2 max-w-sm overflow-x-auto rounded-lg bg-slate-50 p-2 text-xs text-slate-600">
          {JSON.stringify(changes, null, 2)}
        </pre>
      )}
    </div>
  );
}

export function AdminActivityAuditLog() {
  const [rows, setRows] = useState<AdminActivityRow[]>([]);
  const [actionOptions, setActionOptions] = useState<string[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (actionFilter) params.set("action", actionFilter);
    params.set("page", String(page));
    params.set("limit", String(PAGE_SIZE));

    const res = await fetch(`/api/v1/admin/admin-activity?${params.toString()}`);
    const json = await res.json();
    if (json.success) {
      setRows(json.data.rows ?? []);
      setTotal(json.data.total ?? 0);
      setActionOptions(json.data.actionOptions ?? []);
    }
    setLoading(false);
  }, [actionFilter, page]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [actionFilter]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
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
          <Button type="button" variant="outline" onClick={() => load()}>
            Refresh
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        {loading ? (
          <LoadingScreen message="Loading admin activity…" size="md" />
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center gap-3 p-16 text-center">
            <ShieldCheck className="h-10 w-10 text-slate-300" />
            <p className="text-sm text-slate-500">No admin activity recorded yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-5 py-4">When</th>
                  <th className="px-5 py-4">Admin</th>
                  <th className="px-5 py-4">Action</th>
                  <th className="px-5 py-4">Target</th>
                  <th className="px-5 py-4">Changes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row) => (
                  <tr key={row.id} className="transition hover:bg-slate-50/60">
                    <td className="px-5 py-4 text-slate-600">
                      {new Date(row.createdAt).toLocaleString("en-PK", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </td>
                    <td className="px-5 py-4">
                      <p className="font-semibold text-slate-900">{row.actorName ?? "Unknown"}</p>
                      {row.actorEmail && (
                        <p className="text-xs text-slate-400">{row.actorEmail}</p>
                      )}
                    </td>
                    <td className="px-5 py-4 text-slate-600">{formatAction(row.action)}</td>
                    <td className="px-5 py-4 text-slate-600">
                      {row.targetLabel ?? `${row.entityType} ${row.entityId.slice(-6)}`}
                    </td>
                    <td className="px-5 py-4">
                      <ChangesCell changes={row.changes} />
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
