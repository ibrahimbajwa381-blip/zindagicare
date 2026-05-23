/**
 * ZindagiCare brand color theme — teal primary (#0FA79B) + navy accent (#0B3D91).
 * CSS variables live in `src/app/globals.css`; use Tailwind `brand-*` and `accent-*` classes in UI.
 */
export const theme = {
  name: "ZindagiCare Healthcare",
  description:
    "Clean healthcare palette: teal for care and action, navy blue for trust and depth, white surfaces with soft black text.",

  /** Teal — primary brand (buttons, links, highlights) */
  brand: {
    DEFAULT: "#0FA79B",
    dark: "#0D8A80",
    light: "#12B8AA",
    lighter: "#5FD4C8",
    muted: "#ECF9F7",
    mutedForeground: "#0A6B63",
    foreground: "#ffffff",
    tailwind: "brand",
  },

  /** Navy — secondary accent (gradients, banners, footer) */
  accent: {
    DEFAULT: "#0B3D91",
    dark: "#082A66",
    light: "#1565B8",
    lighter: "#4A9FD4",
    muted: "#EEF3FA",
    mutedForeground: "#0B3D91",
    tailwind: "accent",
  },

  neutral: {
    background: "#ffffff",
    foreground: "#1a1a1a",
    muted: "#f6f7f9",
    border: "#e8eaed",
    surface: "#ffffff",
  },

  gradients: {
    hero: "navy-900 → navy → teal-dark → teal → teal-light",
    premium: "navy-dark → teal → teal-light",
    heroHighlight: "teal-light → teal → sky-blue",
    banner: "navy-dark → navy → teal-dark",
  },
} as const;

export type Theme = typeof theme;
