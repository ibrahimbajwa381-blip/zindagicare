import {
  CalendarClock,
  Gift,
  LayoutDashboard,
  MessageSquare,
  UserCog,
  Users,
  Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { NutritionistDashboardSummary } from "@/server/services/nutritionist-dashboard.service";

export type NutritionistNavBadgeKey = "messages" | "pendingRequests";

export type NutritionistWorkspaceNavItem = {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
  exact?: boolean;
  badgeKey?: NutritionistNavBadgeKey;
};

export type NutritionistWorkspaceNavSection = {
  title: string;
  items: NutritionistWorkspaceNavItem[];
};

/** Video-consult only — no home visits, urgent calls, or Sunday queue. */
export const NUTRITIONIST_WORKSPACE_ACTIONS: NutritionistWorkspaceNavItem[] = [
  {
    href: "/nutritionist/messages",
    label: "Patient messages",
    description: "Chat after paid consultations",
    icon: MessageSquare,
    badgeKey: "messages",
  },
  {
    href: "/nutritionist/patients",
    label: "My patients",
    description: "Patients you have consulted",
    icon: Users,
  },
  {
    href: "/nutritionist/requests",
    label: "Consult requests",
    description: "Online video appointments",
    icon: CalendarClock,
    badgeKey: "pendingRequests",
  },
];

/** Quick actions on the overview dashboard (excludes messages). */
export const NUTRITIONIST_OVERVIEW_ACTIONS = NUTRITIONIST_WORKSPACE_ACTIONS.filter(
  (item) => item.href !== "/nutritionist/messages",
);

export const NUTRITIONIST_APPROVED_NAV_SECTIONS: NutritionistWorkspaceNavSection[] = [
  {
    title: "Profile",
    items: [
      {
        href: "/nutritionist/profile",
        label: "Overview",
        description: "Your workspace dashboard",
        icon: LayoutDashboard,
        exact: true,
      },
      {
        href: "/nutritionist/profile/edit",
        label: "Edit profile",
        description: "Bio, fee, schedule & locations",
        icon: UserCog,
      },
      {
        href: "/nutritionist/earnings",
        label: "Earnings",
        description: "Paid video consult revenue",
        icon: Wallet,
      },
      {
        href: "/nutritionist/referrals",
        label: "Referrals",
        description: "Invite patients & earn a bigger share",
        icon: Gift,
      },
    ],
  },
  {
    title: "Practice",
    items: NUTRITIONIST_WORKSPACE_ACTIONS,
  },
];

export const NUTRITIONIST_ONBOARDING_NAV_SECTIONS: NutritionistWorkspaceNavSection[] = [
  {
    title: "Onboarding",
    items: [
      {
        href: "/nutritionist/profile",
        label: "Overview",
        description: "Application status",
        icon: LayoutDashboard,
        exact: true,
      },
      {
        href: "/nutritionist/profile/edit",
        label: "Edit profile",
        description: "Update details while awaiting approval",
        icon: UserCog,
      },
    ],
  },
];

export type NutritionistNavStats = {
  unreadMessages: number;
  pendingRequests: number;
};

export function nutritionistNavBadgeCount(
  item: NutritionistWorkspaceNavItem,
  stats: NutritionistNavStats,
): number | null {
  if (!item.badgeKey) return null;

  switch (item.badgeKey) {
    case "messages":
      return stats.unreadMessages > 0 ? stats.unreadMessages : null;
    case "pendingRequests":
      return stats.pendingRequests > 0 ? stats.pendingRequests : null;
    default:
      return null;
  }
}

export function summaryToNavStats(
  summary: NutritionistDashboardSummary,
  unreadMessages = 0,
): NutritionistNavStats {
  return {
    unreadMessages,
    pendingRequests: summary.pendingRequests,
  };
}
