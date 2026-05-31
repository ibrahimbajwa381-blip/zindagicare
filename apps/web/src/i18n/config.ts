export const LOCALES = ["en", "ur"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "zc_locale";
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

export function isLocale(value: string | undefined | null): value is Locale {
  return value === "en" || value === "ur";
}
