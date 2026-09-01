import { apiFetch } from "./client";
import { getStoredTokens } from "@/lib/token-storage";
import { API_URL } from "@/lib/config";

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

export type DoctorEarningRow = {
  id: string;
  type: string;
  completedAt: string;
  amount: number;
  grossAmount: number;
  commissionAmount: number;
  commissionPercent: number;
  currency: string;
  patient: { id: string; name: string };
  isReferralBonus: boolean;
};

export type DoctorConsultCounts = {
  online: number;
  clinic: number;
  urgent: number;
  homeVisit: number;
  total: number;
};

export type DoctorWithdrawalRow = {
  id: string;
  amount: number;
  currency: string;
  status: "pending" | "processing" | "completed" | "failed";
  requestedAt: string;
  completedAt?: string;
  receiptUrl?: string;
};

export type DoctorEarningsDetail = {
  totalGrossRevenue: number;
  grossRevenueThisMonth: number;
  totalEarnings: number;
  earningsThisMonth: number;
  totalPlatformCommission: number;
  platformCommissionThisMonth: number;
  referralBonusEarnings: number;
  referralBonusEarningsThisMonth: number;
  completedPaidConsults: number;
  completedConsults: DoctorConsultCounts;
  completedConsultsThisMonth: DoctorConsultCounts;
  onlineCommissionPercent: number;
  homeVisitCommissionPercent: number;
  availableBalance: number;
  totalWithdrawn: number;
  pendingWithdrawal: number;
  withdrawals: DoctorWithdrawalRow[];
  transactions: DoctorEarningRow[];
};

export function getDoctorEarnings() {
  return apiFetch<DoctorEarningsDetail>("/api/v1/doctor/earnings");
}

export type DoctorBankAccount = {
  accountTitle?: string;
  accountNumber?: string;
  bankName?: string;
  iban?: string;
};

export function getDoctorBankAccount() {
  return apiFetch<{ bankAccount: DoctorBankAccount | null }>("/api/v1/doctor/bank-account");
}

