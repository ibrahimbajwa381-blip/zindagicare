import type { AreaZone } from "./area-zone";

/** Pakpattan neighbourhoods by zone. Not exhaustive: the picker also accepts a typed area. */
export const PAKPATTAN_ZONES: readonly AreaZone[] = [
  {
    zone: "Main areas",
    areas: [
      "Pakpattan City Centre", "Darbar Sharif area", "Shrine of Baba Farid vicinity", "Main Bazaar",
      "Railway Road", "Arifwala Road", "Sahiwal Road", "Multan Road", "Depalpur Road",
      "Kachehri Road", "College Road", "Hospital Road", "Grain Market area", "Sabzi Mandi area",
      "Railway Station area", "Mandi Bazaar", "Circular Road", "Old Pakpattan", "New Pakpattan",
      "Bypass Road",
    ],
  },
  {
    zone: "Colonies & residential areas",
    areas: [
      "Housing Colony", "Officers Colony", "Jinnah Colony", "Model Town", "Rehman Colony",
      "Muslim Colony", "Farid Town", "Satellite Town", "Canal Colony",
      "Darbar Road residential area",
    ],
  },
];
