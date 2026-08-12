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
  /** Doctor-chosen primary specialty. */
  primarySpecialty?: string;
  /** Doctor-requested additional specialties (may await admin verification). */
  additionalSpecialties: string[];
  /** Admin-verified specialties visible to patients. */
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

const DAY_LABELS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export function formatDayOfWeek(dayOfWeek: number): string {
  return DAY_LABELS[dayOfWeek] ?? `Day ${dayOfWeek}`;
}
