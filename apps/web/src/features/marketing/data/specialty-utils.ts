import type { BrowseItem } from "./browse-catalog";
import { FEATURED_SPECIALTY_COUNT, SPECIALTY_LABELS } from "./specialty-labels";

/** Per-tile circle colors — teal & navy brand family */
export const SPECIALTY_RING_PALETTE = [
  "from-brand-muted to-white ring-brand/25",
  "from-accent-muted to-white ring-accent/20",
  "from-brand-muted/80 to-brand-muted ring-brand-light/30",
  "from-accent-muted/80 to-accent-muted ring-accent-light/25",
  "from-brand-muted to-accent-muted ring-brand/20",
  "from-accent-muted to-brand-muted ring-accent/20",
  "from-white to-brand-muted ring-brand-light/35",
  "from-white to-accent-muted ring-accent-light/30",
  "from-brand-muted to-white ring-brand-dark/15",
  "from-accent-muted to-white ring-accent-dark/15",
  "from-brand-muted via-white to-accent-muted ring-brand/20",
  "from-accent-muted via-white to-brand-muted ring-accent/20",
  "from-brand-muted to-brand-muted/50 ring-brand-light/30",
  "from-accent-muted to-accent-muted/50 ring-accent-light/25",
  "from-brand-muted to-accent-muted ring-brand/25",
  "from-accent-muted to-brand-muted ring-accent/25",
] as const;

export function slugifySpecialty(label: string): string {
  return label
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function specialtyImagePath(slug: string): string {
  return `/browse/specialties/${slug}.svg`;
}

export function buildSpecialtyItem(label: string, index: number): BrowseItem {
  const slug = slugifySpecialty(label);
  return {
    slug,
    label,
    image: specialtyImagePath(slug),
    ring: SPECIALTY_RING_PALETTE[index % SPECIALTY_RING_PALETTE.length],
  };
}

export const allSpecialties: BrowseItem[] = SPECIALTY_LABELS.map(buildSpecialtyItem);

export const featuredSpecialties = allSpecialties.slice(0, FEATURED_SPECIALTY_COUNT);
