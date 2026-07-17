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
  appointmentId?: string;
  scheduledStart?: string;
  scheduledEnd?: string;
  completedAt?: string;
  cancelledAt?: string;
  cancellationReason?: string;
  feePkr?: number;
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
  completedAt?: string;
  appointmentId?: string;
  scheduledStart?: string;
  scheduledEnd?: string;
  doctor?: UrgentCareRequestDto["doctor"];
  prescription?: {
    id: string;
    downloadUrl: string;
  };
};

export type UrgentCheckoutResult = {
  paymentId: string;
  amount: number;
  manualTransfer?: import("@/lib/payments/manual-payment").ManualTransferCheckout;
  /** @deprecated use manualTransfer */
  testMode?: boolean;
  /** @deprecated use manualTransfer */
  testPayment?: import("@/lib/payments/dummy-payment").TestPaymentCheckout;
  gatewayRedirect?: import("@/lib/payments/types").GatewayRedirectForm;
  /** @deprecated use gatewayRedirect */
  jazzcash?: import("@/lib/payments/types").GatewayRedirectForm;
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
