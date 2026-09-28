"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Activity as ActivityIcon,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  List,
  MapPin,
  Monitor,
  Route,
  Smartphone,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoadingScreen } from "@/components/ui/loading-screen";
import type {
  ActivityFeedRow,
  ActivitySummary,
} from "@/server/services/activity-log.service";
import { cn } from "@zindagi/shared";

const PAGE_SIZE = 50;

type ViewMode = "journeys" | "table";

type Focus = { kind: "user" | "visitor"; id: string; label: string } | null;

type ActorColor = { dot: string; border: string };

/**
 * Muted identifier colours — used only for a small marker dot and a thin left
 * rule so a person's actions can be followed without colouring the whole UI.
 * Full class strings so Tailwind keeps them.
 */
const ACTOR_PALETTE: readonly ActorColor[] = [
  { dot: "bg-sky-700", border: "border-l-sky-700" },
  { dot: "bg-teal-700", border: "border-l-teal-700" },
  { dot: "bg-indigo-600", border: "border-l-indigo-600" },
  { dot: "bg-amber-600", border: "border-l-amber-600" },
  { dot: "bg-rose-700", border: "border-l-rose-700" },
  { dot: "bg-emerald-700", border: "border-l-emerald-700" },
  { dot: "bg-violet-700", border: "border-l-violet-700" },
  { dot: "bg-cyan-700", border: "border-l-cyan-700" },
  { dot: "bg-orange-700", border: "border-l-orange-700" },
  { dot: "bg-blue-800", border: "border-l-blue-800" },
  { dot: "bg-stone-500", border: "border-l-stone-500" },
  { dot: "bg-lime-700", border: "border-l-lime-700" },
];

const ANON_COLOR: ActorColor = { dot: "bg-slate-300", border: "border-l-slate-200" };

