export const LAUNCH_CITY = "Lahore" as const;

export const SUPPORTED_CITIES = [LAUNCH_CITY] as const;

export type SupportedCity = (typeof SUPPORTED_CITIES)[number];
