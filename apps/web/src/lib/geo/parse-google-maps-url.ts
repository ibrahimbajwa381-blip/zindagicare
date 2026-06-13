export type GeoCoordinates = { lng: number; lat: number };

function isValidCoord(lng: number, lat: number): boolean {
  return (
    Number.isFinite(lng) &&
    Number.isFinite(lat) &&
    lng >= -180 &&
    lng <= 180 &&
    lat >= -90 &&
    lat <= 90
  );
}

/** Extract lat/lng from common Google Maps share URLs and coordinate strings. */
export function parseGoogleMapsUrl(input: string): GeoCoordinates | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const directPair = trimmed.match(
    /^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/,
  );
  if (directPair) {
    const lat = Number(directPair[1]);
    const lng = Number(directPair[2]);
    if (isValidCoord(lng, lat)) return { lng, lat };
  }

  const atMatch = trimmed.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (atMatch) {
    const lat = Number(atMatch[1]);
    const lng = Number(atMatch[2]);
    if (isValidCoord(lng, lat)) return { lng, lat };
  }

  const qMatch = trimmed.match(
    /[?&](?:q|query|ll|center)=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/,
  );
  if (qMatch) {
    const lat = Number(qMatch[1]);
    const lng = Number(qMatch[2]);
    if (isValidCoord(lng, lat)) return { lng, lat };
  }

  const placeMatch = trimmed.match(
    /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/,
  );
  if (placeMatch) {
    const lat = Number(placeMatch[1]);
    const lng = Number(placeMatch[2]);
    if (isValidCoord(lng, lat)) return { lng, lat };
  }

  return null;
}

export function formatGeoLabel(geo: GeoCoordinates): string {
  return `${geo.lat.toFixed(5)}, ${geo.lng.toFixed(5)}`;
}

export function googleMapsLink(geo: GeoCoordinates): string {
  return `https://www.google.com/maps?q=${geo.lat},${geo.lng}`;
}
