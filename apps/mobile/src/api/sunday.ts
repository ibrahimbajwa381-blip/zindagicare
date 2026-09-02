import { apiFetch } from "./client";
import type { ManualTransferInstructions } from "./consult";

/** Mirrors packages/shared/src/types/enums.ts's SundayFreeRequestStatuses. */
export type SundayFreeRequestStatus = "requested" | "assigned" | "completed" | "cancelled";

/** Mirrors packages/shared/src/constants/sunday-consult.ts's SundayAffordabilityChoices. */
export type SundayAffordabilityChoice = "cannot_afford" | "pay_fee";

/** Sunday free-consult contribution fee in PKR (SUNDAY_CONSULT_CONFIG.contributionFeePkr). */
export const SUNDAY_CONTRIBUTION_FEE_PKR = 500;
/** Target window doctors are matched within (SUNDAY_CONSULT_CONFIG.matchWithinMinutes). */
export const SUNDAY_MATCH_WITHIN_MINUTES = 60;

export type SundayDoctorSummary = {
  doctorId: string;
  name: string;
  avatarUrl?: string;
  specialty: string;
  pmdcVerified: boolean;
  ratingAvg: number;
  ratingCount: number;
};

/** Active Sunday free request (request -> assign -> join lifecycle). */
export type SundayPatientRequestDto = {
  requestId: string;
  status: SundayFreeRequestStatus;
  sundayDateKey: string;
  patientPhone: string;
  patientNotes?: string;
  affordabilityChoice: SundayAffordabilityChoice;
  paymentId?: string;
  contributionFeePkr?: number;
  createdAt: string;
  assignedAt?: string;
  appointmentId?: string;
  appointmentStatus?: string;
  scheduledStart?: string;
  scheduledEnd?: string;
  doctor?: SundayDoctorSummary;
};

export type SundayCheckoutResult = {
  kind: "payment";
  paymentId: string;
  amount: number;
  manualTransfer?: ManualTransferInstructions;
};

export type SundaySubmitRequestResult =
  | ({ kind: "request" } & SundayPatientRequestDto)
  | SundayCheckoutResult;

export type SundayFreeRequestInput = {
  patientPhone: string;
  patientNotes?: string;
  affordabilityChoice: SundayAffordabilityChoice;
};

/** Returns null when the patient has no active/past request for the given Sunday. */
export function getMySundayRequest(date?: string) {
  const qs = date ? `?date=${encodeURIComponent(date)}` : "";
  return apiFetch<SundayPatientRequestDto | null>(`/api/v1/sunday/request${qs}`);
}

export function submitSundayRequest(input: SundayFreeRequestInput) {
  return apiFetch<SundaySubmitRequestResult>("/api/v1/sunday/request", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
