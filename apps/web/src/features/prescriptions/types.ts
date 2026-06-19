export type PrescriptionMedication = {
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
};

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
  medications: PrescriptionMedication[];
  notes?: string;
  mimeType?: string;
  fileSizeBytes?: number;
};

export type AppointmentPrescriptionLink = {
  id: string;
  downloadUrl: string;
};
