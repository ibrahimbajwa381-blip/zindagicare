import { apiFetch } from "./client";
import { getStoredTokens } from "@/lib/token-storage";
import { API_URL } from "@/lib/config";

export type ConsultDoctorRow = {
  doctorId: string;
  slug?: string;
  name: string;
  avatarUrl?: string;
  specialties: string[];
  ratingAvg: number;
  ratingCount: number;
  pmdcVerified: boolean;
  consultationFee: number;
  hospital?: string;
  medicalDegree?: string;
  qualifications: string[];
  availableSlots: number;
  isFull: boolean;
};

export function listConsultDoctors(params: { city?: string; specialty?: string } = {}) {
  const search = new URLSearchParams();
  if (params.city) search.set("city", params.city);
  if (params.specialty) search.set("specialty", params.specialty);
  const qs = search.toString();
  return apiFetch<ConsultDoctorRow[]>(`/api/v1/consult/doctors${qs ? `?${qs}` : ""}`);
}

export type ConsultDoctorHospital = {
  name: string;
  city: string;
  address?: string;
};

export type ConsultDoctorProfile = {
  doctorId: string;
  slug: string;
  name: string;
  avatarUrl?: string;
  specialties: string[];
  bio?: string;
  experienceYears: number;
  languages: string[];
  medicalDegree?: string;
  qualifications: string[];
  medicalCollege?: string;
  graduationYear?: number;
  hospitals: ConsultDoctorHospital[];
  pmdcVerified: boolean;
  consultationFee: number;
  ratingAvg: number;
  ratingCount: number;
  availableSlots: number;
  isFull: boolean;
  videoConsultEnabled: boolean;
};

export type ConsultDoctorReview = {
  id: string;
  rating: number;
  comment?: string;
  patientName: string;
  createdAt: string;
};

export function getConsultDoctor(doctorId: string) {
  return apiFetch<{
    doctor: ConsultDoctorProfile;
    reviews: ConsultDoctorReview[];
    reviewTotal: number;
  }>(`/api/v1/consult/doctors/${doctorId}`);
}

/** Mirrors packages/shared/src/types/enums.ts's SlotStatuses. */
export type ConsultSlot = {
  slotId: string;
  startAt: string;
  endAt: string;
  status: "available" | "held" | "booked" | "completed";
};

export function listConsultSlots(doctorId: string, date?: string) {
  const search = new URLSearchParams({ doctorId });
  if (date) search.set("date", date);
  return apiFetch<{ doctorId: string; slots: ConsultSlot[] }>(
    `/api/v1/consult/slots?${search.toString()}`,
  );
}

/** Mirrors packages/validators/src/payment.schema.ts's consultCheckoutSchema. */
export type ConsultCheckoutInput = {
  doctorId: string;
  slotId: string;
  patientNotes?: string;
  locale?: "en" | "ur";
  paymentProvider?: "jazzcash" | "easypaisa";
};

export type ManualTransferInstructions = {
  provider: string;
  amountPkr: number;
  currency: string;
  account: { number: string; numberDisplay?: string; accountTitle: string };
  description?: string;
};

export type CheckoutResult = {
  paymentId: string;
  appointmentId: string;
  amount: number;
  manualTransfer?: ManualTransferInstructions;
  testMode?: boolean;
  testPayment?: { provider: string; txnRefNo: string; amountPkr: number };
  gatewayRedirect?: { url: string; fields: Record<string, string> };
};

export function checkoutConsult(input: ConsultCheckoutInput) {
  return apiFetch<CheckoutResult>("/api/v1/consult/checkout", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/** Mirrors packages/shared/src/types/enums.ts's PaymentStatuses. */
export type PaymentStatus = {
  paymentId: string;
  status: "pending" | "paid" | "failed" | "refunded" | "cancelled";
  provider: string;
  amount: number;
  appointmentId: string;
  appointmentStatus: string;
  manualTransfer?: ManualTransferInstructions;
  testMode?: boolean;
  receiptUploaded?: boolean;
};

export function getPaymentStatus(paymentId: string) {
  return apiFetch<PaymentStatus>(`/api/v1/payments/${paymentId}/status`);
}

/** Only succeeds for a DUMMY-provider payment; manual JazzCash payments must use uploadPaymentReceipt instead. */
export function completeTestPayment(paymentId: string) {
  return apiFetch<{ status: string }>("/api/v1/payments/test/complete", {
    method: "POST",
    body: JSON.stringify({ paymentId }),
  });
}

/** Uploads a transfer receipt screenshot for a manual JazzCash payment; this confirms the booking. */
export async function uploadPaymentReceipt(
  paymentId: string,
  file: { uri: string; name: string; type: string },
  transactionId?: string,
) {
  const { accessToken } = await getStoredTokens();
  const formData = new FormData();
  // React Native's FormData accepts { uri, name, type } directly for file fields.
  formData.append("file", file as unknown as Blob);
  if (transactionId) formData.append("transactionId", transactionId);

  const res = await fetch(`${API_URL}/api/v1/payments/${paymentId}/receipt`, {
    method: "POST",
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
    body: formData,
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error?.message ?? "Receipt upload failed");
  return json.data as { paymentId: string; receipt: { url: string } };
}
