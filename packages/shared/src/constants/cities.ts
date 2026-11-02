export const LAUNCH_CITY = "Lahore" as const;

/** Main home-visit cities — our team fulfils requests here even before a provider is listed. */
export const SUPPORTED_CITIES = [LAUNCH_CITY, "Karachi", "Faisalabad"] as const;

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

const CITY_NAMES: Record<string, string> = {
  lahore: "Lahore",
  faisalabad: "Faisalabad",
  karachi: "Karachi",
  islamabad: "Islamabad",
  rawalpindi: "Rawalpindi",
  multan: "Multan",
  gujranwala: "Gujranwala",
  sialkot: "Sialkot",
  peshawar: "Peshawar",
};

/** Known city whose centre is closest to the given point (e.g. a patient's map pin). */
export function nearestCity(lng: number, lat: number): string {
  let best = LAUNCH_CITY as string;
  let bestDist = Infinity;
  for (const [key, c] of Object.entries(CITY_CENTERS)) {
    // Equirectangular approximation is plenty for picking the closest city.
    const x = (lng - c.lng) * Math.cos(((lat + c.lat) / 2) * (Math.PI / 180));
    const y = lat - c.lat;
    const d = x * x + y * y;
    if (d < bestDist) {
      bestDist = d;
      best = CITY_NAMES[key] ?? key;
    }
  }
  return best;
}
