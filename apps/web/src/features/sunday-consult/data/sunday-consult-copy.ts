import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n";

/** Localized Sunday consult marketing copy. */
export function getSundayConsultCopy(locale: Locale) {
  return getDictionary(locale).sunday;
}

/** @deprecated Use getSundayConsultCopy(locale) — English default for legacy imports */
export const sundayConsultCopy = getSundayConsultCopy("en");
