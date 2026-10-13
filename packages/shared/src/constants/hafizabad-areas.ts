import type { AreaZone } from "./area-zone";

/** Hafizabad neighbourhoods by zone. Not exhaustive: the picker also accepts a typed area. */
export const HAFIZABAD_ZONES: readonly AreaZone[] = [
  {
    zone: "Main areas",
    areas: [
      "Hafizabad City Centre", "Jalalpur Bhattian Road", "Gujranwala Road", "Pindi Bhattian Road",
      "Sargodha Road", "Vanike Tarar Road", "Railway Road", "Kachehri Road", "Main Bazaar",
      "Circular Road", "College Road", "Hospital Road", "Grain Market area", "Sabzi Mandi area",
      "Railway Station area",
    ],
  },
  {
    zone: "Colonies & residential areas",
    areas: [
      "Model Town", "Jinnah Colony", "Officers Colony", "Rehman Pura", "Islam Pura",
      "Madina Colony", "Gulshan Colony", "Muslim Town", "Farooq-e-Azam Colony", "Awan Colony",
      "Tariqabad", "Satellite Town area", "Housing Colony", "New Hafizabad residential area",
      "Vanike Road residential belt",
    ],
  },
];
