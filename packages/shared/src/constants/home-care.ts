import { HomeVisitServiceTypes, type HomeVisitServiceType } from "../types/enums";

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

/** Bounds (PKR) for the per-visit fee a physiotherapist sets on their own profile. */
export const PHYSIO_HOME_VISIT_FEE_MIN = 500;
export const PHYSIO_HOME_VISIT_FEE_MAX = 20000;

/** Bounds for the written session report a nurse or physiotherapist must submit when completing a visit. */
export const VISIT_SUMMARY_MIN_LENGTH = 20;
export const VISIT_SUMMARY_MAX_LENGTH = 3000;

/** A physiotherapist's own home-visit fee, or the platform rate when they haven't set one. */
export function resolvePhysioHomeVisitFee(fee?: number | null): number {
  return fee && fee > 0 ? fee : HOME_CARE_PRICING[HomeVisitServiceTypes.PHYSIOTHERAPY];
}

/** Bounds (PKR) for the per-visit fee a nurse sets on their own profile. */
export const NURSE_HOME_VISIT_FEE_MIN = 500;
export const NURSE_HOME_VISIT_FEE_MAX = 20000;

/**
 * A nurse's own fee for a general nursing visit, or the platform rate when they haven't set
 * one. Procedure visits (IV drip, injection, wound care) always use the platform rate.
 */
export function resolveNurseHomeVisitFee(fee?: number | null): number {
  return fee && fee > 0 ? fee : HOME_CARE_PRICING[HomeVisitServiceTypes.NURSE];
}

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

/** The kind of provider dispatched to a home visit. Values match the staff role names. */
export const HomeVisitProviderKinds = {
  DOCTOR: "doctor",
  PHYSIOTHERAPIST: "physiotherapist",
  NURSE: "nurse",
} as const;

export type HomeVisitProviderKind =
  (typeof HomeVisitProviderKinds)[keyof typeof HomeVisitProviderKinds];

export const HOME_VISIT_PROVIDER_KINDS = Object.values(
  HomeVisitProviderKinds,
) as readonly HomeVisitProviderKind[];

/**
 * Single source of truth for which provider serves each service type.
 * Exhaustive on purpose: adding a service type fails to compile until it is
 * placed here, so it can never silently fall out of every admin queue.
 */
const HOME_VISIT_SERVICE_PROVIDER: Record<HomeVisitServiceType, HomeVisitProviderKind> = {
  [HomeVisitServiceTypes.DOCTOR_VISIT]: HomeVisitProviderKinds.DOCTOR,
  [HomeVisitServiceTypes.PHYSIOTHERAPY]: HomeVisitProviderKinds.PHYSIOTHERAPIST,
  [HomeVisitServiceTypes.NURSE]: HomeVisitProviderKinds.NURSE,
  [HomeVisitServiceTypes.IV_DRIP]: HomeVisitProviderKinds.NURSE,
  [HomeVisitServiceTypes.INJECTION]: HomeVisitProviderKinds.NURSE,
  [HomeVisitServiceTypes.WOUND_CARE]: HomeVisitProviderKinds.NURSE,
  [HomeVisitServiceTypes.SAMPLE_COLLECTION]: HomeVisitProviderKinds.NURSE,
  [HomeVisitServiceTypes.EMERGENCY]: HomeVisitProviderKinds.NURSE,
};

export function isHomeVisitProviderKind(value: unknown): value is HomeVisitProviderKind {
  return (HOME_VISIT_PROVIDER_KINDS as readonly unknown[]).includes(value);
}

/** Provider kind for a service type; unknown (legacy) values fall back to nurse dispatch. */
export function homeVisitProviderKind(serviceType: string): HomeVisitProviderKind {
  return (
    HOME_VISIT_SERVICE_PROVIDER[serviceType as HomeVisitServiceType] ??
    HomeVisitProviderKinds.NURSE
  );
}

/** Every service type dispatched to the given provider kind. */
export function homeVisitServiceTypesFor(
  kind: HomeVisitProviderKind,
): HomeVisitServiceType[] {
  return (Object.keys(HOME_VISIT_SERVICE_PROVIDER) as HomeVisitServiceType[]).filter(
    (serviceType) => HOME_VISIT_SERVICE_PROVIDER[serviceType] === kind,
  );
}

export function isDoctorHomeVisitService(serviceType: string): boolean {
  return homeVisitProviderKind(serviceType) === HomeVisitProviderKinds.DOCTOR;
}

export function isPhysiotherapyHomeVisitService(serviceType: string): boolean {
  return homeVisitProviderKind(serviceType) === HomeVisitProviderKinds.PHYSIOTHERAPIST;
}

/** Max distance (km) a nurse can be auto-matched from the visit address. */
export const HOME_CARE_MATCH_RADIUS_KM = 15;
