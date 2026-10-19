import {
  HOME_CARE_EXTENDED_RADIUS_KM,
  HOME_CARE_MATCH_RADIUS_KM,
  HOME_VISIT_PROVIDER_KINDS,
  HomeVisitProviderKinds,
  type HomeVisitProviderKind,
} from "@zindagi/shared";
import type { AdminNavCounts } from "@/features/admin/types/admin-nav";

/** Everything the admin UI needs to render one provider's home-visit queue. */
export type AdminHomeVisitProvider = {
  kind: HomeVisitProviderKind;
  /** URL segment under /admin/home-visits. */
  slug: string;
  href: string;
  navLabel: string;
  navDescription: string;
  pageTitle: string;
  pageDescription: string;
  /** Singular / plural provider nouns, e.g. "physiotherapist" / "physiotherapists". */
  providerNoun: string;
  providerNounPlural: string;
  /** Who appears in the assignment dropdown for this queue. */
  eligibilityRules: string[];
  navCountKey: keyof AdminNavCounts;
};

export const ADMIN_HOME_VISITS_ROOT = "/admin/home-visits";

export const ADMIN_HOME_VISIT_PROVIDERS: Record<HomeVisitProviderKind, AdminHomeVisitProvider> = {
  [HomeVisitProviderKinds.DOCTOR]: {
    kind: HomeVisitProviderKinds.DOCTOR,
    slug: "doctors",
    href: `${ADMIN_HOME_VISITS_ROOT}/doctors`,
    navLabel: "Doctor home visits",
    navDescription: "Doctor visits to patients' homes",
    pageTitle: "Doctor home visits",
    pageDescription:
      "Assign doctors to in-house visit requests. Matching uses doctor availability, coverage city and distance to the patient.",
    providerNoun: "doctor",
    providerNounPlural: "doctors",
    eligibilityRules: [
      "In-house visits enabled — turned on in profile edit or at verification",
      "Publicly listed on the online doctors page (Admin → Doctors)",
      "Coverage cities include the visit city — always required, even with manual override",
      `Any distance — matching prefers doctors whose own coverage radius includes the patient, then within ${HOME_CARE_MATCH_RADIUS_KM} km, ${HOME_CARE_EXTENDED_RADIUS_KM} km, and the rest of the city. Confirm travel and any extra charges outside a doctor's radius`,
    ],
    navCountKey: "homeVisitsDoctor",
  },
  [HomeVisitProviderKinds.PHYSIOTHERAPIST]: {
    kind: HomeVisitProviderKinds.PHYSIOTHERAPIST,
    slug: "physiotherapists",
    href: `${ADMIN_HOME_VISITS_ROOT}/physiotherapists`,
    navLabel: "Physiotherapist home visits",
    navDescription: "Physiotherapy sessions at home",
    pageTitle: "Physiotherapist home visits",
    pageDescription:
      "Assign physiotherapists to home physiotherapy requests. Matching uses availability and distance to the patient.",
    providerNoun: "physiotherapist",
    providerNounPlural: "physiotherapists",
    eligibilityRules: [
      "Verified physiotherapist with home visits enabled and marked available",
      "Not already booked at the visit time",
      `Any distance or city — auto-match prefers physios whose own coverage radius includes the patient, then within ${HOME_CARE_MATCH_RADIUS_KM} km, ${HOME_CARE_EXTENDED_RADIUS_KM} km, the patient's city, then other cities. Confirm travel and any extra charges outside a physio's radius`,
    ],
    navCountKey: "homeVisitsPhysiotherapist",
  },
  [HomeVisitProviderKinds.NURSE]: {
    kind: HomeVisitProviderKinds.NURSE,
    slug: "nurses",
    href: `${ADMIN_HOME_VISITS_ROOT}/nurses`,
    navLabel: "Nurse home visits",
    navDescription: "IV drips, injections, wound care",
    pageTitle: "Nurse home visits",
    pageDescription:
      "Assign nurses to home care requests (general nursing, IV drips, injections, wound care). Matching uses availability and distance to the patient.",
    providerNoun: "nurse",
    providerNounPlural: "nurses",
    eligibilityRules: [
      "Verified nurse with home visits enabled and marked available",
      "Not already booked at the visit time",
      `Any distance — auto-match prefers nurses whose own coverage radius includes the patient, then within ${HOME_CARE_MATCH_RADIUS_KM} km, ${HOME_CARE_EXTENDED_RADIUS_KM} km, and the patient's city (never another city). Confirm travel and any extra charges outside a nurse's radius`,
    ],
    navCountKey: "homeVisitsNurse",
  },
};

/** Queues in sidebar / hub display order. */
export const ADMIN_HOME_VISIT_PROVIDER_LIST: AdminHomeVisitProvider[] =
  HOME_VISIT_PROVIDER_KINDS.map((kind) => ADMIN_HOME_VISIT_PROVIDERS[kind]);

export function adminHomeVisitProviderBySlug(slug: string): AdminHomeVisitProvider | undefined {
  return ADMIN_HOME_VISIT_PROVIDER_LIST.find((provider) => provider.slug === slug);
}

/** Link to a provider's queue, optionally focusing one visit. */
export function adminHomeVisitsHref(kind: HomeVisitProviderKind, visitId?: string): string {
  const { href } = ADMIN_HOME_VISIT_PROVIDERS[kind];
  return visitId ? `${href}?visitId=${encodeURIComponent(visitId)}` : href;
}
