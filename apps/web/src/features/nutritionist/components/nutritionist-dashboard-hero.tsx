import Link from "next/link";
import {
  CalendarCheck,
  Star,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { NutritionistAvatar } from "@/features/nutritionist/components/nutritionist-avatar";
import { formatPkr } from "@/features/nutritionist/types";
import { NUTRITIONIST_OVERVIEW_ACTIONS } from "@/features/nutritionist/data/nutritionist-workspace-nav";
import type { NutritionistDashboardSummary } from "@/server/services/nutritionist-dashboard.service";

type Props = {
  name: string;
  avatarUrl?: string | null;
  primarySpecialty?: string;
  summary: NutritionistDashboardSummary;
};

function Stat({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof Users;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2 text-slate-500">
        <Icon className="h-4 w-4" />
        <span className="text-xs font-medium uppercase tracking-wide">
          {label}
        </span>
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-slate-900">
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

export function NutritionistDashboardHero({
  name,
  avatarUrl,
  primarySpecialty,
  summary,
}: Props) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:flex-row sm:items-center">
        <NutritionistAvatar name={name} avatarUrl={avatarUrl} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-widest text-brand">
            Nutritionist workspace
          </p>
          <h2 className="truncate font-display text-xl font-semibold text-slate-900 sm:text-2xl">
            {name}
          </h2>
          <p className="mt-0.5 text-sm text-slate-600">
            {primarySpecialty ?? "Nutrition & diet planning"} · Video consultations
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          icon={Users}
          label="Patients"
          value={String(summary.patients)}
          hint={`${summary.returningPatients} returning`}
        />
        <Stat
          icon={CalendarCheck}
          label="Consults done"
          value={String(summary.completedAllTime)}
          hint={`${summary.completedThisMonth} this month`}
        />
        <Stat
          icon={Wallet}
          label="Earnings"
          value={formatPkr(summary.totalEarnings)}
          hint={`${formatPkr(summary.earningsThisMonth)} this month`}
        />
        <Stat
          icon={Star}
          label="Rating"
          value={summary.ratingCount ? summary.ratingAvg.toFixed(1) : "—"}
          hint={`${summary.ratingCount} review${summary.ratingCount === 1 ? "" : "s"}`}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat
          icon={CalendarCheck}
          label="Today"
          value={String(summary.todayAppointments)}
          hint="Appointments scheduled today"
        />
        <Stat
          icon={CalendarCheck}
          label="Next 7 days"
          value={String(summary.upcomingThisWeek)}
          hint="Upcoming consultations"
        />
        <Stat
          icon={TrendingUp}
          label="Completion rate"
          value={`${summary.completionRate}%`}
          hint="Completed vs missed / cancelled"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {NUTRITIONIST_OVERVIEW_ACTIONS.map((action) => {
          const Icon = action.icon;
          return (
            <Link
              key={action.href}
              href={action.href}
              className="group flex items-start gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm transition-colors hover:border-brand/40 hover:bg-brand/5"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600 group-hover:border-brand/30 group-hover:text-brand">
                <Icon className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-slate-900">
                  {action.label}
                </span>
                <span className="mt-0.5 block text-xs text-slate-500">
                  {action.description}
                </span>
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
