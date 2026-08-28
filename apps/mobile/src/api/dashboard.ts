import { apiFetch } from "./client";

export type OnlineBooking = {
  appointmentId: string;
  scheduledStart: string;
  scheduledEnd: string;
  status: string;
  consultationFee: number;
  doctor: {
    doctorId: string;
    userId: string;
    name: string;
    avatarUrl?: string;
    specialty: string;
    pmdcVerified: boolean;
    ratingAvg: number;
    ratingCount: number;
  };
};

/** Mirrors loadPatientOnlineBooking() on the web dashboard — the patient's current/most-recent online consult. */
export function getOnlineBooking() {
  return apiFetch<OnlineBooking | null>("/api/v1/patient/online-booking");
}
