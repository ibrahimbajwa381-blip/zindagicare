import Link from "next/link";
import {
  CalendarCheck,
  Clock,
  Eye,
  Globe2,
  Lightbulb,
  MapPin,
  MousePointerClick,
  Smartphone,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react";
import { cn } from "@zindagi/shared";
import { DoctorEmptyState } from "@/features/doctor/components/doctor-workspace-panels";
import {
  ANALYTICS_RANGES,
  type CountRow,
  type DoctorProfileAnalytics,
  type MetricWithChange,
} from "@/server/services/doctor-profile-analytics.service";

function formatNumber(n: number) {
  return n.toLocaleString("en-PK");
}

function formatPercent(ratio: number) {
  return `${(ratio * 100).toFixed(ratio > 0 && ratio < 0.1 ? 1 : 0)}%`;
}

function formatHour(hour: number) {
  const suffix = hour < 12 ? "am" : "pm";
  return `${hour % 12 === 0 ? 12 : hour % 12}${suffix}`;
}

function formatRelative(iso: string, now = Date.now()) {
  const minutes = Math.round((now - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Intl.DateTimeFormat("en-PK", { dateStyle: "medium", timeZone: "Asia/Karachi" }).format(
    new Date(iso),
  );
}

function formatDay(date: string) {
  return new Intl.DateTimeFormat("en-PK", { day: "numeric", month: "short", timeZone: "UTC" }).format(
    new Date(`${date}T00:00:00Z`),
  );
}

function Section({
  icon: Icon,
  title,
  description,
  children,
  className,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm",
        className,
      )}
    >
      <div className="border-b border-slate-100 px-5 py-4">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600">
            <Icon className="h-4.5 w-4.5" />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
            {description && <p className="mt-0.5 text-xs text-slate-500">{description}</p>}
          </div>
        </div>
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function ChangeBadge({ metric }: { metric: MetricWithChange }) {
  if (metric.previous === 0) {
    return metric.value > 0 ? (
      <span className="text-xs font-medium text-emerald-700">New this period</span>
    ) : null;
  }
  const change = (metric.value - metric.previous) / metric.previous;
  const up = change >= 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs font-medium",
        up ? "text-emerald-700" : "text-rose-600",
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {up ? "+" : ""}
      {formatPercent(change)} vs previous period
    </span>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  hint,
  metric,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint?: string;
  metric?: MetricWithChange;
}) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
        <Icon className="h-4 w-4 text-brand" />
      </div>
      <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
      <div className="mt-1 min-h-4">
        {metric ? <ChangeBadge metric={metric} /> : hint && <p className="text-xs text-slate-500">{hint}</p>}
      </div>
    </div>
  );
}

