export const LOCALES = ["en", "ur"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

export function isLocale(value: string | undefined | null): value is Locale {
  return value === "en" || value === "ur";
}

export function isRtlLocale(locale: Locale): boolean {
  return locale === "ur";
}
