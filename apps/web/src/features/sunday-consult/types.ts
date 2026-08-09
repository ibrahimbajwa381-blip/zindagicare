import type { AppointmentStatus, SundayFreeRequestStatus } from "@zindagi/shared";

/** API response after confirming a Sunday free consult booking. */
export type SundayConfirmBookingResult = {
  appointmentId: string;
  scheduledStart: string;
  scheduledEnd: string;
  status: AppointmentStatus;
};

export type SundayDoctorSummary = {
  doctorId: string;
  name: string;
  avatarUrl?: string;
  specialty: string;
  pmdcVerified: boolean;
  ratingAvg: number;
  ratingCount: number;
};

/** Active Sunday free request (request → assign → join). */
export type SundayPatientRequestDto = {
  requestId: string;
  status: SundayFreeRequestStatus;
  sundayDateKey: string;
  patientPhone: string;
  patientNotes?: string;
  createdAt: string;
  assignedAt?: string;
  appointmentId?: string;
  scheduledStart?: string;
  scheduledEnd?: string;
  doctor?: SundayDoctorSummary;
};

/** @deprecated Prefer SundayPatientRequestDto — kept for dashboard cards that still expect appointment shape. */
export type SundayPatientBookingDto = {
  appointmentId: string;
  scheduledStart: string;
  scheduledEnd: string;
  status: AppointmentStatus;
  sundayDateKey: string;
  doctor: SundayDoctorSummary;
  /** Present when booking originated from a free-consult request */
  requestId?: string;
  requestStatus?: SundayFreeRequestStatus;
};

export type SundayTeamDoctorOption = {
  doctorId: string;
  name: string;
  specialties: string[];
  pmdcVerified: boolean;
};

export type SundayAdminRequestDto = {
  requestId: string;
  status: SundayFreeRequestStatus;
  sundayDateKey: string;
  patientName: string;
  patientPhone: string;
  patientNotes?: string;
  createdAt: string;
  assignedAt?: string;
  appointmentId?: string;
  scheduledStart?: string;
  scheduledEnd?: string;
  doctor?: Pick<SundayDoctorSummary, "doctorId" | "name" | "specialty" | "pmdcVerified">;
};
