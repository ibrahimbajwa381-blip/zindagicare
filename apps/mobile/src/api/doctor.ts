import { apiFetch } from "./client";

export type DoctorDashboardSummary = {
  patients: number;
  pendingRequests: number;
  sundayQueue: number;
  homeVisitRequests: number;
  urgentCalls: number;
  totalEarnings: number;
  earningsThisMonth: number;
  availableBalance: number;
  ratingAvg: number;
  ratingCount: number;
  completedThisMonth: number;
  completedAllTime: number;
  todayAppointments: number;
  upcomingThisWeek: number;
  completionRate: number;
  prescriptionsWritten: number;
  returningPatients: number;
};

export function getDoctorSummary() {
  return apiFetch<DoctorDashboardSummary>("/api/v1/doctor/summary");
}

export type DoctorRequestOutcome =
  | "completed"
  | "missed"
  | "cancelled"
  | "upcoming"
  | "in_progress"
  | "pending";

export type DoctorRequestRow = {
  id: string;
  type: string;
  status: string;
  outcome: DoctorRequestOutcome;
  scheduledStart: string;
  scheduledEnd: string;
  consultationFee?: number;
  patient: { id: string; name: string; phone?: string };
  patientNotes?: string;
  canJoin: boolean;
  hasPrescription: boolean;
  review?: {
    rating: number;
    comment?: string;
  };
};

export function listDoctorRequests() {
  return apiFetch<DoctorRequestRow[]>("/api/v1/doctor/requests");
}

export type WeeklyAvailabilityDto = {
  dayOfWeek: number;
  startTimeLocal: string;
  endTimeLocal: string;
};

export type SundayConsultDto = {
  enabled: boolean;
  startTimeLocal?: string;
  endTimeLocal?: string;
  slotDurationMins: number;
  maxSlots?: number;
};

export type DoctorHomeVisitDto = {
  enabled: boolean;
  area?: string;
  geo?: { lng: number; lat: number };
};

export type DoctorProfileDto = {
  id: string;
  user: {
    id: string;
    name: string;
    email?: string;
    phone?: string;
    avatarUrl?: string;
    memberSince: string;
  };
  pmdcNumber?: string;
  pmdcVerified: boolean;
  cnicLast4?: string;
  medicalDegree?: string;
  qualifications: string[];
  medicalCollege?: string;
  graduationYear?: number;
  experienceYears: number;
  primarySpecialty?: string;
  additionalSpecialties: string[];
  specialties: string[];
  bio?: string;
  languages: string[];
  hospitals: Array<{ name: string; city: string; address?: string }>;
  consultationFee: number;
  weeklyAvailability: WeeklyAvailabilityDto[];
  sundayConsult: SundayConsultDto;
  homeVisit: DoctorHomeVisitDto;
  verificationStatus: string;
  verificationSubmittedAt?: string;
  platformAgreementAcceptedAt?: string;
  rejectionReason?: string;
  isListed: boolean;
  slug?: string;
  verifiedAt?: string;
  documents: {
    pmdcCertificate?: string;
    cnicFront?: string;
    cnicBack?: string;
    degreeCertificate?: string;
  };
};

export function getDoctorProfile() {
  return apiFetch<DoctorProfileDto>("/api/v1/doctor/profile");
}

export type UpdateDoctorProfileInput = Partial<{
  name: string;
  phone: string;
  avatarUrl: string;
  bio: string | null;
  consultationFee: number;
  languages: string[];
  hospitals: Array<{ name: string; city: string; address?: string }>;
  weeklyAvailability: WeeklyAvailabilityDto[];
  sundayConsult: {
    enabled: boolean;
    startTimeLocal?: string;
    endTimeLocal?: string;
    slotDurationMins?: number;
  };
}>;

export function updateDoctorProfile(input: UpdateDoctorProfileInput) {
  return apiFetch<DoctorProfileDto>("/api/v1/doctor/profile", {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}
