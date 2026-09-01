import type { BrowseItem } from "./browse-catalog";

const conditionImage = (slug: string) => `/browse/conditions/${slug}.svg`;

/** Symptom tiles — teal & navy brand family */
export const symptomBrowse: BrowseItem[] = [
  {
    slug: "fever",
    label: "Fever",
    image: conditionImage("fever"),
    ring: "from-brand-muted to-white ring-brand/25",
  },
  {
    slug: "heart-attack",
    label: "Heart attack",
    image: conditionImage("heart-attack"),
    ring: "from-accent-muted to-white ring-accent/20",
  },
  {
    slug: "pregnancy",
    label: "Pregnancy",
    image: conditionImage("pregnancy"),
    ring: "from-brand-muted/80 to-brand-muted ring-brand-light/30",
  },
  {
    slug: "high-blood-pressure",
    label: "High blood pressure",
    image: conditionImage("high-blood-pressure"),
    ring: "from-accent-muted to-accent-muted/50 ring-accent-light/25",
  },
  {
    slug: "breathlessness",
    label: "Breathlessness",
    image: conditionImage("breathlessness"),
    ring: "from-brand-muted to-accent-muted ring-brand/20",
  },
  {
    slug: "diarrhea",
    label: "Diarrhea",
    image: conditionImage("diarrhea"),
    ring: "from-brand-muted to-brand-muted/50 ring-brand-light/30",
  },
  {
    slug: "hairfall",
    label: "Hairfall",
    image: conditionImage("hairfall"),
    ring: "from-accent-muted via-white to-brand-muted ring-accent/20",
  },
  {
    slug: "anxiety-depression",
    label: "Anxiety/Depression",
    image: conditionImage("anxiety-depression"),
    ring: "from-brand-muted via-white to-accent-muted ring-brand/20",
  },
];

/** Disease tiles — teal & navy brand family */
export const diseaseBrowse: BrowseItem[] = [
  {
    slug: "dengue-fever",
    label: "Dengue fever",
    image: conditionImage("dengue-fever"),
    ring: "from-brand-muted to-white ring-brand-dark/15",
  },
  {
    slug: "typhoid-fever",
    label: "Typhoid Fever",
    image: conditionImage("typhoid-fever"),
    ring: "from-accent-muted to-white ring-accent-dark/15",
  },
  {
    slug: "piles",
    label: "Piles",
    image: conditionImage("piles"),
    ring: "from-accent-muted to-white ring-accent/20",
  },
  {
    slug: "gastritis",
    label: "Gastritis",
    image: conditionImage("gastritis"),
    ring: "from-brand-muted to-accent-muted ring-brand/25",
  },
  {
    slug: "hernia",
    label: "Hernia",
    image: conditionImage("hernia"),
    ring: "from-accent-muted to-brand-muted ring-accent/25",
  },
  {
    slug: "vaginal-infection",
    label: "Vaginal Infection",
    image: conditionImage("vaginal-infection"),
    ring: "from-brand-muted/80 to-brand-muted ring-brand-light/30",
  },
  {
    slug: "migraine",
    label: "Migraine",
    image: conditionImage("migraine"),
    ring: "from-accent-muted/80 to-accent-muted ring-accent-light/25",
  },
  {
    slug: "tb",
    label: "TB",
    image: conditionImage("tb"),
    ring: "from-brand-muted to-white ring-brand/25",
  },
];

/** Combined list, used for slug lookups (SEO condition pages, sitemap, etc). */
export const conditionBrowse: BrowseItem[] = [...symptomBrowse, ...diseaseBrowse, {
  slug: "acne",
  label: "Acne",
  image: conditionImage("acne"),
  ring: "from-brand-muted via-white to-accent-muted ring-brand/20",
}];
