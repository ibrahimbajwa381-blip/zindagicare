import { citiesMatch } from "@/lib/geo/city-match";

type HospitalLike = { name?: string | null; city?: string | null; area?: string | null };

/**
 * Area for an incoming practice location. Clients that don't send `area` yet
 * (mobile app, admin editor) would otherwise wipe it on every save, so an
 * omitted area falls back to the saved location with the same name and city.
 */
export function resolveHospitalArea(
  incoming: { name: string; city: string; area?: string },
  saved: readonly HospitalLike[] | null | undefined,
): string | undefined {
  if (incoming.area !== undefined) return incoming.area.trim() || undefined;
  const match = (saved ?? []).find(
    (h) =>
      (h.name ?? "").trim().toLowerCase() === incoming.name.trim().toLowerCase() &&
      citiesMatch(h.city ?? "", incoming.city),
  );
  return match?.area?.trim() || undefined;
}
