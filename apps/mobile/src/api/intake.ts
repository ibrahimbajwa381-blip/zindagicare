import { apiFetch } from "./client";

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

export function getPatientIntake(appointmentId: string) {
  return apiFetch<MedicalIntake>(`/api/v1/intake/${appointmentId}`);
}

export function submitPatientIntakeForm(appointmentId: string, answers: { key: string; answer: string }[]) {
  return apiFetch<{ intake: MedicalIntake }>(`/api/v1/intake/${appointmentId}`, {
    method: "POST",
    body: JSON.stringify({ answers }),
  });
}
