import type { Locale } from "./config";
import { en, type Dictionary } from "./dictionaries/en";
import { ur } from "./dictionaries/ur";

const dictionaries: Record<Locale, Dictionary> = { en, ur };

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale] ?? dictionaries.en;
}

export type { Dictionary, Locale };
export { en, ur };
