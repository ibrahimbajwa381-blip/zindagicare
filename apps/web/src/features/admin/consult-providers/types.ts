/**
 * Client-side DTOs for the consult-provider admin screens. They mirror the
 * shapes returned by the herbalist / nutritionist admin services; server pages
 * pass those service results straight in, so TypeScript checks they stay
 * structurally compatible.
 */

export type AdminConsultProviderRow = {
  id: string;
  userId: string;
  name: string;
  email?: string;
  phone?: string;
  avatarUrl?: string;
  slug?: string;
  licenseNumber?: string;
  primarySpecialty?: string;
  /** Admin-verified, patient-visible specialties. */
  specialties: string[];
  experienceYears: number;
  consultationFee: number;
  city?: string;
  verificationStatus: string;
  verificationSubmittedAt?: string;
  verifiedAt?: string;
  rejectionReason?: string;
  isListed: boolean;
  isActive: boolean;
  videoConsultEnabled: boolean;
  /** Per-provider override; null means the platform default applies. */
  onlineCommissionPercent: number | null;
  ratingAvg: number;
  ratingCount: number;
  completedConsults: number;
  createdAt: string;
};

export type AdminConsultProviderDetail = AdminConsultProviderRow & {
  degree?: string;
  qualifications: string[];
  institute?: string;
  graduationYear?: number;
  cnicLast4?: string;
  bio?: string;
  languages: string[];
  additionalSpecialties: string[];
  clinics: { name: string; city: string; area?: string; address?: string }[];
  coverageCities: string[];
  weeklyAvailability: {
    dayOfWeek: number;
    startTimeLocal: string;
    endTimeLocal: string;
  }[];
  platformAgreementAcceptedAt?: string;
  documents: { key: string; label: string; url: string }[];
};

export type ConsultProviderBankAccount = {
  accountTitle?: string;
  accountNumber?: string;
  bankName?: string;
  iban?: string;
};

export type ConsultProviderPayoutRow = {
  id: string;
  amount: number;
  method: string;
  note?: string;
  paidByName: string;
  paidAt: string;
  receipt: { url: string; originalName?: string; mimeType?: string } | null;
};

export type ConsultProviderFinanceAppointmentRow = {
  id: string;
  scheduledStart: string;
  type: string;
  status: string;
  patientName: string;
  amountPkr?: number;
  paymentStatus?: string;
  patientJoinedAt?: string;
  providerJoinedAt?: string;
  videoSessionStatus?: string;
  earningCounted: boolean;
  earningAmount: number;
  reason: string;
  isReferred: boolean;
};

/** Finance payload with the role-specific subject key normalised to `provider`. */
export type ConsultProviderFinance = {
  provider: {
    id: string;
    name: string;
    avatarUrl?: string;
    specialties: string[];
    email?: string;
    phone?: string;
    verificationStatus: string;
    referredPatientCount: number;
  };
  earnings: {
    totalEarnings: number;
    earningsThisMonth: number;
    onlineCommissionPercent: number | null;
    effectiveOnlineCommissionPercent: number;
  };
  bankAccount: ConsultProviderBankAccount | null;
  payouts: ConsultProviderPayoutRow[];
  totalPaidOut: number;
  balanceDue: number;
  appointments: ConsultProviderFinanceAppointmentRow[];
};
