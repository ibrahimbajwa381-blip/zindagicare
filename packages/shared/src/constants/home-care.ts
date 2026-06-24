import { HomeVisitServiceTypes } from "../types/enums";

/** Lahore city center — fallback when patient geo is unavailable. */
export const LAHORE_GEO = {
  lng: 74.3587,
  lat: 31.5204,
} as const;

/** Base pricing (PKR) for Lahore MVP home care services. */
export const HOME_CARE_PRICING: Record<
  | typeof HomeVisitServiceTypes.IV_DRIP
  | typeof HomeVisitServiceTypes.INJECTION
  | typeof HomeVisitServiceTypes.WOUND_CARE
  | typeof HomeVisitServiceTypes.NURSE
  | typeof HomeVisitServiceTypes.DOCTOR_VISIT
  | typeof HomeVisitServiceTypes.PHYSIOTHERAPY,
  number
> = {
  [HomeVisitServiceTypes.IV_DRIP]: 2500,
  [HomeVisitServiceTypes.INJECTION]: 1500,
  [HomeVisitServiceTypes.WOUND_CARE]: 2000,
  [HomeVisitServiceTypes.NURSE]: 1800,
  [HomeVisitServiceTypes.DOCTOR_VISIT]: 3500,
  [HomeVisitServiceTypes.PHYSIOTHERAPY]: 2800,
};

/** Lahore MVP — services patients can request from the booking form. */
export const HOME_CARE_MVP_SERVICES = [
  HomeVisitServiceTypes.DOCTOR_VISIT,
  HomeVisitServiceTypes.NURSE,
  HomeVisitServiceTypes.PHYSIOTHERAPY,
  HomeVisitServiceTypes.IV_DRIP,
  HomeVisitServiceTypes.INJECTION,
  HomeVisitServiceTypes.WOUND_CARE,
] as const;

export type HomeCareMvpService = (typeof HOME_CARE_MVP_SERVICES)[number];

/** Nurse-dispatched home care (IV, injection, wound care, general nurse). */
export const HOME_CARE_NURSE_SERVICES = [
  HomeVisitServiceTypes.NURSE,
  HomeVisitServiceTypes.IV_DRIP,
  HomeVisitServiceTypes.INJECTION,
  HomeVisitServiceTypes.WOUND_CARE,
] as const;

/** Physiotherapist-dispatched home care. */
export const HOME_CARE_PHYSIOTHERAPY_SERVICES = [
  HomeVisitServiceTypes.PHYSIOTHERAPY,
] as const;

export function isDoctorHomeVisitService(serviceType: string): boolean {
  return serviceType === HomeVisitServiceTypes.DOCTOR_VISIT;
}

export function isPhysiotherapyHomeVisitService(serviceType: string): boolean {
  return serviceType === HomeVisitServiceTypes.PHYSIOTHERAPY;
}

/** Max distance (km) a nurse can be auto-matched from the visit address. */
export const HOME_CARE_MATCH_RADIUS_KM = 15;
