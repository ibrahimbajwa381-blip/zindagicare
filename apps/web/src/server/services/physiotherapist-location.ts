import { LAHORE_GEO } from "@zindagi/shared";

type Coordinates = readonly unknown[] | null | undefined;

/** True when a saved GeoJSON point holds finite, in-range [lng, lat] coordinates. */
export function hasValidServiceAreaGeo(coordinates: Coordinates): coordinates is readonly [number, number] {
  if (!coordinates || coordinates.length !== 2) return false;
  const [lng, lat] = coordinates;
  return (
    typeof lng === "number" &&
    typeof lat === "number" &&
    Number.isFinite(lng) &&
    Number.isFinite(lat) &&
    Math.abs(lng) <= 180 &&
    Math.abs(lat) <= 90
  );
}

/** The Lahore city-centre pin older code saved when no real location was collected. */
export function isPlaceholderServiceAreaGeo(coordinates: Coordinates) {
  return (
    hasValidServiceAreaGeo(coordinates) &&
    coordinates[0] === LAHORE_GEO.lng &&
    coordinates[1] === LAHORE_GEO.lat
  );
}

/** A genuine Google Maps location: valid coordinates that are not the placeholder pin. */
export function hasRealServiceAreaGeo(coordinates: Coordinates) {
  return hasValidServiceAreaGeo(coordinates) && !isPlaceholderServiceAreaGeo(coordinates);
}
