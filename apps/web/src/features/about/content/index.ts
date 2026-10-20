import type { Locale } from "@/i18n/config";
import type { AboutContent } from "@/features/about/types";
import { aboutContentEn } from "./en";
import { aboutContentUr } from "./ur";

export function getAboutContent(locale: Locale): AboutContent {
  return locale === "ur" ? aboutContentUr : aboutContentEn;
}
