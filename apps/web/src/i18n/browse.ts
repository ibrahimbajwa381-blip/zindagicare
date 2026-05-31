import type { BrowseItem } from "@/features/marketing/data/browse-catalog";
import type { Locale } from "./config";
import { specialtyLabelsUr } from "./dictionaries/specialty-labels";

export function localizeBrowseItem(item: BrowseItem, locale: Locale): BrowseItem {
  if (locale === "en") return item;
  const label = specialtyLabelsUr[item.slug];
  return label ? { ...item, label } : item;
}

export function localizeBrowseItems(
  items: readonly BrowseItem[],
  locale: Locale,
): BrowseItem[] {
  return items.map((item) => localizeBrowseItem(item, locale));
}
