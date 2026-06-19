export type UrgentAvailabilityDto = {
  available: boolean;
  doctorsOnline: number;
  estimatedWaitMinutes: number;
  estimatedWaitMaxMinutes: number;
  consultDurationMins: number;
  feePkr: number;
  targetCallWithinMinutes: number;
};

export type UrgentTeamDoctorOption = {
  doctorId: string;
  name: string;
  specialties: string[];
  pmdcVerified: boolean;
};

export type UrgentCareRequestDto = {
  requestId: string;
  patientId: string;
  patientName: string;
  patientPhone: string;
  patientNotes?: string;
  status: string;
  createdAt: string;
  assignedAt?: string;
  doctor?: {
    doctorId: string;
    name: string;
    avatarUrl?: string;
    specialty: string;
    pmdcVerified: boolean;
  };
};

export type UrgentPatientRequestDto = {
  requestId: string;
  status: string;
  patientPhone: string;
  patientNotes?: string;
  createdAt: string;
  assignedAt?: string;
  doctor?: UrgentCareRequestDto["doctor"];
};

/** @deprecated use UrgentPatientRequestDto */
export type UrgentPatientBookingDto = UrgentPatientRequestDto & {
  appointmentId?: string;
};

export type UrgentDoctorQueueItem = {
  appointmentId: string;
  scheduledStart: string;
  scheduledEnd: string;
  status: string;
  patientName: string;
  patientNotes?: string;
};
