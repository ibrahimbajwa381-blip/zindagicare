import type { DoctorPortfolio } from "@/lib/doctors/portfolio";

export type PublicDoctorHospital = {
  name: string;
  city: string;
  area?: string;
  address?: string;
};

export type PublicDoctorProfile = {
  doctorId: string;
  slug: string;
  name: string;
  avatarUrl?: string;
  specialties: string[];
  bio?: string;
  experienceYears: number;
  languages: string[];
  medicalDegree?: string;
  qualifications: string[];
  medicalCollege?: string;
  graduationYear?: number;
  hospitals: PublicDoctorHospital[];
  pmdcVerified: boolean;
  consultationFee: number;
  ratingAvg: number;
  ratingCount: number;
  availableSlots: number;
  isFull: boolean;
  videoConsultEnabled: boolean;
  /** Weekly consultation hours (Asia/Karachi, day 0 = Sunday). */
  weeklyAvailability: PublicDoctorWeeklyWindow[];
  /** Doctor-authored portfolio with hidden sections already removed. */
  portfolio: DoctorPortfolio;
  /** The doctor chose to hide their FAQ section, so none should be generated for them either. */
  faqsHidden?: boolean;
};

export type PublicDoctorWeeklyWindow = {
  dayOfWeek: number;
  startTimeLocal: string;
  endTimeLocal: string;
};

export type DoctorReviewDto = {
  id: string;
  rating: number;
  comment?: string;
  patientName: string;
  createdAt: string;
};

export type FeaturedDoctorCard = {
  doctorId: string;
  slug: string;
  name: string;
  specialty: string;
  hospital: string;
  rating: number;
  reviews: number;
  fee: number;
  pmdcVerified: boolean;
  imageUrl?: string;
  medicalDegree?: string;
  qualifications: string[];
};
