"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  Building2,
  CalendarClock,
  Check,
  Copy,
  Flag,
  LayoutDashboard,
  MapPin,
  Megaphone,
  Pencil,
  Plus,
  Target,
  Trash2,
  Trophy,
} from "lucide-react";
import { cn } from "@zindagi/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { surfaceCard } from "@/lib/ui/surfaces";
import {
  KIND_LABELS,
  PARTNER_STAGES,
  PARTNER_STAGE_LABELS,
  PARTNER_TYPE_LABELS,
  PLANNING_STATUSES,
  PRIORITY_LABELS,
  STATUS_LABELS,
  currentMonthKey,
  formatMonthKey,
  planningBoardToText,
  targetProgress,
  type PlanningBoard,
  type PlanningItemRow,
  type PlanningKind,
  type PlanningStatus,
} from "@/features/admin/lib/planning";
import {
  PlanningItemForm,
  planningSelectClass,
  rowToRequestBody,
  savePlanningItem,
} from "./admin-planning-item-form";

type TabKey = "overview" | "target" | "cities" | Exclude<PlanningKind, "target">;

const TABS: { key: TabKey; label: string; icon: LucideIcon }[] = [
  { key: "overview", label: "Overview", icon: LayoutDashboard },
  { key: "target", label: "Targets", icon: Target },
  { key: "cities", label: "Cities", icon: MapPin },
  { key: "plan", label: "Plans", icon: Flag },
  { key: "partnership", label: "Partnerships", icon: Building2 },
  { key: "achievement", label: "Achievements", icon: Trophy },
  { key: "campaign", label: "Campaigns", icon: Megaphone },
  { key: "challenge", label: "Challenges", icon: AlertTriangle },
];

const NATIONWIDE = "__nationwide__";

const STATUS_STYLES: Record<PlanningStatus, string> = {
  planned: "bg-slate-100 text-slate-700",
  in_progress: "bg-sky-50 text-sky-700",
  on_hold: "bg-amber-100 text-amber-800",
  done: "bg-emerald-50 text-emerald-700",
  cancelled: "bg-slate-100 text-slate-400 line-through",
};

const PRIORITY_STYLES = {
  low: "text-slate-500",
  medium: "text-slate-700",
  high: "text-red-700",
} as const;

const OPEN_STATUSES: PlanningStatus[] = ["planned", "in_progress", "on_hold"];

function todayKey() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Karachi" });
}

function formatDay(key: string) {
  return new Date(`${key}T12:00:00+05:00`).toLocaleDateString("en-PK", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Karachi",
  });
}

function formatNumber(value: number) {
  return value.toLocaleString("en-PK");
}

function Pill({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
        className,
      )}
    >
      {children}
    </span>
  );
}

function ProgressBar({ percent }: { percent: number }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
      <div
        className={cn(
          "h-full rounded-full transition-[width]",
          percent >= 100 ? "bg-emerald-500" : percent >= 60 ? "bg-brand" : "bg-amber-500",
        )}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

function StatTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className={cn(surfaceCard, "p-4")}>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-slate-500">{sub}</p>}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <p className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
      {text}
    </p>
  );
}

async function fetchBoard(month: string): Promise<PlanningBoard> {
  const res = await fetch(`/api/v1/admin/planning?month=${month}`);
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.success) {
    throw new Error(json?.error?.message ?? "Could not load the planning board");
  }
  return json.data as PlanningBoard;
}

function isOverdue(item: PlanningItemRow) {
  return Boolean(item.dueDate && OPEN_STATUSES.includes(item.status) && item.dueDate < todayKey());
}

