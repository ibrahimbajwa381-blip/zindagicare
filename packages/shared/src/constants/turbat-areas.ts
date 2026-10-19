import type { AreaZone } from "./area-zone";

/** Turbat neighbourhoods by zone. Not exhaustive: the picker also accepts a typed area. */
export const TURBAT_ZONES: readonly AreaZone[] = [
  {
    zone: "Main areas",
    areas: [
      "Turbat City Centre", "Airport Road", "Main Bazaar", "Atta Shad Chowk area", "Absor",
      "Singani Sar", "Malikabad", "Ginnah", "Dashtuk", "Gomazi Road side", "Buleda Road side",
      "Hoshap Road side", "Kech River area", "Turbat University Road", "Hospital Road",
      "Railway/transport terminal area", "Satellite Town area", "Old Turbat", "New Turbat",
      "Mand Road side",
    ],
  },
  {
    zone: "Residential areas",
    areas: [
      "Malikabad residential area", "Absor residential area", "Singani Sar residential area",
      "Ginnah residential area", "University vicinity", "Airport vicinity", "Hospital vicinity",
      "Kech River-side settlement areas",
    ],
  },
];
