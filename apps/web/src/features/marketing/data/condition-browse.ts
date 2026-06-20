import type { BrowseItem } from "./browse-catalog";

const conditionImage = (slug: string) => `/browse/conditions/${slug}.svg`;

/** Condition tiles — teal & navy brand family */
export const conditionBrowse: BrowseItem[] = [
  {
    slug: "fever",
    label: "Fever",
    image: conditionImage("fever"),
    ring: "from-brand-muted to-white ring-brand/25",
  },
  {
    slug: "pregnancy",
    label: "Pregnancy",
    image: conditionImage("pregnancy"),
    ring: "from-brand-muted/80 to-brand-muted ring-brand-light/30",
  },
  {
    slug: "high-blood-pressure",
    label: "High Blood Pressure",
    image: conditionImage("high-blood-pressure"),
    ring: "from-accent-muted to-accent-muted/50 ring-accent-light/25",
  },
  {
    slug: "piles",
    label: "Piles",
    image: conditionImage("piles"),
    ring: "from-accent-muted to-white ring-accent/20",
  },
  {
    slug: "diarrhea",
    label: "Diarrhea",
    image: conditionImage("diarrhea"),
    ring: "from-brand-muted to-brand-muted/50 ring-brand-light/30",
  },
  {
    slug: "acne",
    label: "Acne",
    image: conditionImage("acne"),
    ring: "from-brand-muted via-white to-accent-muted ring-brand/20",
  },
];
