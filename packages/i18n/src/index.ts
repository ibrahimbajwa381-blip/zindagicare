import type { Locale } from "./config";
import { mobileEn, type MobileDictionary } from "./dictionaries/mobile-en";
import { mobileUr } from "./dictionaries/mobile-ur";

const mobileDictionaries: Record<Locale, MobileDictionary> = {
  en: mobileEn,
  ur: mobileUr,
};

export function getMobileDictionary(locale: Locale): MobileDictionary {
  return mobileDictionaries[locale] ?? mobileDictionaries.en;
}

export function interpolate(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    const value = values[key];
    return value === undefined ? match : String(value);
  });
}

export * from "./config";
export type { MobileDictionary };
export { mobileEn, mobileUr };
