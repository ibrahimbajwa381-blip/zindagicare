/**
 * Mirrors apps/web/src/config/theme.ts. Kept as a plain constants object
 * (not imported from the web app) since apps/web isn't a shared package.
 */
export const colors = {
  brand: {
    DEFAULT: "#0FA79B",
    dark: "#0D8A80",
    light: "#12B8AA",
    lighter: "#5FD4C8",
    muted: "#ECF9F7",
    mutedForeground: "#0A6B63",
    foreground: "#ffffff",
  },
  accent: {
    DEFAULT: "#0B3D91",
    dark: "#082A66",
    light: "#1565B8",
    lighter: "#4A9FD4",
    muted: "#EEF3FA",
    mutedForeground: "#0B3D91",
  },
  neutral: {
    background: "#ffffff",
    foreground: "#1a1a1a",
    muted: "#f6f7f9",
    border: "#e8eaed",
  },
} as const;

export const fonts = {
  regular: "PlusJakartaSans_400Regular",
  medium: "PlusJakartaSans_500Medium",
  semibold: "PlusJakartaSans_600SemiBold",
  bold: "PlusJakartaSans_700Bold",
} as const;

/** Cross-platform card elevation (iOS shadow* props + Android elevation). */
export const cardShadow = {
  shadowColor: "#0F172A",
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: 0.06,
  shadowRadius: 16,
  elevation: 3,
} as const;
