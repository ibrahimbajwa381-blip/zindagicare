import type { AppointmentStatus } from "@zindagi/shared";

/** API response after confirming a Sunday free consult booking. */
export type SundayConfirmBookingResult = {
  appointmentId: string;
  scheduledStart: string;
  scheduledEnd: string;
  status: AppointmentStatus;
};

export type SundayPatientBookingDto = {
  appointmentId: string;
  scheduledStart: string;
  scheduledEnd: string;
  status: AppointmentStatus;
  sundayDateKey: string;
  doctor: {
    doctorId: string;
    name: string;
    avatarUrl?: string;
    specialty: string;
    pmdcVerified: boolean;
    ratingAvg: number;
    ratingCount: number;
  };
};
