export const LAUNCH_CITY = "Lahore" as const;

export const SUPPORTED_CITIES = [LAUNCH_CITY, "Faisalabad"] as const;

export type SupportedCity = (typeof SUPPORTED_CITIES)[number];

/** Approximate city centres, used as a provider's default pin until they set their own. */
const CITY_CENTERS: Record<string, { lng: number; lat: number }> = {
  lahore: { lng: 74.3587, lat: 31.5204 },
  faisalabad: { lng: 73.135, lat: 31.4504 },
  karachi: { lng: 67.0011, lat: 24.8607 },
  islamabad: { lng: 73.0479, lat: 33.6844 },
  rawalpindi: { lng: 73.0169, lat: 33.5651 },
  multan: { lng: 71.5249, lat: 30.1575 },
  gujranwala: { lng: 74.1883, lat: 32.1877 },
  sialkot: { lng: 74.5229, lat: 32.4945 },
  peshawar: { lng: 71.5249, lat: 34.0151 },
};

/** Centre of `city`, falling back to the launch city when it is unknown. */
export function cityCenter(city: string | null | undefined): { lng: number; lat: number } {
  return CITY_CENTERS[(city ?? "").trim().toLowerCase()] ?? CITY_CENTERS.lahore!;
}
