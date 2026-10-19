import {
  HERBALIST_SPECIALTIES_ALPHABETICAL,
  MAX_HERBALIST_SPECIALTIES,
  MAX_NUTRITIONIST_SPECIALTIES,
  NUTRITIONIST_SPECIALTIES_ALPHABETICAL,
} from "@zindagi/shared";
import { herbalistProfilePath } from "@/lib/herbalists/profile-path";
import { nutritionistProfilePath } from "@/lib/nutritionists/profile-path";

/**
 * Video-consult providers that share one admin workflow (verification queue,
 * directory, manage page, finance). Everything role-specific lives in the
 * config below, so the components never branch on the provider kind.
 */
export const ConsultProviderKinds = {
  HERBALIST: "herbalist",
  NUTRITIONIST: "nutritionist",
} as const;

export type ConsultProviderKind =
  (typeof ConsultProviderKinds)[keyof typeof ConsultProviderKinds];

export type ConsultProviderAdminConfig = {
  kind: ConsultProviderKind;
  labels: {
    singular: string;
    plural: string;
    singularLower: string;
    pluralLower: string;
  };
  /** Admin page routes. */
  routes: {
    queue: string;
    manage: string;
    review: (id: string) => string;
    manageDetail: (id: string) => string;
  };
  /** Admin API root, e.g. `/api/v1/admin/herbalists`. */
  apiBase: string;
  /** Key holding the rows in the list endpoint's response. */
  listResponseKey: string;
  /** Body field naming the profile in the decide endpoint. */
  decideIdField: string;
  /** Key holding the provider summary in the finance endpoint's response. */
  financeSubjectKey: string;
  specialties: readonly string[];
  maxSpecialties: number;
  publicProfilePath: (slug?: string | null, id?: string) => string;
};

export const CONSULT_PROVIDER_ADMIN_CONFIGS: Record<
  ConsultProviderKind,
  ConsultProviderAdminConfig
> = {
  [ConsultProviderKinds.HERBALIST]: {
    kind: ConsultProviderKinds.HERBALIST,
    labels: {
      singular: "Herbalist",
      plural: "Herbalists",
      singularLower: "herbalist",
      pluralLower: "herbalists",
    },
    routes: {
      queue: "/admin/herbalists",
      manage: "/admin/herbalists/manage",
      review: (id) => `/admin/herbalists/review/${id}`,
      manageDetail: (id) => `/admin/herbalists/manage/${id}`,
    },
    apiBase: "/api/v1/admin/herbalists",
    listResponseKey: "herbalists",
    decideIdField: "herbalistProfileId",
    financeSubjectKey: "herbalist",
    specialties: HERBALIST_SPECIALTIES_ALPHABETICAL,
    maxSpecialties: MAX_HERBALIST_SPECIALTIES,
    publicProfilePath: herbalistProfilePath,
  },
  [ConsultProviderKinds.NUTRITIONIST]: {
    kind: ConsultProviderKinds.NUTRITIONIST,
    labels: {
      singular: "Nutritionist",
      plural: "Nutritionists",
      singularLower: "nutritionist",
      pluralLower: "nutritionists",
    },
    routes: {
      queue: "/admin/nutritionists",
      manage: "/admin/nutritionists/manage",
      review: (id) => `/admin/nutritionists/review/${id}`,
      manageDetail: (id) => `/admin/nutritionists/manage/${id}`,
    },
    apiBase: "/api/v1/admin/nutritionists",
    listResponseKey: "nutritionists",
    decideIdField: "nutritionistProfileId",
    financeSubjectKey: "nutritionist",
    specialties: NUTRITIONIST_SPECIALTIES_ALPHABETICAL,
    maxSpecialties: MAX_NUTRITIONIST_SPECIALTIES,
    publicProfilePath: nutritionistProfilePath,
  },
};

export function getConsultProviderAdminConfig(
  kind: ConsultProviderKind,
): ConsultProviderAdminConfig {
  return CONSULT_PROVIDER_ADMIN_CONFIGS[kind];
}
