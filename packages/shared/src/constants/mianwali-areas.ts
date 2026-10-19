import type { AreaZone } from "./area-zone";

/** Mianwali neighbourhoods by zone. Not exhaustive: the picker also accepts a typed area. */
export const MIANWALI_ZONES: readonly AreaZone[] = [
  {
    zone: "Main areas",
    areas: [
      "Mianwali City Centre", "Sargodha Road", "Rawalpindi Road", "Mianwali–Talagang Road",
      "Isakhel Road", "Piplan Road", "Daud Khel Road", "Railway Road", "Kachehri Road",
      "Main Bazaar", "Hospital Road", "College Road", "District Courts vicinity",
      "Railway Station area", "General Bus Stand area", "Wan Bhachran Road", "Kalabagh Road",
      "Old Mianwali", "New Mianwali", "Bypass Road",
    ],
  },
  {
    zone: "Colonies & residential areas",
    areas: [
      "Shaheen Town", "Ramzanabad", "Zadey Khel", "Miana Nai Abadi", "Balo Khel residential area",
      "Officers Colony", "Jinnah Colony", "Model Town", "Housing Colony",
      "PAF Road residential area",
    ],
  },
];
