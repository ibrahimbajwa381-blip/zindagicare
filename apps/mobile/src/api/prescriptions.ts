import { apiFetch } from "./client";

export type PrescriptionSummary = {
  id: string;
  appointmentId?: string;
  doctorName: string;
  patientName: string;
  issuedAt: string;
  medicationCount: number;
  downloadUrl: string;
};

export type PrescriptionDetail = PrescriptionSummary & {
  medications: { name: string; dosage: string; frequency: string; duration: string }[];
  notes?: string;
  mimeType?: string;
  fileSizeBytes?: number;
};

export function listPrescriptions() {
  return apiFetch<PrescriptionSummary[]>("/api/v1/patient/prescriptions");
}

export function getPrescriptionDetail(id: string) {
  return apiFetch<PrescriptionDetail>(`/api/v1/prescriptions/${id}`);
}
