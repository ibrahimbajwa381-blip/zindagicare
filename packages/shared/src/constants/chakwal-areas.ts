import type { AreaZone } from "./area-zone";

/** Chakwal neighbourhoods by zone. Not exhaustive: the picker also accepts a typed area. */
export const CHAKWAL_ZONES: readonly AreaZone[] = [
  {
    zone: "Main areas",
    areas: [
      "Chakwal City Centre", "Talagang Road", "Jhelum Road", "Rawalpindi Road", "Bhoun Road",
      "Balkassar Road", "Choa Saidan Shah Road", "Kachehri Road", "College Road", "Main Bazaar",
      "Maghi Road", "Hospital Road", "District Courts area", "Railway/transport terminal area",
      "Tehsil Chowk area", "Line Park area", "Anwarabad", "Farooqi Mohallah", "Dhudial Road area",
      "Old Chakwal",
    ],
  },
  {
    zone: "Colonies & residential areas",
    areas: [
      "Satellite Town", "Model Town", "Officers Colony", "Jinnah Colony", "Rehman Colony",
      "Housing Colony", "Anwarabad residential area", "Farooqi Mohallah residential area",
      "Maghi Road residential belt", "Talagang Road residential belt",
    ],
  },
];