function hashString(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

/**
 * Colour per person: seeded by a hash of their id (so a person keeps their
 * colour across refreshes), probing forward so two people on the same page
 * don't share a colour while free ones remain.
 */
function assignActorColors(events: ActivityFeedRow[]) {
  const colors = new Map<string, ActorColor>();
  const taken = new Set<number>();
  for (const event of events) {
    if (colors.has(event.actorKey)) continue;
    if (event.actorKey === "anon") {
      colors.set(event.actorKey, ANON_COLOR);
      continue;
    }
    let slot = hashString(event.actorKey) % ACTOR_PALETTE.length;
    if (taken.size < ACTOR_PALETTE.length) {
      while (taken.has(slot)) slot = (slot + 1) % ACTOR_PALETTE.length;
    }
    taken.add(slot);
    colors.set(event.actorKey, ACTOR_PALETTE[slot]);
  }
  return colors;
}

function formatAction(action: string) {
  return action
    .split(/[._-]/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}

const countryNames = (() => {
  try {
    return new Intl.DisplayNames(["en"], { type: "region" });
  } catch {
    return null;
  }
})();

function countryName(code: string | null) {
  if (!code) return null;
  try {
    return countryNames?.of(code.toUpperCase()) ?? code;
  } catch {
    return code;
  }
}

function formatLocation(event: Pick<ActivityFeedRow, "city" | "region" | "country">) {
  const country = countryName(event.country);
  if (event.city) return [event.city, country].filter(Boolean).join(", ");
  return country;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-PK", { hour: "numeric", minute: "2-digit" });
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-PK", { dateStyle: "medium", timeStyle: "short" });
}

function roleLabel(event: Pick<ActivityFeedRow, "userId" | "userRole">) {
  if (!event.userId) return "Guest";
  return formatAction(event.userRole);
}

function initials(name: string) {
  const parts = name.split(/\s+/).filter(Boolean);
  return (parts[0]?.[0] ?? "?").toUpperCase() + (parts[1]?.[0] ?? "").toUpperCase();
}

/** Consecutive events by the same person (newest first) form one journey block. */
type Journey = {
  key: string;
  actorKey: string;
  events: ActivityFeedRow[]; // oldest → newest
};

/** A gap longer than this between two actions starts a new journey, even for the same person. */
const JOURNEY_GAP_MS = 30 * 60 * 1000;

function groupJourneys(events: ActivityFeedRow[]): Journey[] {
  const journeys: Journey[] = [];
  for (const event of events) {
    const current = journeys[journeys.length - 1];
    const oldest = current?.events[0];
    const sameActor = current && current.actorKey === event.actorKey;
    const withinGap =
      oldest &&
      new Date(oldest.createdAt).getTime() - new Date(event.createdAt).getTime() <= JOURNEY_GAP_MS;
    if (sameActor && withinGap) {
      current.events.unshift(event);
    } else {
      journeys.push({ key: event.id, actorKey: event.actorKey, events: [event] });
    }
  }
  return journeys;
}

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

function ActorAvatar({ name, color }: { name: string; color: ActorColor }) {
  return (
    <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
      {initials(name)}
      <span
        className={cn(
          "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ring-2 ring-white",
          color.dot,
        )}
      />
    </span>
  );
}

function PlatformIcon({ platform }: { platform: string | null }) {
  if (platform === "mobile") return <Smartphone className="h-3.5 w-3.5" />;
  if (platform === "web") return <Monitor className="h-3.5 w-3.5" />;
  return null;
}

function focusFor(event: ActivityFeedRow): Focus {
  if (event.userId) return { kind: "user", id: event.userId, label: event.userName };
  if (event.visitorId) return { kind: "visitor", id: event.visitorId, label: event.userName };
  return null;
}

export function AdminActivityLog() {
  const [summary, setSummary] = useState<ActivitySummary | null>(null);
  const [events, setEvents] = useState<ActivityFeedRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [focus, setFocus] = useState<Focus>(null);
  const [view, setView] = useState<ViewMode>("journeys");
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
    if (focus?.kind === "user") params.set("userId", focus.id);
    if (focus?.kind === "visitor") params.set("visitorId", focus.id);
    params.set("page", String(page));
    params.set("pageSize", String(PAGE_SIZE));

    const res = await fetch(`/api/v1/admin/activity?${params.toString()}`);
    const json = await res.json();
    if (json.success) {
      setEvents(json.data.events ?? []);
      setTotal(json.data.total ?? 0);
    }
    setLoading(false);
  }, [actionFilter, roleFilter, statusFilter, focus, page]);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  /** Wraps a filter setter so changing it jumps back to page 1. */
  const resetting =
    <T,>(setter: (value: T) => void) =>
    (value: T) => {
      setter(value);
      setPage(1);
    };
  const changeAction = resetting(setActionFilter);
  const changeRole = resetting(setRoleFilter);
  const changeStatus = resetting(setStatusFilter);
  const changeFocus = resetting(setFocus);

  const actionOptions = useMemo(
    () => summary?.topActions.map((a) => a.action) ?? [],
    [summary],
  );
  const roleOptions = useMemo(
    () => summary?.byRole.map((r) => r.role) ?? [],
    [summary],
  );

  const colors = useMemo(() => assignActorColors(events), [events]);
  const colorOf = (actorKey: string) => colors.get(actorKey) ?? ANON_COLOR;
  const journeys = useMemo(() => groupJourneys(events), [events]);

  /** People on this page, in order of most recent activity, with their event counts. */
  const people = useMemo(() => {
    const byActor = new Map<string, { event: ActivityFeedRow; count: number }>();
    for (const event of events) {
      const entry = byActor.get(event.actorKey);
      if (entry) entry.count += 1;
      else byActor.set(event.actorKey, { event, count: 1 });
    }
    return [...byActor.entries()].map(([actorKey, v]) => ({ actorKey, ...v }));
  }, [events]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const focusButton = (event: ActivityFeedRow, children: ReactNode, className?: string) => {
    const target = focusFor(event);
    if (!target || focus) return <span className={className}>{children}</span>;
    return (
      <button
        type="button"
        onClick={() => changeFocus(target)}
        title={`Show every action by ${event.userName}`}
        className={cn("text-left hover:underline", className)}
      >
        {children}
      </button>
    );
  };

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
          { label: "Signups (7d)", value: summary?.signups7d ?? "—" },
          { label: "Site visitors (7d)", value: summary?.visitors7d ?? "—" },
          {
            label: "Visited, didn't sign up (7d)",
            value: summary?.visitorsNotConverted7d ?? "—",
          },
          {
            label: "Top city (7d)",
            value: summary?.topCities.find((c) => c.city !== "Unknown")?.city ?? "—",
          },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm"
          >
            <p className="text-sm font-medium text-slate-500">{s.label}</p>
            <p className="mt-1 truncate text-2xl font-semibold text-slate-900">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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
        <DistributionList
          title="Activity by city (7d)"
          rows={(summary?.topCities ?? []).map((c) => ({ label: c.city, count: c.count }))}
        />
      </div>

      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm lg:flex-row lg:items-center lg:justify-between sm:p-5">
        <div className="flex flex-wrap gap-2">
          <select
            value={actionFilter}
            onChange={(e) => changeAction(e.target.value)}
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
            onChange={(e) => changeRole(e.target.value)}
            disabled={Boolean(focus)}
            className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 disabled:opacity-50"
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
            onChange={(e) => changeStatus(e.target.value)}
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
        <div className="inline-flex rounded-lg border border-slate-200 p-1">
          {(
            [
              { id: "journeys", label: "Journeys", icon: Route },
              { id: "table", label: "Table", icon: List },
            ] as const
          ).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setView(id)}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition",
                view === id ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-50",
              )}
            >
              <Icon className="h-4 w-4" /> {label}
            </button>
          ))}
        </div>
      </div>

      {focus ? (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-slate-900 px-5 py-3 text-sm text-white shadow-sm">
          <span>
            Showing every action by <span className="font-semibold">{focus.label}</span>
            {" · "}
            {total} events
          </span>
          <button
            type="button"
            onClick={() => changeFocus(null)}
            className="flex items-center gap-1 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium hover:bg-white/20"
          >
            <X className="h-3.5 w-3.5" /> Show everyone
          </button>
        </div>
      ) : people.length > 0 ? (
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            People on this page · click one to see their full trail
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {people.map(({ actorKey, event, count }) => {
              const color = colorOf(actorKey);
              const target = focusFor(event);
              const location = formatLocation(event);
              return (
                <button
                  key={actorKey}
                  type="button"
                  disabled={!target}
                  onClick={() => target && changeFocus(target)}
                  className={cn(
                    "flex items-center gap-2 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-700 transition",
                    target ? "hover:border-slate-300 hover:bg-slate-50" : "cursor-default",
                  )}
                >
                  <span className={cn("h-2 w-2 rounded-full", color.dot)} />
                  <span className="font-medium">{event.userName}</span>
                  {location ? <span className="text-slate-400">{location}</span> : null}
                  <span className="tabular-nums text-slate-400">{count}</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        {loading ? (
          <LoadingScreen message="Loading activity…" size="md" />
        ) : events.length === 0 ? (
          <div className="flex flex-col items-center gap-3 p-16 text-center">
            <ActivityIcon className="h-10 w-10 text-slate-300" />
            <p className="text-sm text-slate-500">No activity recorded yet.</p>
          </div>
        ) : view === "journeys" ? (
          <div className="divide-y divide-slate-100">
            {journeys.map((journey) => {
              const first = journey.events[0];
              const last = journey.events[journey.events.length - 1];
              const color = colorOf(journey.actorKey);
              const location = formatLocation(last);
              const errors = journey.events.filter((e) => e.status === "error").length;
              return (
                <div key={journey.key} className={cn("border-l-2 px-5 py-4", color.border)}>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <ActorAvatar name={last.userName} color={color} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        {focusButton(
                          last,
                          last.userName,
                          "font-semibold text-slate-900",
                        )}
                        <span className="rounded border border-slate-200 px-1.5 py-px text-[11px] font-medium uppercase tracking-wide text-slate-500">
                          {roleLabel(last)}
                        </span>
                        {errors > 0 ? (
                          <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-600">
                            {errors} error{errors > 1 ? "s" : ""}
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500">
                        {location ? (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3.5 w-3.5" /> {location}
                          </span>
                        ) : null}
                        {last.ip ? <span className="font-mono">{last.ip}</span> : null}
                        {last.platform ? (
                          <span className="flex items-center gap-1">
                            <PlatformIcon platform={last.platform} /> {last.platform}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <div className="text-right text-xs text-slate-500">
                      <p className="font-medium text-slate-700">
                        {journey.events.length} action{journey.events.length > 1 ? "s" : ""}
                      </p>
                      <p>
                        {journey.events.length > 1
                          ? `${formatDateTime(first.createdAt)} – ${formatTime(last.createdAt)}`
                          : formatDateTime(last.createdAt)}
                      </p>
                    </div>
                  </div>
                  <ol className="mt-3 flex flex-wrap items-center gap-1.5 pl-12">
                    {journey.events.map((event, i) => (
                      <li key={event.id} className="flex items-center gap-1.5">
                        {i > 0 ? <ArrowRight className="h-3.5 w-3.5 text-slate-300" /> : null}
                        <span
                          title={`${formatDateTime(event.createdAt)}${event.path ? ` · ${event.path}` : ""}`}
                          className={cn(
                            "rounded-md border px-2 py-0.5 font-mono text-xs",
                            event.status === "error"
                              ? "border-red-200 bg-red-50/60 text-red-700"
                              : "border-slate-200 bg-slate-50 text-slate-700",
                          )}
                        >
                          {event.action === "page.view" && event.path
                            ? event.path
                            : formatAction(event.action)}
                          <span className="ml-2 font-sans text-slate-400">
                            {formatTime(event.createdAt)}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ol>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-5 py-4">User</th>
                  <th className="px-5 py-4">Role</th>
                  <th className="px-5 py-4">Action</th>
                  <th className="px-5 py-4">Outcome</th>
                  <th className="px-5 py-4">Location</th>
                  <th className="px-5 py-4">Platform</th>
                  <th className="px-5 py-4">When</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {events.map((event) => {
                  const color = colorOf(event.actorKey);
                  const location = formatLocation(event);
                  return (
                    <tr
                      key={event.id}
                      className={cn("border-l-2 transition hover:bg-slate-50/60", color.border)}
                    >
                      <td className="px-5 py-4">
                        <span className="flex items-center gap-2">
                          <span className={cn("h-2 w-2 shrink-0 rounded-full", color.dot)} />
                          {focusButton(event, event.userName, "font-semibold text-slate-900")}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-slate-600">{roleLabel(event)}</td>
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
                      <td className="px-5 py-4 text-slate-600">
                        {location ?? "—"}
                        {event.ip ? (
                          <span className="block font-mono text-xs text-slate-400">{event.ip}</span>
                        ) : null}
                      </td>
                      <td className="px-5 py-4 text-slate-600">{event.platform ?? "—"}</td>
                      <td className="px-5 py-4 text-slate-600">{formatDateTime(event.createdAt)}</td>
                    </tr>
                  );
                })}
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
