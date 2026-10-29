/** Client-safe constants and types for the admin Planning board. */

import {
  PARTNER_STAGES,
  PARTNER_TYPES,
  PLANNING_KINDS,
  PLANNING_PRIORITIES,
  PLANNING_STATUSES,
} from "@zindagi/validators";

export { PARTNER_STAGES, PARTNER_TYPES, PLANNING_KINDS, PLANNING_PRIORITIES, PLANNING_STATUSES };

export type PlanningKind = (typeof PLANNING_KINDS)[number];
export type PlanningStatus = (typeof PLANNING_STATUSES)[number];
export type PlanningPriority = (typeof PLANNING_PRIORITIES)[number];
export type PartnerType = (typeof PARTNER_TYPES)[number];
export type PartnerStage = (typeof PARTNER_STAGES)[number];

export const KIND_LABELS: Record<PlanningKind, { singular: string; plural: string; hint: string }> = {
  plan: {
    singular: "Plan",
    plural: "Plans & initiatives",
    hint: "Strategic plans, launches and projects — nationwide or for a city",
  },
  target: {
    singular: "Target",
    plural: "Targets",
    hint: "Monthly numbers to hit — overall or per city",
  },
  partnership: {
    singular: "Partnership",
    plural: "Partnerships",
    hint: "Hospitals, clinics, labs and other collaborations",
  },
  achievement: {
    singular: "Achievement",
    plural: "Achievements",
    hint: "Milestones and wins worth remembering",
  },
  campaign: {
    singular: "Campaign",
    plural: "Campaigns",
    hint: "Marketing, outreach and awareness activities",
  },
  challenge: {
    singular: "Challenge",
    plural: "Challenges",
    hint: "Problems, risks and blockers to fix",
  },
};

export const STATUS_LABELS: Record<PlanningStatus, string> = {
  planned: "Planned",
  in_progress: "In progress",
  on_hold: "On hold",
  done: "Done",
  cancelled: "Cancelled",
};

export const PRIORITY_LABELS: Record<PlanningPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

export const PARTNER_TYPE_LABELS: Record<PartnerType, string> = {
  hospital: "Hospital",
  clinic: "Clinic",
  lab: "Laboratory",
  pharmacy: "Pharmacy",
  university: "Medical college / university",
  ngo: "NGO / trust",
  corporate: "Corporate",
  other: "Other",
};

export const PARTNER_STAGE_LABELS: Record<PartnerStage, string> = {
  prospect: "Prospect",
  contacted: "Contacted",
  negotiating: "Negotiating",
  signed: "Signed (MoU)",
  active: "Active",
  ended: "Ended",
};

/** Metrics offered when adding a target; free text is allowed too. */
export const SUGGESTED_TARGET_METRICS = [
  "New patients",
  "New doctors onboarded",
  "New nurses / physios onboarded",
  "Completed consultations",
  "Home visits",
  "Revenue (PKR)",
  "Platform commission (PKR)",
  "Hospital partnerships",
  "App downloads",
  "Social media followers",
  "Patient reviews",
];

export type PlanningItemRow = {
  id: string;
  kind: PlanningKind;
  title: string;
  description?: string;
  city?: string;
  status: PlanningStatus;
  priority: PlanningPriority;
  owner?: string;
  startDate?: string;
  dueDate?: string;
  month?: string;
  metric?: string;
  unit?: string;
  targetValue?: number;
  currentValue?: number;
  partnerType?: PartnerType;
  stage?: PartnerStage;
  contactName?: string;
  contactPhone?: string;
  achievedAt?: string;
  budget?: number;
  createdByName: string;
  updatedAt: string;
};

/** Real platform numbers for one month, to compare targets against. */
export type PlanningLiveMonth = {
  month: string;
  newPatients: number;
  newProviders: number;
  completedConsults: number;
  /** Sign-ups split by the account's city (consults have no reliable city — most are online). */
  byCity: { city: string; newPatients: number; newProviders: number }[];
};

export type PlanningBoard = {
  items: PlanningItemRow[];
  live: PlanningLiveMonth;
};

/** Current month in Pakistan time, as YYYY-MM. */
export function currentMonthKey(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Karachi" }).slice(0, 7);
}

