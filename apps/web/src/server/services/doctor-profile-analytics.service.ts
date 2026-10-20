import {
  ActivityEventModel,
  AppointmentModel,
  DoctorProfileModel,
  UserModel,
  connectDatabase,
} from "@zindagi/database";
import { safeDisplayText } from "@/server/lib/decrypt-pii";
import { mongoFilter, mongoObjectIds } from "@/lib/mongo/query";
import { resolveDoctorSlug } from "@/server/services/doctor-slug.service";

const PAGE_VIEW_ACTION = "page.view";
const TIMEZONE = "Asia/Karachi";
const DAY_MS = 24 * 60 * 60 * 1000;
/** Hard ceiling on events scanned per request — far above any single profile's traffic. */
const MAX_EVENTS = 20_000;
const RECENT_VISITS_LIMIT = 25;

export const ANALYTICS_RANGES = [7, 30, 90] as const;
export type AnalyticsRangeDays = (typeof ANALYTICS_RANGES)[number];

export type TrafficSourceKey =
  | "google"
  | "search_other"
  | "facebook"
  | "instagram"
  | "whatsapp"
  | "social_other"
  | "share_link"
  | "direct"
  | "other_website"
  | "zc_listing"
  | "zc_specialty"
  | "zc_qa"
  | "zc_home"
  | "zc_other"
  | "unknown";

const SOURCE_LABELS: Record<TrafficSourceKey, string> = {
  google: "Google search",
  search_other: "Other search engines",
  facebook: "Facebook",
  instagram: "Instagram",
  whatsapp: "WhatsApp",
  social_other: "Other social media",
  share_link: "Your share link",
  direct: "Direct / typed link",
  other_website: "Other websites",
  zc_listing: "ZindagiCare doctor listing",
  zc_specialty: "ZindagiCare specialty & condition pages",
  zc_qa: "ZindagiCare health Q&A",
  zc_home: "ZindagiCare home page",
  zc_other: "Other ZindagiCare pages",
  unknown: "Not recorded (older visits)",
};

export type CountRow = { key: string; label: string; count: number };

export type DailyPoint = { date: string; views: number; visitors: number };

export type RecentVisit = {
  id: string;
  visitorLabel: string;
  isYourPatient: boolean;
  isRegistered: boolean;
  location: string | null;
  device: string | null;
  source: string;
  visitedAt: string;
};

export type MetricWithChange = { value: number; previous: number };

export type DoctorProfileAnalytics = {
  rangeDays: AnalyticsRangeDays;
  profilePath: string | null;
  views: MetricWithChange;
  uniqueVisitors: MetricWithChange;
  bookings: MetricWithChange;
  /** Bookings ÷ unique visitors in the range (0–1). */
  conversionRate: number;
  registeredVisitors: number;
  guestVisitors: number;
  returningVisitors: number;
  daily: DailyPoint[];
  sources: CountRow[];
  cities: CountRow[];
  devices: CountRow[];
  hours: { hour: number; count: number }[];
  weekdays: { day: string; count: number }[];
  recentVisits: RecentVisit[];
};

type ViewEvent = {
  _id: { toString(): string };
  userId?: { toString(): string } | null;
  visitorId?: string | null;
  ip?: string | null;
  city?: string | null;
  country?: string | null;
  metadata?: unknown;
  createdAt?: Date | null;
};

type ViewMetadata = {
  device?: string;
  entry?: string;
  referrer?: string;
  utmSource?: string;
  fromPath?: string;
};

function hostSource(value: string): TrafficSourceKey | null {
  const v = value.toLowerCase();
  if (v.includes("google")) return "google";
  if (/bing|yahoo|duckduckgo|yandex|ecosia|baidu/.test(v)) return "search_other";
  if (/facebook|fb\.com|fb\.me|messenger/.test(v)) return "facebook";
  if (v.includes("instagram")) return "instagram";
  if (/whatsapp|wa\.me/.test(v)) return "whatsapp";
  if (/(^|\.)t\.co$|twitter|(^|\.)x\.com$|linkedin|youtube|tiktok|snapchat|pinterest|reddit/.test(v)) {
    return "social_other";
  }
  return null;
}

