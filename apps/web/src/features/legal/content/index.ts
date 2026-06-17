import type { Locale } from "@/i18n/config";
import { legalDocumentsEn } from "./en";
import { legalDocumentsUr } from "./ur";
import type { LegalDocument, LegalDocumentSlug } from "@/features/legal/types";

export function getLegalDocument(
  locale: Locale,
  slug: LegalDocumentSlug,
): LegalDocument {
  const bundle = locale === "ur" ? legalDocumentsUr : legalDocumentsEn;
  return bundle[slug];
}

export type { LegalDocumentSlug };
