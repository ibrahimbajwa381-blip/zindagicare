import {
  CalendarClock,
  FileText,
  Home,
  LayoutDashboard,
  MessageSquare,
  Sun,
  UserCog,
  Users,
  Wallet,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { DoctorDashboardSummary } from "@/server/services/doctor-dashboard.service";

export type DoctorNavBadgeKey =
  | "messages"
  | "pendingRequests"
  | "sundayQueue"
  | "homeVisits"
  | "urgentCalls";

export type DoctorWorkspaceNavItem = {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
  exact?: boolean;
  badgeKey?: DoctorNavBadgeKey;
};

export type DoctorWorkspaceNavSection = {
  title: string;
  items: DoctorWorkspaceNavItem[];
};

export const DOCTOR_WORKSPACE_ACTIONS: DoctorWorkspaceNavItem[] = [
  {
    href: "/doctor/messages",
    label: "Patient messages",
    description: "Chat after paid consultations",
    icon: MessageSquare,
    badgeKey: "messages",
  },
  {
    href: "/doctor/patients",
    label: "My patients",
    description: "Patients you have consulted",
    icon: Users,
  },
  {
    href: "/doctor/requests",
    label: "Consult requests",
    description: "Online & clinic appointments",
    icon: CalendarClock,
    badgeKey: "pendingRequests",
  },
  {
    href: "/doctor/urgent-calls",
    label: "Urgent care",
    description: "Urgent video consults assigned to you",
    icon: Zap,
    badgeKey: "urgentCalls",
  },
  {
    href: "/doctor/prescriptions",
    label: "Prescriptions",
    description: "Digital prescriptions issued to patients",
    icon: FileText,
  },
  {
    href: "/doctor/sunday-consult",
    label: "Free Sunday consult",
    description: "Free consult queue this Sunday",
    icon: Sun,
    badgeKey: "sundayQueue",
  },
  {
    href: "/doctor/home-visits",
    label: "Home visits",
    description: "In-house doctor visits assigned to you",
    icon: Home,
    badgeKey: "homeVisits",
  },
];

/** Quick actions on the overview dashboard (excludes messages). */
export const DOCTOR_OVERVIEW_ACTIONS = DOCTOR_WORKSPACE_ACTIONS.filter(
  (item) => item.href !== "/doctor/messages",
);

export const DOCTOR_APPROVED_NAV_SECTIONS: DoctorWorkspaceNavSection[] = [
  {
    title: "Profile",
    items: [
      {
        href: "/doctor/profile",
        label: "Overview",
        description: "Your workspace dashboard",
        icon: LayoutDashboard,
        exact: true,
      },
      {
        href: "/doctor/profile/edit",
        label: "Edit profile",
        description: "Bio, fee, schedule & locations",
        icon: UserCog,
      },
      {
        href: "/doctor/earnings",
        label: "Earnings",
        description: "Paid consult & home visit revenue",
        icon: Wallet,
      },
    ],
  },
  {
    title: "Practice",
    items: DOCTOR_WORKSPACE_ACTIONS,
  },
];

export const DOCTOR_ONBOARDING_NAV_SECTIONS: DoctorWorkspaceNavSection[] = [
  {
    title: "Onboarding",
    items: [
      {
        href: "/doctor/profile",
        label: "Overview",
        description: "Application status",
        icon: LayoutDashboard,
        exact: true,
      },
      {
        href: "/doctor/profile/edit",
        label: "Edit profile",
        description: "Update details while awaiting approval",
        icon: UserCog,
      },
    ],
  },
];

export type DoctorNavStats = {
  unreadMessages: number;
  pendingRequests: number;
  sundayQueue: number;
  homeVisits: number;
  urgentCalls: number;
};

export function doctorNavBadgeCount(
  item: DoctorWorkspaceNavItem,
  stats: DoctorNavStats,
): number | null {
  if (!item.badgeKey) return null;

  switch (item.badgeKey) {
    case "messages":
      return stats.unreadMessages > 0 ? stats.unreadMessages : null;
    case "pendingRequests":
      return stats.pendingRequests > 0 ? stats.pendingRequests : null;
    case "sundayQueue":
      return stats.sundayQueue > 0 ? stats.sundayQueue : null;
    case "homeVisits":
      return stats.homeVisits > 0 ? stats.homeVisits : null;
    case "urgentCalls":
      return stats.urgentCalls > 0 ? stats.urgentCalls : null;
    default:
      return null;
  }
}

export function summaryToNavStats(
  summary: DoctorDashboardSummary,
  unreadMessages = 0,
): DoctorNavStats {
  return {
    unreadMessages,
    pendingRequests: summary.pendingRequests,
    sundayQueue: summary.sundayQueue,
    homeVisits: summary.homeVisitRequests,
    urgentCalls: summary.urgentCalls,
  };
}
