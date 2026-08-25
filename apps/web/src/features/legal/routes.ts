import type { LegalDocumentSlug } from "@/features/legal/types";

export const legalRoutes = {
  privacy: "/privacy",
  terms: "/terms",
  refundPolicy: "/refund-policy",
  telemedicineConsent: "/telemedicine-consent",
  providerAgreement: "/provider-agreement",
} as const satisfies Record<LegalDocumentSlug, string>;

export function getLegalRelatedLinks(
  slug: LegalDocumentSlug,
  labels: Record<LegalDocumentSlug, string>,
): { href: string; label: string }[] {
  const order: LegalDocumentSlug[] = [
    "terms",
    "privacy",
    "telemedicineConsent",
    "refundPolicy",
  ];

  return order
    .filter((key) => key !== slug)
    .map((key) => ({ href: legalRoutes[key], label: labels[key] }));
}