function internalSource(fromPath: string): TrafficSourceKey {
  const p = fromPath.toLowerCase();
  if (p === "/") return "zc_home";
  if (p.startsWith("/doctors/specialty") || p.startsWith("/doctors/condition")) return "zc_specialty";
  if (p.startsWith("/questions")) return "zc_qa";
  if (p.startsWith("/doctors")) return "zc_listing";
  return "zc_other";
}

/** Exported for tests. */
export function classifySource(metadata: unknown): TrafficSourceKey {
  if (!metadata || typeof metadata !== "object") return "unknown";
  const meta = metadata as ViewMetadata;
  if (!meta.entry && !meta.fromPath && !meta.referrer && !meta.utmSource) {
    // Pre-source-tracking events only carried `device` (or nothing).
    return meta.device ? "zc_other" : "unknown";
  }

  if (meta.utmSource) {
    if (meta.utmSource === "share_link") return "share_link";
    return hostSource(meta.utmSource) ?? "other_website";
  }
  if (meta.entry) {
    if (!meta.referrer) return "direct";
    return hostSource(meta.referrer) ?? "other_website";
  }
  return meta.fromPath ? internalSource(meta.fromPath) : "zc_other";
}

const dayKeyFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const hourFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: TIMEZONE,
  hour: "2-digit",
  hourCycle: "h23",
});
const weekdayFormat = new Intl.DateTimeFormat("en-US", { timeZone: TIMEZONE, weekday: "short" });
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function actorKey(event: ViewEvent): string {
  if (event.userId) return `u:${event.userId.toString()}`;
  if (event.visitorId) return `v:${event.visitorId}`;
  if (event.ip) return `ip:${event.ip}`;
  return `e:${event._id.toString()}`;
}

function formatLocation(event: ViewEvent): string | null {
  return [event.city, event.country].filter(Boolean).join(", ") || null;
}

function formatDevice(device: string | undefined): string | null {
  if (device === "mobile") return "Mobile";
  if (device === "tablet") return "Tablet";
  if (device === "desktop") return "Desktop";
  return null;
}

function toCountRows(counts: Map<string, number>, label: (key: string) => string, limit?: number): CountRow[] {
  const rows = [...counts.entries()]
    .map(([key, count]) => ({ key, label: label(key), count }))
    .sort((a, b) => b.count - a.count);
  return limit ? rows.slice(0, limit) : rows;
}

/** "Ayesha K." — enough for a doctor to recognise their own patient without exposing a full name. */
function shortName(name: string | undefined): string | null {
  const parts = name?.trim().split(/\s+/).filter(Boolean) ?? [];
  if (!parts.length) return null;
  const [first, ...rest] = parts;
  const last = rest.at(-1);
  return last ? `${first} ${last[0]!.toUpperCase()}.` : first!;
}

function emptyAnalytics(rangeDays: AnalyticsRangeDays): DoctorProfileAnalytics {
  const zero = { value: 0, previous: 0 };
  return {
    rangeDays,
    profilePath: null,
    views: zero,
    uniqueVisitors: zero,
    bookings: zero,
    conversionRate: 0,
    registeredVisitors: 0,
    guestVisitors: 0,
    returningVisitors: 0,
    daily: [],
    sources: [],
    cities: [],
    devices: [],
    hours: Array.from({ length: 24 }, (_, hour) => ({ hour, count: 0 })),
    weekdays: WEEKDAYS.map((day) => ({ day, count: 0 })),
    recentVisits: [],
  };
}

/**
 * Traffic on a doctor's public profile (/doctors/<slug>), built from the
 * anonymous `page.view` beacons. Visitors are never named unless they are
 * already this doctor's patient — browsing a doctor is itself health data.
 */