/** One entry as a card, with the details that matter for its kind. */
function ItemCard({
  item,
  onEdit,
  onDelete,
  onProgress,
}: {
  item: PlanningItemRow;
  onEdit: () => void;
  onDelete: () => void;
  onProgress?: (value: number) => Promise<void>;
}) {
  const progress = item.kind === "target" ? targetProgress(item) : null;
  const [progressDraft, setProgressDraft] = useState(String(item.currentValue ?? 0));
  const [savingProgress, setSavingProgress] = useState(false);

  return (
    <div className={cn(surfaceCard, "flex flex-col gap-3 p-4")}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-slate-900">{item.title}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
            {item.kind !== "achievement" && (
              <Pill className={STATUS_STYLES[item.status]}>{STATUS_LABELS[item.status]}</Pill>
            )}
            {item.kind === "partnership" && item.stage && (
              <Pill className="bg-brand/10 text-brand">{PARTNER_STAGE_LABELS[item.stage]}</Pill>
            )}
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {item.city ?? "Nationwide"}
            </span>
            {item.kind !== "achievement" && (
              <span className={PRIORITY_STYLES[item.priority]}>
                · {PRIORITY_LABELS[item.priority]} priority
              </span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 gap-1">
          <button
            type="button"
            aria-label="Edit"
            onClick={onEdit}
            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="Delete"
            onClick={onDelete}
            className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {item.kind === "target" && (
        <div className="space-y-1.5">
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span className="text-slate-600">
              {item.metric ?? "Progress"}
              {item.month && <span className="text-slate-400"> · {formatMonthKey(item.month)}</span>}
            </span>
            <span className="font-semibold tabular-nums text-slate-900">
              {formatNumber(item.currentValue ?? 0)} / {formatNumber(item.targetValue ?? 0)}
              {item.unit && <span className="font-normal text-slate-500"> {item.unit}</span>}
            </span>
          </div>
          {progress !== null && <ProgressBar percent={progress} />}
          {onProgress && (
            <form
              className="flex items-center gap-2 pt-1"
              onSubmit={async (e) => {
                e.preventDefault();
                const value = Number(progressDraft);
                if (!Number.isFinite(value) || value < 0) return;
                setSavingProgress(true);
                try {
                  await onProgress(value);
                } finally {
                  setSavingProgress(false);
                }
              }}
            >
              <Input
                type="number"
                min={0}
                aria-label="Achieved so far"
                value={progressDraft}
                onChange={(e) => setProgressDraft(e.target.value)}
                className="h-9 max-w-[8rem]"
              />
              <Button
                type="submit"
                size="sm"
                variant="outline"
                loading={savingProgress}
                disabled={progressDraft === String(item.currentValue ?? 0)}
              >
                Update
              </Button>
              {progress !== null && (
                <span className="text-xs font-medium text-slate-500">{progress}%</span>
              )}
            </form>
          )}
        </div>
      )}

      {item.kind === "partnership" && (item.partnerType || item.contactName || item.contactPhone) && (
        <p className="text-sm text-slate-600">
          {item.partnerType && PARTNER_TYPE_LABELS[item.partnerType]}
          {(item.contactName || item.contactPhone) && (
            <span className="text-slate-500">
              {item.partnerType && " · "}
              {[item.contactName, item.contactPhone].filter(Boolean).join(", ")}
            </span>
          )}
        </p>
      )}

      {item.description && (
        <p className="whitespace-pre-line text-sm leading-relaxed text-slate-600">
          {item.description}
        </p>
      )}

      <div className="mt-auto flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
        {item.achievedAt && <span>Achieved {formatDay(item.achievedAt)}</span>}
        {item.startDate && <span>Starts {formatDay(item.startDate)}</span>}
        {item.dueDate && (
          <span className={isOverdue(item) ? "font-semibold text-red-600" : undefined}>
            {isOverdue(item) ? "Overdue · " : "Due "}
            {formatDay(item.dueDate)}
          </span>
        )}
        {item.budget != null && <span>Budget PKR {formatNumber(item.budget)}</span>}
        {item.owner && <span>Owner: {item.owner}</span>}
        <span>Added by {item.createdByName}</span>
      </div>
    </div>
  );
}

export function AdminPlanningBoard() {
  const [board, setBoard] = useState<PlanningBoard | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>("overview");
  const [month, setMonth] = useState(currentMonthKey);
  const [cityFilter, setCityFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<PlanningStatus | "open" | "">("");
  const [search, setSearch] = useState("");
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const [editor, setEditor] = useState<{ kind: PlanningKind; item?: PlanningItemRow } | null>(
    null,
  );

  const load = useCallback(async () => {
    try {
      setBoard(await fetchBoard(month));
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Could not load the planning board");
    }
  }, [month]);

  useEffect(() => {
    let cancelled = false;
    fetchBoard(month)
      .then((data) => {
        if (cancelled) return;
        setBoard(data);
        setLoadError(null);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : "Could not load the planning board");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [month]);

  const items = useMemo(() => board?.items ?? [], [board]);

  const cities = useMemo(() => {
    const set = new Set<string>();
    for (const item of items) if (item.city) set.add(item.city);
    for (const row of board?.live.byCity ?? []) if (row.city !== "Unknown") set.add(row.city);
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [items, board]);

  const matchesFilters = useCallback(
    (item: PlanningItemRow) => {
      if (cityFilter === NATIONWIDE && item.city) return false;
      if (cityFilter && cityFilter !== NATIONWIDE && item.city !== cityFilter) return false;
      if (statusFilter === "open" && !OPEN_STATUSES.includes(item.status)) return false;
      if (statusFilter && statusFilter !== "open" && item.status !== statusFilter) return false;
      if (search) {
        const haystack = `${item.title} ${item.description ?? ""} ${item.owner ?? ""} ${item.metric ?? ""}`;
        if (!haystack.toLowerCase().includes(search.toLowerCase())) return false;
      }
      return true;
    },
    [cityFilter, statusFilter, search],
  );

  const monthTargets = useMemo(
    () => items.filter((i) => i.kind === "target" && i.month === month),
    [items, month],
  );

  const remove = async (item: PlanningItemRow) => {
    if (!window.confirm(`Delete "${item.title}"? This can't be undone from this page.`)) return;
    setActionError(null);
    try {
      const res = await fetch(`/api/v1/admin/planning/${item.id}`, { method: "DELETE" });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) throw new Error(json?.error?.message ?? "Could not delete");
      await load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not delete");
    }
  };

  const updateProgress = async (item: PlanningItemRow, value: number) => {
    setActionError(null);
    try {
      await savePlanningItem(item.id, rowToRequestBody(item, { currentValue: value }));
      await load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not update progress");
    }
  };

  const copyAll = async () => {
    if (!board) return;
    try {
      await navigator.clipboard.writeText(planningBoardToText(board));
      setCopyState("copied");
    } catch {
      // Clipboard access can be blocked (permissions / insecure context) — say so on the button.
      setCopyState("failed");
    }
    setTimeout(() => setCopyState("idle"), 2000);
  };

  const renderCard = (item: PlanningItemRow) => (
    <ItemCard
      // Remount when progress changes elsewhere so the inline draft resets.
      key={`${item.id}:${item.currentValue ?? 0}`}
      item={item}
      onEdit={() => setEditor({ kind: item.kind, item })}
      onDelete={() => remove(item)}
      onProgress={item.kind === "target" ? (v) => updateProgress(item, v) : undefined}
    />
  );

  if (!board) {
    return loadError ? (
      <div className="space-y-3">
        <p className="text-sm text-red-600">{loadError}</p>
        <Button variant="outline" onClick={() => void load()}>
          Try again
        </Button>
      </div>
    ) : (
      <p className="text-sm text-slate-500">Loading planning board…</p>
    );
  }

  // ---- Summary numbers -------------------------------------------------------
  const targetsWithProgress = monthTargets
    .map(targetProgress)
    .filter((p): p is number => p !== null);
  const avgTargetProgress = targetsWithProgress.length
    ? Math.round(targetsWithProgress.reduce((a, b) => a + b, 0) / targetsWithProgress.length)
    : null;
  const targetsHit = targetsWithProgress.filter((p) => p >= 100).length;
  const activePlans = items.filter((i) => i.kind === "plan" && OPEN_STATUSES.includes(i.status));
  const livePartners = items.filter(
    (i) => i.kind === "partnership" && (i.stage === "signed" || i.stage === "active"),
  );
  const pipelinePartners = items.filter(
    (i) =>
      i.kind === "partnership" &&
      (i.stage === "prospect" || i.stage === "contacted" || i.stage === "negotiating"),
  );
  const year = todayKey().slice(0, 4);
  const achievementsThisYear = items.filter(
    (i) => i.kind === "achievement" && i.achievedAt?.startsWith(year),
  );
  const openChallenges = items.filter(
    (i) => i.kind === "challenge" && OPEN_STATUSES.includes(i.status),
  );
  const overdue = items.filter(isOverdue);
  const upcoming = items
    .filter((i) => i.dueDate && OPEN_STATUSES.includes(i.status))
    .sort((a, b) => (a.dueDate! < b.dueDate! ? -1 : 1))
    .slice(0, 8);
  const recentAchievements = items
    .filter((i) => i.kind === "achievement")
    .sort((a, b) => ((a.achievedAt ?? "") < (b.achievedAt ?? "") ? 1 : -1))
    .slice(0, 5);

  const filters = (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
      <Input
        value={search}
        placeholder="Search…"
        onChange={(e) => setSearch(e.target.value)}
        className="sm:max-w-[14rem]"
      />
      <select
        aria-label="City"
        className={cn(planningSelectClass, "sm:w-48")}
        value={cityFilter}
        onChange={(e) => setCityFilter(e.target.value)}
      >
        <option value="">All cities</option>
        <option value={NATIONWIDE}>Nationwide only</option>
        {cities.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
      <select
        aria-label="Status"
        className={cn(planningSelectClass, "sm:w-44")}
        value={statusFilter}
        onChange={(e) => setStatusFilter(e.target.value as PlanningStatus | "open" | "")}
      >
        <option value="">Any status</option>
        <option value="open">Open (not done)</option>
        {PLANNING_STATUSES.map((s) => (
          <option key={s} value={s}>
            {STATUS_LABELS[s]}
          </option>
        ))}
      </select>
    </div>
  );

  const monthPicker = (
    <label className="flex items-center gap-2 text-sm text-slate-600">
      Month
      <Input
        type="month"
        value={month}
        onChange={(e) => e.target.value && setMonth(e.target.value)}
        className="h-10 w-44"
      />
    </label>
  );

  // ---- Tabs ------------------------------------------------------------------
  let content: React.ReactNode;

  if (tab === "overview") {
    content = (
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className={surfaceCard}>
          <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
            <CardTitle className="text-base">Targets · {formatMonthKey(month)}</CardTitle>
            <Button size="sm" variant="outline" onClick={() => setEditor({ kind: "target" })}>
              <Plus className="mr-1 h-4 w-4" /> Target
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {monthTargets.length === 0 ? (
              <EmptyState text="No targets set for this month yet." />
            ) : (
              monthTargets.map((t) => {
                const p = targetProgress(t) ?? 0;
                return (
                  <div key={t.id} className="space-y-1.5">
                    <div className="flex items-baseline justify-between gap-2 text-sm">
                      <span className="font-medium text-slate-800">
                        {t.title}
                        {t.city && <span className="font-normal text-slate-400"> · {t.city}</span>}
                      </span>
                      <span className="shrink-0 tabular-nums text-slate-600">
                        {formatNumber(t.currentValue ?? 0)}/{formatNumber(t.targetValue ?? 0)} · {p}%
                      </span>
                    </div>
                    <ProgressBar percent={p} />
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        <Card className={surfaceCard}>
          <CardHeader>
            <CardTitle className="text-base">Live on the platform · {formatMonthKey(month)}</CardTitle>
            <p className="text-sm text-slate-500">
              Real numbers from the app, to compare with your targets.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <p className="text-2xl font-semibold tabular-nums">{formatNumber(board.live.newPatients)}</p>
                <p className="text-xs text-slate-500">New patients</p>
              </div>
              <div>
                <p className="text-2xl font-semibold tabular-nums">{formatNumber(board.live.newProviders)}</p>
                <p className="text-xs text-slate-500">New providers</p>
              </div>
              <div>
                <p className="text-2xl font-semibold tabular-nums">
                  {formatNumber(board.live.completedConsults)}
                </p>
                <p className="text-xs text-slate-500">Completed consults</p>
              </div>
            </div>
            {board.live.byCity.length > 0 && (
              <div className="space-y-1 border-t border-slate-100 pt-3 text-sm">
                {board.live.byCity.slice(0, 6).map((row) => (
                  <div key={row.city} className="flex justify-between gap-2 text-slate-600">
                    <span>{row.city}</span>
                    <span className="tabular-nums">
                      {row.newPatients} patients · {row.newProviders} providers
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className={surfaceCard}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarClock className="h-4 w-4 text-brand" /> Coming up
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {upcoming.length === 0 ? (
              <EmptyState text="Nothing with a due date yet." />
            ) : (
              upcoming.map((i) => (
                <button
                  key={i.id}
                  type="button"
                  onClick={() => setEditor({ kind: i.kind, item: i })}
                  className="flex w-full items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-slate-50"
                >
                  <span className="min-w-0 truncate">
                    <span className="text-xs text-slate-400">{KIND_LABELS[i.kind].singular} · </span>
                    <span className="text-slate-800">{i.title}</span>
                  </span>
                  <span
                    className={cn(
                      "shrink-0 text-xs",
                      isOverdue(i) ? "font-semibold text-red-600" : "text-slate-500",
                    )}
                  >
                    {formatDay(i.dueDate!)}
                  </span>
                </button>
              ))
            )}
          </CardContent>
        </Card>

        <Card className={surfaceCard}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="h-4 w-4 text-brand" /> Partnership pipeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {PARTNER_STAGES.map((stage) => (
                <div key={stage} className="rounded-lg bg-slate-50 p-2 text-center">
                  <p className="text-lg font-semibold tabular-nums">
                    {items.filter((i) => i.kind === "partnership" && i.stage === stage).length}
                  </p>
                  <p className="text-[11px] leading-tight text-slate-500">
                    {PARTNER_STAGE_LABELS[stage]}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className={cn(surfaceCard, "lg:col-span-2")}>
          <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <Trophy className="h-4 w-4 text-amber-500" /> Recent achievements
            </CardTitle>
            <Button size="sm" variant="outline" onClick={() => setEditor({ kind: "achievement" })}>
              <Plus className="mr-1 h-4 w-4" /> Achievement
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {recentAchievements.length === 0 ? (
              <EmptyState text="Record your first win — the first hospital signed, 100th consult, a new city launch…" />
            ) : (
              recentAchievements.map((a) => (
                <div key={a.id} className="flex items-start justify-between gap-3 text-sm">
                  <span>
                    <span className="font-medium text-slate-800">{a.title}</span>
                    {a.city && <span className="text-slate-400"> · {a.city}</span>}
                  </span>
                  {a.achievedAt && (
                    <span className="shrink-0 text-xs text-slate-500">{formatDay(a.achievedAt)}</span>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    );
  } else if (tab === "target") {
    const visible = items
      .filter((i) => i.kind === "target" && i.month === month && matchesFilters(i))
      .sort((a, b) => (a.city ?? "").localeCompare(b.city ?? ""));
    content = (
      <div className="space-y-4">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          {monthPicker}
          {filters}
        </div>
        {visible.length === 0 ? (
          <EmptyState text={`No targets for ${formatMonthKey(month)} match. Add one with the button above.`} />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{visible.map(renderCard)}</div>
        )}
      </div>
    );
  } else if (tab === "cities") {
    const groups = [...cities, NATIONWIDE].map((city) => {
      const inCity = items.filter((i) => (city === NATIONWIDE ? !i.city : i.city === city));
      const live = board.live.byCity.find((r) => r.city === city);
      return { city, inCity, live };
    });
    content = (
      <div className="space-y-4">
        {monthPicker}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {groups
            .filter((g) => g.inCity.length > 0 || g.live)
            .map(({ city, inCity, live }) => {
              const targets = inCity.filter((i) => i.kind === "target" && i.month === month);
              const progressValues = targets.map(targetProgress).filter((p): p is number => p !== null);
              const avg = progressValues.length
                ? Math.round(progressValues.reduce((a, b) => a + b, 0) / progressValues.length)
                : null;
              const count = (kind: PlanningKind, open = false) =>
                inCity.filter((i) => i.kind === kind && (!open || OPEN_STATUSES.includes(i.status)))
                  .length;
              return (
                <div key={city} className={cn(surfaceCard, "space-y-3 p-4")}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="flex items-center gap-1.5 font-semibold text-slate-900">
                      <MapPin className="h-4 w-4 text-brand" />
                      {city === NATIONWIDE ? "Nationwide" : city}
                    </p>
                    <button
                      type="button"
                      className="text-xs font-medium text-brand hover:underline"
                      onClick={() => {
                        setCityFilter(city);
                        setTab("plan");
                      }}
                    >
                      View plans →
                    </button>
                  </div>
                  {avg !== null ? (
                    <div className="space-y-1">
                      <p className="text-xs text-slate-500">
                        {targets.length} target{targets.length === 1 ? "" : "s"} this month · {avg}% avg
                      </p>
                      <ProgressBar percent={avg} />
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400">No targets for {formatMonthKey(month)}</p>
                  )}
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm text-slate-600">
                    <span>Open plans: {count("plan", true)}</span>
                    <span>Partnerships: {count("partnership")}</span>
                    <span>Campaigns: {count("campaign", true)}</span>
                    <span>Achievements: {count("achievement")}</span>
                    <span>Open challenges: {count("challenge", true)}</span>
                    {live && (
                      <span>
                        Sign-ups: {live.newPatients + live.newProviders}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
        </div>
        <p className="text-xs text-slate-500">
          To plan for a new city, add a plan or target and set its city — it will show up here.
        </p>
      </div>
    );
  } else {
    const kind = tab;
    const visible = items
      .filter((i) => i.kind === kind && matchesFilters(i))
      .sort((a, b) =>
        kind === "achievement"
          ? (b.achievedAt ?? "").localeCompare(a.achievedAt ?? "")
          : Number(isOverdue(b)) - Number(isOverdue(a)) ||
            (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"),
      );
    content = (
      <div className="space-y-4">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <p className="text-sm text-slate-500">{KIND_LABELS[kind].hint}.</p>
          {filters}
        </div>
        {visible.length === 0 ? (
          <EmptyState text={`No ${KIND_LABELS[kind].plural.toLowerCase()} yet.`} />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{visible.map(renderCard)}</div>
        )}
      </div>
    );
  }

  const addKind: PlanningKind =
    tab === "overview" || tab === "cities" ? "plan" : tab;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatTile
          label="Targets this month"
          value={avgTargetProgress === null ? "—" : `${avgTargetProgress}%`}
          sub={`${targetsHit} of ${monthTargets.length} hit`}
        />
        <StatTile label="Active plans" value={String(activePlans.length)} />
        <StatTile
          label="Partners signed"
          value={String(livePartners.length)}
          sub={`${pipelinePartners.length} in the pipeline`}
        />
        <StatTile label={`Achievements ${year}`} value={String(achievementsThisYear.length)} />
        <StatTile label="Open challenges" value={String(openChallenges.length)} />
        <StatTile
          label="Overdue"
          value={String(overdue.length)}
          sub={overdue.length ? "Past their due date" : "All on track"}
        />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <div className="flex w-max gap-1 rounded-xl bg-slate-100 p-1">
            {TABS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                  tab === key
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-800",
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" onClick={copyAll} title="Copy every entry as text">
            {copyState === "copied" ? (
              <Check className="mr-1.5 h-4 w-4 text-emerald-600" />
            ) : (
              <Copy className="mr-1.5 h-4 w-4" />
            )}
            {copyState === "copied" ? "Copied" : copyState === "failed" ? "Copy failed" : "Copy all"}
          </Button>
          <Button onClick={() => setEditor({ kind: addKind })}>
            <Plus className="mr-1.5 h-4 w-4" />
            Add {KIND_LABELS[addKind].singular.toLowerCase()}
          </Button>
        </div>
      </div>

      {(actionError || loadError) && (
        <p className="text-sm text-red-600">{actionError ?? loadError}</p>
      )}

      {content}

      {editor && (
        <PlanningItemForm
          key={editor.item?.id ?? `new-${editor.kind}`}
          kind={editor.kind}
          item={editor.item}
          onClose={() => setEditor(null)}
          onSaved={async () => {
            setEditor(null);
            await load();
          }}
        />
      )}
    </div>
  );
}
