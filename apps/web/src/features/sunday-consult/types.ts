import type {
  AppointmentStatus,
  SundayAffordabilityChoice,
  SundayFreeRequestStatus,
} from "@zindagi/shared";
import type { ManualTransferCheckout } from "@/lib/payments/manual-payment";
import type { TestPaymentCheckout } from "@/lib/payments/dummy-payment";
import type { GatewayRedirectForm } from "@/lib/payments/types";

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
  /** Specialty the patient asked for; only doctors verified in it see the request. */
  preferredSpecialty?: string;
  affordabilityChoice: SundayAffordabilityChoice;
  paymentId?: string;
  contributionFeePkr?: number;
  createdAt: string;
  assignedAt?: string;
  appointmentId?: string;
  /** Real appointment status when linked (completed / confirmed / …). */
  appointmentStatus?: AppointmentStatus;
  scheduledStart?: string;
  scheduledEnd?: string;
  doctor?: SundayDoctorSummary;
};

/** Checkout returned when the patient chooses to contribute Rs. 800. */
export type SundayCheckoutResult = {
  kind: "payment";
  paymentId: string;
  amount: number;
  manualTransfer?: ManualTransferCheckout;
  /** @deprecated use manualTransfer */
  testMode?: boolean;
  /** @deprecated use manualTransfer */
  testPayment?: TestPaymentCheckout;
  gatewayRedirect?: GatewayRedirectForm;
};

export type SundaySubmitRequestResult =
  | ({ kind: "request" } & SundayPatientRequestDto)
  | SundayCheckoutResult;

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

/** One answered medical-history question (same set as the paid online consult). */
export type SundayHistoryAnswerDto = {
  key: string;
  text: string;
  answer: string;
};

/**
 * Sunday request as seen by doctors on the open-requests board.
 * Contact phone is only revealed to the doctor who picked the request.
 */
export type SundayDoctorRequestDto = {
  requestId: string;
  status: SundayFreeRequestStatus;
  sundayDateKey: string;
  patientName: string;
  patientPhone?: string;
  /** Legacy free-text notes on requests made before history was required. */
  patientNotes?: string;
  history: SundayHistoryAnswerDto[];
  /** Specialty the patient asked for; only doctors verified in it see the request. */
  preferredSpecialty?: string;
  affordabilityChoice: SundayAffordabilityChoice;
  createdAt: string;
  /** Unpicked request whose Sunday already passed (older than a week). */
  overdue: boolean;
  /** Sunday the consult is scheduled on if picked — the board Sunday for overdue requests. */
  consultDateKey: string;
  /** True when the signed-in doctor picked this request. */
  pickedByMe: boolean;
  /** Doctors who picked then left this request, with their note for the next doctor. */
  releaseNotes: { note?: string; releasedAt: string; byMe: boolean }[];
  appointmentId?: string;
  scheduledStart?: string;
  scheduledEnd?: string;
};

export type SundayAdminRequestDto = {
  requestId: string;
  status: SundayFreeRequestStatus;
  sundayDateKey: string;
  patientName: string;
  patientPhone: string;
  patientNotes?: string;
  /** Medical history the patient answered when requesting (symptoms, meds, allergies…). */
  history: SundayHistoryAnswerDto[];
  /** Specialty the patient asked for; only doctors verified in it see the request. */
  preferredSpecialty?: string;
  affordabilityChoice: SundayAffordabilityChoice;
  paymentId?: string;
  contributionFeePkr?: number;
  createdAt: string;
  assignedAt?: string;
  completedAt?: string;
  cancelledAt?: string;
  /** True when an admin rejected the request (cancellationReason holds their note). */
  rejectedByAdmin: boolean;
  cancellationReason?: string;
  appointmentId?: string;
  appointmentStatus?: AppointmentStatus;
  /** Set when the appointment was closed as a no-show. */
  missedBy?: "patient" | "doctor";
  scheduledStart?: string;
  scheduledEnd?: string;
  doctor?: Pick<
    SundayDoctorSummary,
    "doctorId" | "name" | "specialty" | "pmdcVerified" | "ratingAvg" | "ratingCount"
  > & { phone?: string };
  patientJoinedAt?: string;
  doctorJoinedAt?: string;
  session?: {
    status: string;
    startedAt?: string;
    endedAt?: string;
    durationSeconds?: number;
  };
  review?: {
    rating: number;
    comment?: string;
    createdAt?: string;
    isVisible: boolean;
  };
  /** Patient's rating of ZindagiCare itself for this consult. */
  platformReview?: {
    rating: number;
    comment?: string;
    createdAt: string;
  };
};