export function formatMonthKey(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y!, (m ?? 1) - 1, 15)).toLocaleDateString("en-PK", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** 0–100 progress of a target, or null when it has no target value. */
export function targetProgress(item: Pick<PlanningItemRow, "targetValue" | "currentValue">) {
  if (!item.targetValue) return null;
  return Math.min(100, Math.round(((item.currentValue ?? 0) / item.targetValue) * 100));
}

function formatDayKey(key: string): string {
  return new Date(`${key}T12:00:00+05:00`).toLocaleDateString("en-PK", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Karachi",
  });
}

const COPY_ORDER: PlanningKind[] = [
  "target",
  "plan",
  "partnership",
  "campaign",
  "achievement",
  "challenge",
];

/**
 * The whole board as plain text, for pasting into WhatsApp, email or a doc.
 * Every entry is included regardless of the filters on screen.
 */
export function planningBoardToText(board: PlanningBoard, copiedOn = new Date()): string {
  const lines: string[] = [
    "ZindagiCare — Planning & growth",
    `Copied ${copiedOn.toLocaleDateString("en-PK", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "Asia/Karachi",
    })}`,
    "",
    `LIVE ON THE PLATFORM · ${formatMonthKey(board.live.month)}`,
    `- New patients: ${board.live.newPatients.toLocaleString("en-PK")}`,
    `- New providers: ${board.live.newProviders.toLocaleString("en-PK")}`,
    `- Completed consults: ${board.live.completedConsults.toLocaleString("en-PK")}`,
  ];
  for (const row of board.live.byCity) {
    lines.push(`  · ${row.city}: ${row.newPatients} patients, ${row.newProviders} providers`);
  }

  for (const kind of COPY_ORDER) {
    const items = board.items
      .filter((i) => i.kind === kind)
      .sort((a, b) => {
        if (kind === "target") return (b.month ?? "").localeCompare(a.month ?? "");
        if (kind === "achievement") return (b.achievedAt ?? "").localeCompare(a.achievedAt ?? "");
        return (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999");
      });
    lines.push("", `${KIND_LABELS[kind].plural.toUpperCase()} (${items.length})`);
    if (items.length === 0) {
      lines.push("- None yet");
      continue;
    }

    for (const item of items) {
      const details: string[] = [];
      if (kind === "target") {
        const progress = targetProgress(item);
        details.push(
          `${(item.currentValue ?? 0).toLocaleString("en-PK")}/${(item.targetValue ?? 0).toLocaleString("en-PK")}${item.unit ? ` ${item.unit}` : ""}${progress !== null ? ` (${progress}%)` : ""}`,
        );
        if (item.metric) details.push(item.metric);
      }
      if (kind === "partnership") {
        if (item.partnerType) details.push(PARTNER_TYPE_LABELS[item.partnerType]);
        if (item.stage) details.push(PARTNER_STAGE_LABELS[item.stage]);
      }
      details.push(item.city ?? "Nationwide");
      if (kind !== "achievement") {
        details.push(STATUS_LABELS[item.status], `${PRIORITY_LABELS[item.priority]} priority`);
      }
      if (item.startDate) details.push(`Starts ${formatDayKey(item.startDate)}`);
      if (item.dueDate) details.push(`Due ${formatDayKey(item.dueDate)}`);
      if (item.budget != null) details.push(`Budget PKR ${item.budget.toLocaleString("en-PK")}`);
      if (item.owner) details.push(`Owner: ${item.owner}`);
      if (item.contactName || item.contactPhone) {
        details.push(`Contact: ${[item.contactName, item.contactPhone].filter(Boolean).join(", ")}`);
      }

      const prefix =
        kind === "target" && item.month
          ? `[${formatMonthKey(item.month)}] `
          : kind === "achievement" && item.achievedAt
            ? `${formatDayKey(item.achievedAt)} — `
            : "";
      lines.push(`- ${prefix}${item.title} — ${details.join(" · ")}`);
      if (item.description) {
        for (const noteLine of item.description.split("\n")) {
          if (noteLine.trim()) lines.push(`    ${noteLine.trim()}`);
        }
      }
    }
  }

  return lines.join("\n");
}
