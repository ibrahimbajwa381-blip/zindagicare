import { allSpecialties, conditionBrowse } from "@/features/marketing/data/browse-catalog";
import type { BreadcrumbItem } from "@/lib/seo/schema";

export type ResolvedBreadcrumbItem = BreadcrumbItem & {
  /** Dot path into the i18n dictionary, e.g. `breadcrumbs.dashboard` */
  labelKey?: string;
};

const MONGO_ID = /^[a-f0-9]{24}$/i;

/** Segments that exist only for routing — omit from the visible trail. */
const HIDDEN_SEGMENTS = new Set(["specialty", "condition"]);

const SEGMENT_LABELS: Record<string, { name: string; labelKey?: string }> = {
  doctors: { name: "Online consultation", labelKey: "nav.onlineConsult" },
  "sunday-consult": { name: "Sunday Free Consult", labelKey: "nav.sundayConsult" },
  "urgent-care": { name: "Urgent Care", labelKey: "nav.urgentCare" },
  "home-services": { name: "In-house medical services", labelKey: "nav.homeServices" },
  "home-physiotherapy": { name: "Home physiotherapy", labelKey: "nav.homePhysio" },
  "home-care": { name: "Home care", labelKey: "breadcrumbs.homeCare" },
  admin: { name: "Admin", labelKey: "breadcrumbs.admin" },
  doctor: { name: "Doctor workspace", labelKey: "breadcrumbs.doctorWorkspace" },
  nurse: { name: "Nurse workspace", labelKey: "breadcrumbs.nurseWorkspace" },
  physiotherapist: {
    name: "Physiotherapist workspace",
    labelKey: "breadcrumbs.physioWorkspace",
  },
  consult: { name: "Consultation", labelKey: "breadcrumbs.consultation" },
  booking: { name: "Booking", labelKey: "breadcrumbs.booking" },
  pay: { name: "Payment", labelKey: "breadcrumbs.payment" },
  success: { name: "Confirmation", labelKey: "breadcrumbs.confirmation" },
  failed: { name: "Payment failed", labelKey: "breadcrumbs.paymentFailed" },
  lahore: { name: "Doctors in Lahore", labelKey: "breadcrumbs.doctorsLahore" },
  request: { name: "Request visit", labelKey: "breadcrumbs.requestVisit" },
  visits: { name: "My visits", labelKey: "breadcrumbs.myVisits" },
  intake: { name: "Pre-visit intake", labelKey: "breadcrumbs.intake" },
  prescriptions: { name: "Prescriptions", labelKey: "breadcrumbs.prescriptions" },
  messages: { name: "Messages", labelKey: "header.actions.messages" },
  assistant: { name: "Health Assistant", labelKey: "copilot.navLabel" },
  dashboard: { name: "Dashboard", labelKey: "breadcrumbs.dashboard" },
  privacy: { name: "Privacy policy", labelKey: "breadcrumbs.privacy" },
  terms: { name: "Terms of service", labelKey: "breadcrumbs.terms" },
  "refund-policy": { name: "Refund policy", labelKey: "breadcrumbs.refundPolicy" },
  "telemedicine-consent": {
    name: "Telemedicine consent",
    labelKey: "breadcrumbs.telemedicineConsent",
  },
  "for-doctors": { name: "For doctors", labelKey: "breadcrumbs.forDoctors" },
  "for-nurses": { name: "For nurses", labelKey: "breadcrumbs.forNurses" },
  "for-physiotherapists": {
    name: "For physiotherapists",
    labelKey: "breadcrumbs.forPhysiotherapists",
  },
  "get-app": { name: "Get the app", labelKey: "breadcrumbs.getApp" },
  profile: { name: "Profile", labelKey: "breadcrumbs.profile" },
  edit: { name: "Edit profile", labelKey: "breadcrumbs.editProfile" },
  earnings: { name: "Earnings", labelKey: "breadcrumbs.earnings" },
  patients: { name: "Patients", labelKey: "breadcrumbs.patients" },
  requests: { name: "Consult requests", labelKey: "breadcrumbs.consultRequests" },
  "urgent-calls": { name: "Urgent care", labelKey: "nav.urgentCare" },
  "sunday-consult-doctor": {
    name: "Sunday consult",
    labelKey: "breadcrumbs.sundayConsultQueue",
  },
  "home-visits": { name: "Home visits", labelKey: "breadcrumbs.homeVisits" },
  verification: { name: "Verification", labelKey: "breadcrumbs.verification" },
  manage: { name: "Doctor management", labelKey: "breadcrumbs.doctorManagement" },
  review: { name: "Review application", labelKey: "breadcrumbs.reviewApplication" },
  admins: { name: "Admin users", labelKey: "breadcrumbs.adminUsers" },
  reviews: { name: "Patient reviews", labelKey: "breadcrumbs.patientReviews" },
  appointments: { name: "Appointments", labelKey: "breadcrumbs.appointments" },
  finances: { name: "Finances", labelKey: "breadcrumbs.finances" },
  notifications: { name: "Notifications", labelKey: "header.actions.notifications" },
  new: { name: "New prescription", labelKey: "breadcrumbs.newPrescription" },
  video: { name: "Video consultation", labelKey: "breadcrumbs.videoConsult" },
};

