import type { NursePortfolio } from "@/lib/nurses/portfolio";

export type AdminNurseVisitRow = {
  id: string;
  serviceType: string;
  status: string;
  scheduledAt: string;
  completedAt?: string;
  address: { line: string; city: string };
  patient: { id: string; name: string; phone?: string };
  pricing: { total: number; currency: string };
};

export type AdminNurseDetailDto = {
  id: string;
  userId: string;
  user: {
    id: string;
    name: string;
    email?: string;
    phone?: string;
    city: string;
    memberSince: string;
    avatarUrl?: string;
    isActive: boolean;
  };
  slug?: string;
  bio?: string;
  languages: string[];
  /** Public portfolio the nurse builds at /nurse/portfolio (read-only for admins). */
  portfolio: NursePortfolio;
  /** Effective revenue share (%) the nurse keeps. */
  commissionPercent: number;
  /** Per-nurse override; null means the platform default applies. */
  commissionOverride: number | null;
  verificationStatus: string;
  verificationSubmittedAt?: string;
  platformAgreementAcceptedAt?: string;
  verifiedAt?: string;
  rejectionReason?: string;
  adminNotes?: string;
  licenseNumber?: string;
  qualification?: string;
  experienceYears?: number;
  specialties?: string[];
  cnicLast4?: string;
  isAvailable: boolean;
  homeVisitEnabled: boolean;
  employeeCode?: string;
  serviceArea: { city: string; area?: string; radiusKm: number };
  documents: { label: string; url: string }[];
  stats: {
    activeVisits: number;
    completedTotal: number;
    completedThisMonth: number;
    totalEarnings: number;
    earningsThisMonth: number;
  };
  visitHistory: AdminNurseVisitRow[];
};

export type AdminNurseManageStats = {
  activeVisits: number;
  upcomingToday: number;
  completedTotal: number;
  completedThisMonth: number;
  totalEarnings: number;
  earningsThisMonth: number;
};

/** Row in the admin nurse management directory. */
export type AdminNurseManageRow = {
  id: string;
  userId: string;
  name: string;
  email?: string;
  phone?: string;
  avatarUrl?: string;
  slug?: string;
  city: string;
  area?: string;
  licenseNumber?: string;
  qualification?: string;
  experienceYears?: number;
  gender?: "male" | "female";
  specialties: string[];
  verificationStatus: string;
  rejectionReason?: string;
  isActive: boolean;
  isAvailable: boolean;
  homeVisitEnabled: boolean;
  commissionPercent: number;
  /** Per-nurse revenue-share % override; null means the standard 70/30 split. */
  commissionOverride: number | null;
  stats: AdminNurseManageStats;
  createdAt: string;
};