export function updateDoctorBankAccount(input: DoctorBankAccount) {
  return apiFetch<{ bankAccount: DoctorBankAccount }>("/api/v1/doctor/bank-account", {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export type DoctorPatientLastOutcome =
  | "completed"
  | "missed"
  | "cancelled"
  | "upcoming"
  | "in_progress"
  | "pending";

export type DoctorPatientRow = {
  id: string;
  name: string;
  phone?: string;
  lastVisitAt?: string;
  lastVisitEndAt?: string;
  lastVisitType?: string;
  lastVisitStatus?: string;
  lastOutcome: DoctorPatientLastOutcome;
  appointmentCount: number;
  completedCount: number;
  missedCount: number;
  cancelledCount: number;
  upcomingCount: number;
  prescriptionCount: number;
  review?: { rating: number; comment?: string; createdAt: string };
};

export function listDoctorPatients() {
  return apiFetch<DoctorPatientRow[]>("/api/v1/doctor/patients");
}

export type ReferredPatientRow = {
  id: string;
  name: string;
  joinedAt: string;
};

export type DoctorReferralSummary = {
  referredPatientCount: number;
  lifetimeBonusEarnings: number;
  referredPatients: ReferredPatientRow[];
};

export function getDoctorReferral() {
  return apiFetch<{ referral: { code: string; url: string }; summary: DoctorReferralSummary }>(
    "/api/v1/doctor/referral",
  );
}

export function regenerateDoctorReferralCode() {
  return apiFetch<{ referral: { code: string; url: string } }>("/api/v1/doctor/referral", {
    method: "POST",
  });
}

export type DoctorPrescriptionSummary = {
  id: string;
  appointmentId?: string;
  doctorName: string;
  patientName: string;
  issuedAt: string;
  medicationCount: number;
  downloadUrl: string;
};

export function listDoctorPrescriptions() {
  return apiFetch<DoctorPrescriptionSummary[]>("/api/v1/doctor/prescriptions");
}

export type DoctorPrescriptionContext = {
  appointmentId: string;
  appointmentType: string;
  scheduledStart: string;
  patientName: string;
  patientPhone?: string;
  status: string;
  canIssue: boolean;
  existingPrescription?: { id: string; downloadUrl: string };
};

export function getDoctorPrescriptionContext(appointmentId: string) {
  return apiFetch<DoctorPrescriptionContext>(`/api/v1/doctor/prescriptions/context/${appointmentId}`);
}

export type CreatePrescriptionInput = {
  appointmentId: string;
  medications: { name: string; dosage: string; frequency: string; duration: string }[];
  notes?: string;
};

export type DoctorPrescriptionDetail = DoctorPrescriptionSummary & {
  medications: { name: string; dosage: string; frequency: string; duration: string }[];
  notes?: string;
};

export function createDoctorPrescription(input: CreatePrescriptionInput) {
  return apiFetch<DoctorPrescriptionDetail>("/api/v1/doctor/prescriptions", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/* ---------------------------- Verification ---------------------------- */

export type StoredDoctorDocument = {
  storageKey: string;
  url: string;
  originalName?: string;
};

export async function uploadDoctorDocument(file: { uri: string; name: string; type: string }) {
  const { accessToken } = await getStoredTokens();
  const formData = new FormData();
  formData.append("file", file as unknown as Blob);

  const res = await fetch(`${API_URL}/api/v1/doctor/verification/upload`, {
    method: "POST",
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
    body: formData,
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error?.message ?? "Upload failed");
  return json.data as StoredDoctorDocument;
}

export type SubmitDoctorVerificationInput = {
  pmdcNumber: string;
  cnic: string;
  medicalDegree: string;
  qualifications?: string[];
  medicalCollege: string;
  graduationYear: number;
  experienceYears: number;
  avatarUrl: string;
  bio?: string;
  consultationFee?: number;
  hospitals: Array<{ name: string; city: string; address?: string }>;
  homeVisit: { enabled: boolean; area?: string; geo?: { lng: number; lat: number } };
  documentUrls: {
    pmdcCertificate: string;
    cnicFront: string;
    cnicBack: string;
    degreeCertificate: string;
  };
  weeklyAvailability: WeeklyAvailabilityDto[];
  sundayConsult?: {
    enabled: boolean;
    startTimeLocal?: string;
    endTimeLocal?: string;
    slotDurationMins?: number;
  };
};

export function submitDoctorVerification(input: SubmitDoctorVerificationInput) {
  return apiFetch<{ id: string; verificationStatus: string; submittedAt?: string }>(
    "/api/v1/doctor/verification/submit",
    { method: "POST", body: JSON.stringify(input) },
  );
}

/* ----------------------------- Urgent calls ----------------------------- */

export type DoctorUrgentCall = {
  requestId: string;
  patientId: string;
  patientName: string;
  patientPhone: string;
  patientNotes?: string;
  status: string;
  createdAt: string;
  assignedAt?: string;
  appointmentId?: string;
  scheduledStart?: string;
  scheduledEnd?: string;
  feePkr?: number;
};

export function listDoctorUrgentCalls() {
  return apiFetch<DoctorUrgentCall[]>("/api/v1/doctor/urgent-calls");
}

export function completeDoctorUrgentCall(requestId: string) {
  return apiFetch<{ status: string }>(`/api/v1/doctor/urgent-calls/${requestId}/complete`, {
    method: "PATCH",
  });
}

/* ---------------------------- Sunday consult ---------------------------- */

export type SundayQueueAppointment = {
  _id: string;
  scheduledStart: string;
  scheduledEnd: string;
  status: string;
  patientId?: { name?: string; phone?: string };
  patientNotes?: string;
};

export type SundayDoctorQueue = {
  instance: { slots?: unknown[] } | null;
  appointments: SundayQueueAppointment[];
  slots: unknown[];
};

export function getSundayDoctorQueue(date?: string) {
  const qs = date ? `?date=${encodeURIComponent(date)}` : "";
  return apiFetch<SundayDoctorQueue>(`/api/v1/sunday/doctor/queue${qs}`);
}

export function toggleSundayConsult(enabled: boolean) {
  return apiFetch<{ sundayConsultEnabled: boolean }>("/api/v1/sunday/doctor/toggle", {
    method: "PATCH",
    body: JSON.stringify({ enabled }),
  });
}

export type SundayTemplateInput = {
  startTimeLocal: string;
  endTimeLocal: string;
  slotDurationMins: number;
  maxSlots: number;
  isActive: boolean;
};

export function upsertSundayTemplate(input: SundayTemplateInput) {
  return apiFetch<SundayTemplateInput>("/api/v1/sunday/doctor/template", {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export function updateSundayAppointmentStatus(
  appointmentId: string,
  status: "completed" | "no_show" | "cancelled",
  doctorNotes?: string,
) {
  return apiFetch<{ status: string }>("/api/v1/sunday/doctor/appointment-status", {
    method: "PATCH",
    body: JSON.stringify({ appointmentId, status, doctorNotes }),
  });
}

/* ----------------------------- Home visits ----------------------------- */

export type DoctorHomeVisit = {
  id: string;
  serviceType: string;
  status: "requested" | "assigned" | "en_route" | "arrived" | "completed" | "cancelled";
  scheduledAt: string;
  address: { line: string; city: string; geo: { lng: number; lat: number } };
  pricing: { base: number; surge: number; distance: number; total: number; currency: string };
  patientNotes?: string;
  patient?: { id: string; name: string; phone?: string };
  cancellationReason?: string;
};

export function listDoctorHomeVisits(scope: "assigned" | "assigned-history" = "assigned") {
  return apiFetch<DoctorHomeVisit[]>(`/api/v1/home-visits?scope=${scope}`);
}

export function updateDoctorHomeVisitStatus(
  id: string,
  status: "en_route" | "arrived" | "completed" | "cancelled",
  input?: { staffNotes?: string; cancellationReason?: string },
) {
  return apiFetch<DoctorHomeVisit>(`/api/v1/home-visits/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status, ...input }),
  });
}

/* -------------------------------- Intake -------------------------------- */

export type IntakeQuestion = {
  key: string;
  text: string;
  answer?: string;
  answeredAt?: string;
};

export type MedicalIntake = {
  id: string;
  appointmentId: string;
  status: string;
  locale: string;
  questions: IntakeQuestion[];
  completedAt?: string;
};

export function getAppointmentIntakeForDoctor(appointmentId: string) {
  return apiFetch<MedicalIntake | null>(`/api/v1/doctor/intake/${appointmentId}`);
}
