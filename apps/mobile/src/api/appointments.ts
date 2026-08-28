import { apiFetch } from "./client";

export type AppointmentHistoryItem = {
  appointmentId: string;
  type: "online" | "sunday_free" | "urgent_online";
  typeLabel: string;
  scheduledStart: string;
  scheduledEnd: string;
  status: string;
  consultationFee?: number;
  doctor: { doctorId: string; name: string; avatarUrl?: string; specialty: string };
  isMissed: boolean;
  canJoin: boolean;
  canReview: boolean;
  review?: { rating: number; comment?: string; createdAt: string };
  prescription?: { downloadUrl: string };
};

export function getAppointmentHistory() {
  return apiFetch<AppointmentHistoryItem[]>("/api/v1/patient/appointments/history");
}

/** Mirrors packages/validators/src/review.schema.ts's submitReviewSchema. */
export type SubmitReviewInput = {
  rating: number;
  comment?: string;
};

export function submitAppointmentReview(appointmentId: string, input: SubmitReviewInput) {
  return apiFetch<{ rating: number; comment?: string; createdAt: string }>(
    `/api/v1/appointments/${appointmentId}/review`,
    { method: "POST", body: JSON.stringify(input) },
  );
}

export type VideoJoinPayload = {
  appointmentId: string;
  sessionId: string;
  role: "patient" | "doctor";
  joinUrl: string;
  scheduledStart: string;
  scheduledEnd: string;
  counterpartName: string;
  meetingTitle: string;
  canJoin: boolean;
};

export function joinVideoSession(appointmentId: string) {
  return apiFetch<VideoJoinPayload>(`/api/v1/video/sessions/${appointmentId}/join`, {
    method: "POST",
  });
}
