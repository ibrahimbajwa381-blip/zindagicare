import { apiFetch } from "./client";

/** From packages/shared/src/types/enums.ts's HomeVisitServiceTypes / HomeVisitStatuses. */
export type HomeCareServiceType =
  | "doctor_visit"
  | "nurse"
  | "physiotherapy"
  | "iv_drip"
  | "injection"
  | "wound_care";

export type HomeVisitStatus =
  | "requested"
  | "assigned"
  | "en_route"
  | "arrived"
  | "completed"
  | "cancelled";

export type HomeVisitDto = {
  id: string;
  serviceType: HomeCareServiceType;
  status: HomeVisitStatus;
  address: { line: string; city: string; geo: { lat: number; lng: number } };
  pricing: { base: number; surge: number; distance: number; total: number; currency: string };
  /** Set once checkout has started for this visit; undefined before then. */
  paymentStatus?: "pending" | "paid" | "failed" | "refunded" | "cancelled";
  /** Set once the patient cancels a paid visit — the visit stays active until an admin resolves the refund. */
  cancellationRequestStatus?: "none" | "pending" | "approved" | "denied";
  scheduledAt: string;
  patientNotes?: string;
  cancellationReason?: string;
  createdAt: string;
};

export type HomeVisitRefundMethod = "bank" | "jazzcash" | "easypaisa";

/** Mirrors packages/validators/src/home-visit.schema.ts's createHomeVisitSchema. */
export type CreateHomeVisitInput = {
  serviceType: HomeCareServiceType;
  addressLine: string;
  city?: string;
  geo: { lat: number; lng: number };
  scheduledAt: string;
  patientNotes?: string;
  autoAssign?: boolean;
};

export function createHomeVisit(input: CreateHomeVisitInput) {
  return apiFetch<HomeVisitDto>("/api/v1/home-visits", {
    method: "POST",
    body: JSON.stringify({ city: "Lahore", autoAssign: false, ...input }),
  });
}

export function listMyHomeVisits() {
  return apiFetch<HomeVisitDto[]>("/api/v1/home-visits?scope=mine");
}

/** Refund fields are only required when cancelling a visit that's already been paid for. */
export function cancelHomeVisit(
  id: string,
  input?: {
    cancellationReason?: string;
    refundMethod?: HomeVisitRefundMethod;
    refundAccountTitle?: string;
    refundAccountNumber?: string;
    refundBankName?: string;
  },
) {
  return apiFetch<HomeVisitDto>(`/api/v1/home-visits/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status: "cancelled", ...input }),
  });
}

export type HomeVisitManualTransfer = {
  provider: string;
  amountPkr: number;
  currency: string;
  account: { number: string; numberDisplay?: string; accountTitle: string };
  description?: string;
};

export type HomeVisitCheckoutResult = {
  paymentId: string;
  amount: number;
  manualTransfer?: HomeVisitManualTransfer;
  testMode?: boolean;
  testPayment?: { provider: string; txnRefNo: string; amountPkr: number };
};

/** Opens as soon as the visit is requested; resumes the pending payment if checkout was already started. */
export function checkoutHomeVisit(visitId: string) {
  return apiFetch<HomeVisitCheckoutResult>(`/api/v1/home-visits/${visitId}/checkout`, {
    method: "POST",
  });
}
