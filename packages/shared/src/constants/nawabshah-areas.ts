import type { AreaZone } from "./area-zone";

/** Nawabshah (Shaheed Benazirabad) neighbourhoods by zone. Not exhaustive: the picker also accepts a typed area. */
export const NAWABSHAH_ZONES: readonly AreaZone[] = [
  {
    zone: "Main areas",
    areas: [
      "Nawabshah City Centre", "Station Road", "Sakrand Road", "Hyderabad Road", "Sanghar Road",
      "Qazi Ahmed Road", "Masjid Road", "Hospital Road", "Market Road", "Kachehri Road",
      "Peoples Medical University area", "Old Nawabshah", "New Nawabshah", "Jam Sahib Road area",
      "Nawabshah Railway Station area",
    ],
  },
  {
    zone: "Colonies & residential areas",
    areas: [
      "Housing Society", "Citizen Colony", "Ghulam Hyder Shah Colony", "Allah Wala Colony",
      "Sachal Colony", "Jinnah Colony", "Gulshan-e-Haidery", "Sakrand Road residential area",
      "Society Road residential area", "Railway Colony", "Officers Colony", "Teachers Colony",
      "Labour Colony", "Satellite Town area", "Qasimabad residential area",
    ],
  },
];