const FULL_PATH_LABELS: Record<string, { name: string; labelKey?: string }> = {
  "/dashboard": { name: "My dashboard", labelKey: "breadcrumbs.dashboard" },
  "/admin": { name: "Overview", labelKey: "breadcrumbs.overview" },
  "/doctor/profile": { name: "Overview", labelKey: "breadcrumbs.overview" },
  "/nurse": { name: "Overview", labelKey: "breadcrumbs.overview" },
  "/physiotherapist": { name: "Overview", labelKey: "breadcrumbs.overview" },
  "/admin/doctors": {
    name: "Doctor verifications",
    labelKey: "breadcrumbs.doctorVerifications",
  },
  "/admin/nurses": {
    name: "Nurse verifications",
    labelKey: "breadcrumbs.nurseVerifications",
  },
  "/admin/physiotherapists": {
    name: "Physiotherapist verifications",
    labelKey: "breadcrumbs.physioVerifications",
  },
};

const HIDDEN_PATH_PREFIXES = [
  "/login",
  "/register",
  "/onboarding",
  "/messages",
  "/~offline",
  "/consult/video",
] as const;

export function shouldShowBreadcrumbs(pathname: string): boolean {
  if (!pathname || pathname === "/") return false;
  return !HIDDEN_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function humanizeSlug(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function resolveDynamicLabel(
  segment: string,
  prevSegment: string | undefined,
  segments: string[],
  index: number,
): { name: string; labelKey?: string } | null {
  if (prevSegment === "specialty") {
    const specialty = allSpecialties.find((item) => item.slug === segment);
    if (specialty) return { name: specialty.label };
  }

  if (prevSegment === "condition") {
    const condition = conditionBrowse.find((item) => item.slug === segment);
    if (condition) return { name: condition.label };
  }

  if (MONGO_ID.test(segment)) {
    return { name: "Details", labelKey: "breadcrumbs.details" };
  }

  if (
    segments[0] === "doctors" &&
    index === 1 &&
    !SEGMENT_LABELS[segment] &&
    !["lahore", "booking"].includes(segment)
  ) {
    return { name: humanizeSlug(segment) };
  }

  if (segment === "sunday-consult" && segments[0] === "doctor") {
    return SEGMENT_LABELS["sunday-consult-doctor"];
  }

  return null;
}

function pushCrumb(
  items: ResolvedBreadcrumbItem[],
  path: string,
  label: { name: string; labelKey?: string },
) {
  const last = items[items.length - 1];
  if (last?.path === path) {
    last.name = label.name;
    last.labelKey = label.labelKey;
    return;
  }
  items.push({ path, name: label.name, labelKey: label.labelKey });
}

export function buildBreadcrumbsFromPathname(pathname: string): ResolvedBreadcrumbItem[] {
  if (!shouldShowBreadcrumbs(pathname)) return [];

  const segments = pathname.split("/").filter(Boolean);
  const items: ResolvedBreadcrumbItem[] = [
    { name: "Home", path: "/", labelKey: "nav.home" },
  ];

  let path = "";

  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    const prevSegment = index > 0 ? segments[index - 1] : undefined;
    path += `/${segment}`;

    if (HIDDEN_SEGMENTS.has(segment)) continue;

    const fullPathLabel = FULL_PATH_LABELS[path];
    if (fullPathLabel) {
      pushCrumb(items, path, fullPathLabel);
      continue;
    }

    const dynamicLabel = resolveDynamicLabel(segment, prevSegment, segments, index);
    if (dynamicLabel) {
      pushCrumb(items, path, dynamicLabel);
      continue;
    }

    const segmentLabel = SEGMENT_LABELS[segment];
    if (segmentLabel) {
      pushCrumb(items, path, segmentLabel);
      continue;
    }

    pushCrumb(items, path, { name: humanizeSlug(segment) });
  }

  return items;
}

/** Resolve a dot-path label key against a nested dictionary object. */
export function resolveBreadcrumbLabel(
  item: ResolvedBreadcrumbItem,
  dictionary: Record<string, unknown>,
): string {
  if (!item.labelKey) return item.name;

  const value = item.labelKey.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object" && key in acc) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, dictionary);

  return typeof value === "string" ? value : item.name;
}