function BarList({ rows, total, empty }: { rows: CountRow[]; total: number; empty: string }) {
  if (!rows.length) return <p className="text-sm text-slate-500">{empty}</p>;
  const max = Math.max(...rows.map((r) => r.count), 1);
  return (
    <ul className="space-y-3">
      {rows.map((row) => (
        <li key={row.key}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate text-slate-700">{row.label}</span>
            <span className="shrink-0 font-medium tabular-nums text-slate-900">
              {formatNumber(row.count)}
              <span className="ml-1.5 text-xs font-normal text-slate-500">
                {formatPercent(total ? row.count / total : 0)}
              </span>
            </span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-brand" style={{ width: `${(row.count / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function DailyChart({ daily }: { daily: DoctorProfileAnalytics["daily"] }) {
  const max = Math.max(...daily.map((d) => d.views), 1);
  const labelEvery = daily.length > 31 ? 14 : daily.length > 7 ? 5 : 1;
  return (
    <div>
      <div className="flex h-44 items-end gap-[2px]" role="img" aria-label="Daily profile views">
        {daily.map((d) => (
          <div
            key={d.date}
            className="group relative flex h-full min-w-0 flex-1 flex-col justify-end"
            title={`${formatDay(d.date)}: ${d.views} views, ${d.visitors} visitors`}
          >
            <div
              className="w-full rounded-t-sm bg-brand/80 transition-colors group-hover:bg-brand"
              style={{ height: `${(d.views / max) * 100}%`, minHeight: d.views ? 3 : 0 }}
            />
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-[2px] border-t border-slate-100 pt-2">
        {daily.map((d, i) => (
          <div key={d.date} className="min-w-0 flex-1 text-center text-[10px] text-slate-400">
            {i % labelEvery === 0 ? formatDay(d.date) : ""}
          </div>
        ))}
      </div>
    </div>
  );
}

function HourChart({ hours }: { hours: DoctorProfileAnalytics["hours"] }) {
  const max = Math.max(...hours.map((h) => h.count), 1);
  return (
    <div>
      <div className="flex h-24 items-end gap-[2px]">
        {hours.map((h) => (
          <div
            key={h.hour}
            className="flex h-full flex-1 flex-col justify-end"
            title={`${formatHour(h.hour)}: ${h.count} views`}
          >
            <div
              className="w-full rounded-t-sm bg-sky-500/80"
              style={{ height: `${(h.count / max) * 100}%`, minHeight: h.count ? 3 : 0 }}
            />
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between text-[10px] text-slate-400">
        <span>12am</span>
        <span>6am</span>
        <span>12pm</span>
        <span>6pm</span>
        <span>11pm</span>
      </div>
    </div>
  );
}

function buildInsights(data: DoctorProfileAnalytics): string[] {
  const insights: string[] = [];
  const known = data.sources.filter((s) => s.key !== "unknown");
  if (known[0]) {
    insights.push(`Most of your visitors find you through ${known[0].label.toLowerCase()}.`);
  }
  const peak = [...data.hours].sort((a, b) => b.count - a.count)[0];
  if (peak && peak.count > 0) {
    insights.push(
      `Patients look at your profile most around ${formatHour(peak.hour)}. Keeping slots open in the hours after that can help you get more bookings.`,
    );
  }
  const busiestDay = [...data.weekdays].sort((a, b) => b.count - a.count)[0];
  if (busiestDay && busiestDay.count > 0) {
    insights.push(`${busiestDay.day} is your busiest day for profile visits.`);
  }
  if (data.uniqueVisitors.value >= 20 && data.conversionRate < 0.05) {
    insights.push(
      "Many people view your profile but few book. A clear photo, a detailed bio and more available slots usually raise bookings.",
    );
  }
  if (!data.sources.some((s) => s.key === "share_link")) {
    insights.push(
      "Share your profile link on WhatsApp and social media. Visits from your link are counted separately so you can see what they bring in.",
    );
  }
  return insights.slice(0, 4);
}

export function DoctorProfileAnalyticsPanel({ data }: { data: DoctorProfileAnalytics }) {
  const totalViews = data.views.value;
  const insights = buildInsights(data);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav className="inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm" aria-label="Date range">
          {ANALYTICS_RANGES.map((days) => (
            <Link
              key={days}
              href={`/doctor/analytics?range=${days}`}
              scroll={false}
              aria-current={days === data.rangeDays ? "page" : undefined}
              className={cn(
                "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                days === data.rangeDays
                  ? "bg-brand text-white"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
              )}
            >
              Last {days} days
            </Link>
          ))}
        </nav>
        {data.profilePath && (
          <Link href={data.profilePath} target="_blank" className="text-sm font-medium text-brand hover:underline">
            View public profile →
          </Link>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard icon={Eye} label="Profile views" value={formatNumber(totalViews)} metric={data.views} />
        <KpiCard
          icon={Users}
          label="Unique visitors"
          value={formatNumber(data.uniqueVisitors.value)}
          metric={data.uniqueVisitors}
        />
        <KpiCard
          icon={CalendarCheck}
          label="Bookings"
          value={formatNumber(data.bookings.value)}
          metric={data.bookings}
        />
        <KpiCard
          icon={MousePointerClick}
          label="Visitor → booking"
          value={formatPercent(data.conversionRate)}
          hint="Bookings per unique visitor"
        />
      </div>

      {totalViews === 0 ? (
        <section className="rounded-2xl border border-slate-200/80 bg-white shadow-sm">
          <DoctorEmptyState message="No profile visits in this period yet. Share your profile link to start getting visitors." />
        </section>
      ) : (
        <>
          <Section
            icon={TrendingUp}
            title="Daily profile views"
            description="Hover over a bar to see that day's views and visitors."
          >
            <DailyChart daily={data.daily} />
          </Section>

          {insights.length > 0 && (
            <Section icon={Lightbulb} title="Insights" description="Suggestions based on your traffic.">
              <ul className="space-y-2.5 text-sm text-slate-700">
                {insights.map((text) => (
                  <li key={text} className="flex gap-2.5">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
                    {text}
                  </li>
                ))}
              </ul>
            </Section>
          )}

          <div className="grid gap-6 lg:grid-cols-2">
            <Section icon={Globe2} title="Where visitors come from" description="The page or site that sent each visit.">
              <BarList rows={data.sources} total={totalViews} empty="No source data yet." />
            </Section>
            <Section icon={MapPin} title="Top cities" description="Approximate location of visitors.">
              <BarList rows={data.cities} total={totalViews} empty="No location data yet." />
            </Section>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <Section icon={Users} title="Visitors">
              <dl className="grid grid-cols-2 gap-3">
                {[
                  { label: "Registered patients", value: data.registeredVisitors },
                  { label: "Guests", value: data.guestVisitors },
                  { label: "Came back", value: data.returningVisitors, hint: "Visited on 2+ days" },
                  {
                    label: "First-time",
                    value: data.uniqueVisitors.value - data.returningVisitors,
                  },
                ].map((item) => (
                  <div key={item.label} className="rounded-xl bg-slate-50 px-3 py-2.5">
                    <dt className="text-xs text-slate-500">{item.label}</dt>
                    <dd className="mt-0.5 text-lg font-semibold text-slate-900">{formatNumber(item.value)}</dd>
                    {item.hint && <p className="text-[11px] text-slate-400">{item.hint}</p>}
                  </div>
                ))}
              </dl>
            </Section>
            <Section icon={Smartphone} title="Devices">
              <BarList rows={data.devices} total={totalViews} empty="No device data yet." />
            </Section>
            <Section icon={Clock} title="Busiest hours" description="Pakistan time">
              <HourChart hours={data.hours} />
            </Section>
          </div>

          <Section
            icon={Eye}
            title="Recent visitors"
            description="Visitors stay anonymous for privacy. You only see the names of patients who have already booked with you."
          >
            <ul className="divide-y divide-slate-100">
              {data.recentVisits.map((visit) => (
                <li key={visit.id} className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-sm font-medium text-slate-900">
                      {visit.visitorLabel}
                      {visit.isYourPatient && (
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                          Your patient
                        </span>
                      )}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {[visit.location, visit.device, visit.source].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-slate-400">{formatRelative(visit.visitedAt)}</span>
                </li>
              ))}
            </ul>
          </Section>
        </>
      )}
    </div>
  );
}