export async function getDoctorProfileAnalytics(
  doctorUserId: string,
  rangeDays: AnalyticsRangeDays,
): Promise<DoctorProfileAnalytics> {
  await connectDatabase();

  const profile = await DoctorProfileModel.findOne(mongoFilter({ userId: doctorUserId }))
    .select("_id slug userId")
    .populate("userId", "name")
    .lean();
  if (!profile) return emptyAnalytics(rangeDays);

  const doctorName = safeDisplayText((profile.userId as { name?: string } | null)?.name);
  const currentSlug = resolveDoctorSlug(profile.slug as string | undefined, doctorName ?? "");
  // Views may have been recorded under the stored slug, the canonical one, or the raw id.
  const slugs = new Set(
    [profile.slug as string | undefined, currentSlug, profile._id.toString()]
      .filter((s): s is string => Boolean(s))
      .map((s) => s.toLowerCase()),
  );
  const paths = [...slugs].map((s) => `/doctors/${s}`);

  const now = new Date();
  const rangeStart = new Date(now.getTime() - rangeDays * DAY_MS);
  const previousStart = new Date(rangeStart.getTime() - rangeDays * DAY_MS);
  // The doctor checking their own profile is not traffic.
  const notSelf = { $nin: mongoObjectIds([doctorUserId]) };

  const viewFilter = (from: Date, to: Date) =>
    mongoFilter({
      action: PAGE_VIEW_ACTION,
      path: { $in: paths },
      userId: notSelf,
      createdAt: { $gte: from, $lt: to },
    });
  const bookingFilter = (from: Date, to: Date) =>
    mongoFilter({
      doctorId: profile._id,
      providerRole: { $in: ["doctor", null] },
      createdAt: { $gte: from, $lt: to },
    });

  const [events, previousEvents, bookings, previousBookings] = await Promise.all([
    ActivityEventModel.find(viewFilter(rangeStart, now))
      .select("userId visitorId ip city country metadata createdAt")
      .sort({ createdAt: -1 })
      .limit(MAX_EVENTS)
      .lean<ViewEvent[]>(),
    ActivityEventModel.find(viewFilter(previousStart, rangeStart))
      .select("userId visitorId ip")
      .limit(MAX_EVENTS)
      .lean<ViewEvent[]>(),
    AppointmentModel.countDocuments(bookingFilter(rangeStart, now)),
    AppointmentModel.countDocuments(bookingFilter(previousStart, rangeStart)),
  ]);

  // Daily buckets, oldest first, so the chart has a bar for every day — even quiet ones.
  const dailyViews = new Map<string, number>();
  const dailyActors = new Map<string, Set<string>>();
  for (let i = rangeDays - 1; i >= 0; i--) {
    const key = dayKeyFormat.format(new Date(now.getTime() - i * DAY_MS));
    dailyViews.set(key, 0);
    dailyActors.set(key, new Set());
  }

  const actorDays = new Map<string, Set<string>>();
  const sourceCounts = new Map<string, number>();
  const cityCounts = new Map<string, number>();
  const deviceCounts = new Map<string, number>();
  const hourCounts = new Array<number>(24).fill(0);
  const weekdayCounts = new Map<string, number>(WEEKDAYS.map((d) => [d, 0]));
  const registeredActors = new Set<string>();

  for (const event of events) {
    const at = event.createdAt ?? now;
    const key = actorKey(event);
    const day = dayKeyFormat.format(at);
    const meta = (event.metadata ?? {}) as ViewMetadata;

    if (dailyViews.has(day)) {
      dailyViews.set(day, dailyViews.get(day)! + 1);
      dailyActors.get(day)!.add(key);
    }
    if (!actorDays.has(key)) actorDays.set(key, new Set());
    actorDays.get(key)!.add(day);
    if (event.userId) registeredActors.add(key);

    const source = classifySource(event.metadata);
    sourceCounts.set(source, (sourceCounts.get(source) ?? 0) + 1);

    const city = event.city?.trim() || "Unknown";
    cityCounts.set(city, (cityCounts.get(city) ?? 0) + 1);

    const device = formatDevice(meta.device) ?? "Not recorded";
    deviceCounts.set(device, (deviceCounts.get(device) ?? 0) + 1);

    hourCounts[Number(hourFormat.format(at)) % 24]! += 1;
    const weekday = weekdayFormat.format(at);
    weekdayCounts.set(weekday, (weekdayCounts.get(weekday) ?? 0) + 1);
  }

  const uniqueVisitors = actorDays.size;
  const previousUnique = new Set(previousEvents.map(actorKey)).size;
  const returningVisitors = [...actorDays.values()].filter((days) => days.size > 1).length;

  // Visitors who already booked with this doctor (ever) may be shown by short name.
  const recentEvents = events.slice(0, RECENT_VISITS_LIMIT);
  const recentUserIds = [
    ...new Set(recentEvents.map((e) => e.userId?.toString()).filter(Boolean)),
  ] as string[];
  const patientIds = recentUserIds.length
    ? ((await AppointmentModel.distinct(
        "patientId",
        mongoFilter({ doctorId: profile._id, patientId: { $in: mongoObjectIds(recentUserIds) } }),
      )) as { toString(): string }[]).map((id) => id.toString())
    : [];
  const patientUsers = patientIds.length
    ? await UserModel.find(mongoFilter({ _id: { $in: mongoObjectIds(patientIds) } }))
        .select("name")
        .lean()
    : [];
  const patientNameById = new Map(
    patientUsers.map((u) => [u._id.toString(), shortName(safeDisplayText(u.name))]),
  );

  const recentVisits: RecentVisit[] = recentEvents.map((event) => {
    const userId = event.userId?.toString();
    const isYourPatient = Boolean(userId && patientNameById.has(userId));
    const visitorLabel = isYourPatient
      ? (patientNameById.get(userId!) ?? "Your patient")
      : userId
        ? "Registered patient"
        : "Guest visitor";
    return {
      id: event._id.toString(),
      visitorLabel,
      isYourPatient,
      isRegistered: Boolean(userId),
      location: formatLocation(event),
      device: formatDevice((event.metadata as ViewMetadata | undefined)?.device),
      source: SOURCE_LABELS[classifySource(event.metadata)],
      visitedAt: (event.createdAt ?? now).toISOString(),
    };
  });

  return {
    rangeDays,
    profilePath: currentSlug ? `/doctors/${currentSlug}` : null,
    views: { value: events.length, previous: previousEvents.length },
    uniqueVisitors: { value: uniqueVisitors, previous: previousUnique },
    bookings: { value: bookings, previous: previousBookings },
    conversionRate: uniqueVisitors ? Math.min(1, bookings / uniqueVisitors) : 0,
    registeredVisitors: registeredActors.size,
    guestVisitors: uniqueVisitors - registeredActors.size,
    returningVisitors,
    daily: [...dailyViews.entries()].map(([date, views]) => ({
      date,
      views,
      visitors: dailyActors.get(date)!.size,
    })),
    sources: toCountRows(sourceCounts, (k) => SOURCE_LABELS[k as TrafficSourceKey] ?? k),
    cities: toCountRows(cityCounts, (k) => k, 8),
    devices: toCountRows(deviceCounts, (k) => k),
    hours: hourCounts.map((count, hour) => ({ hour, count })),
    weekdays: WEEKDAYS.map((day) => ({ day, count: weekdayCounts.get(day) ?? 0 })),
    recentVisits,
  };
}

export function parseAnalyticsRange(value: string | undefined): AnalyticsRangeDays {
  const n = Number(value);
  return (ANALYTICS_RANGES as readonly number[]).includes(n) ? (n as AnalyticsRangeDays) : 30;
}
