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
import type { HerbalistDashboardSummary } from "@/server/services/herbalist-dashboard.service";

export type HerbalistNavBadgeKey = "messages" | "pendingRequests";

export type HerbalistWorkspaceNavItem = {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
  exact?: boolean;
  badgeKey?: HerbalistNavBadgeKey;
};

export type HerbalistWorkspaceNavSection = {
  title: string;
  items: HerbalistWorkspaceNavItem[];
};

/** Video-consult only — no home visits, urgent calls, or Sunday queue. */
export const HERBALIST_WORKSPACE_ACTIONS: HerbalistWorkspaceNavItem[] = [
  {
    href: "/herbalist/messages",
    label: "Patient messages",
    description: "Chat after paid consultations",
    icon: MessageSquare,
    badgeKey: "messages",
  },
  {
    href: "/herbalist/patients",
    label: "My patients",
    description: "Patients you have consulted",
    icon: Users,
  },
  {
    href: "/herbalist/requests",
    label: "Consult requests",
    description: "Online video appointments",
    icon: CalendarClock,
    badgeKey: "pendingRequests",
  },
];

/** Quick actions on the overview dashboard (excludes messages). */
export const HERBALIST_OVERVIEW_ACTIONS = HERBALIST_WORKSPACE_ACTIONS.filter(
  (item) => item.href !== "/herbalist/messages",
);

export const HERBALIST_APPROVED_NAV_SECTIONS: HerbalistWorkspaceNavSection[] = [
  {
    title: "Profile",
    items: [
      {
        href: "/herbalist/profile",
        label: "Overview",
        description: "Your workspace dashboard",
        icon: LayoutDashboard,
        exact: true,
      },
      {
        href: "/herbalist/profile/edit",
        label: "Edit profile",
        description: "Bio, fee, schedule & locations",
        icon: UserCog,
      },
      {
        href: "/herbalist/earnings",
        label: "Earnings",
        description: "Paid video consult revenue",
        icon: Wallet,
      },
      {
        href: "/herbalist/referrals",
        label: "Referrals",
        description: "Invite patients & earn a bigger share",
        icon: Gift,
      },
    ],
  },
  {
    title: "Practice",
    items: HERBALIST_WORKSPACE_ACTIONS,
  },
];

export const HERBALIST_ONBOARDING_NAV_SECTIONS: HerbalistWorkspaceNavSection[] = [
  {
    title: "Onboarding",
    items: [
      {
        href: "/herbalist/profile",
        label: "Overview",
        description: "Application status",
        icon: LayoutDashboard,
        exact: true,
      },
      {
        href: "/herbalist/profile/edit",
        label: "Edit profile",
        description: "Update details while awaiting approval",
        icon: UserCog,
      },
    ],
  },
];

export type HerbalistNavStats = {
  unreadMessages: number;
  pendingRequests: number;
};

export function herbalistNavBadgeCount(
  item: HerbalistWorkspaceNavItem,
  stats: HerbalistNavStats,
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
  summary: HerbalistDashboardSummary,
  unreadMessages = 0,
): HerbalistNavStats {
  return {
    unreadMessages,
    pendingRequests: summary.pendingRequests,
  };
}
