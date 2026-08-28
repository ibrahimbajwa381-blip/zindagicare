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
  scheduledAt: string;
  patientNotes?: string;
  cancellationReason?: string;
  createdAt: string;
};

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

export function cancelHomeVisit(id: string, cancellationReason?: string) {
  return apiFetch<HomeVisitDto>(`/api/v1/home-visits/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status: "cancelled", cancellationReason }),
  });
}
