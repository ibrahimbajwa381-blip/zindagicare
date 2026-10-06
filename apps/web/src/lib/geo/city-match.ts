/** Normalize city names for consistent matching (trim + lowercase). */
export function normalizeCityName(city: string): string {
  return city.trim().toLowerCase();
}

/** Display form of a free-text city name: "  SHORKOT city " → "Shorkot City". */
export function formatCityName(city: string): string {
  return normalizeCityName(city)
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function citiesMatch(a: string, b: string): boolean {
  return normalizeCityName(a) === normalizeCityName(b);
}

export function doctorCoversCity(
  profile: { coverageCities?: string[] | null },
  visitCity: string,
): boolean {
  return (profile.coverageCities ?? []).some((city) => citiesMatch(city, visitCity));
}

export function nurseCoversCity(
  profile: { serviceAreas?: { city?: string | null }[] | null },
  visitCity: string,
  fallbackCity: string,
): boolean {
  return (profile.serviceAreas ?? []).some((area) =>
    citiesMatch(area.city ?? fallbackCity, visitCity),
  );
}

/** Case-insensitive MongoDB filter for doctor coverageCities array. */
export function mongoCoverageCityFilter(city: string) {
  const escaped = city.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return {
    coverageCities: {
      $elemMatch: { $regex: new RegExp(`^${escaped}$`, "i") },
    },
  };
}
