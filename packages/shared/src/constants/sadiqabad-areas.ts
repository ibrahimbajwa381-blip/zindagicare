import type { AreaZone } from "./area-zone";

/** Sadiqabad neighbourhoods by zone. Not exhaustive: the picker also accepts a typed area. */
export const SADIQABAD_ZONES: readonly AreaZone[] = [
  {
    zone: "Main areas",
    areas: [
      "Sadiqabad City Centre", "Main Bazaar", "Railway Road", "Rahim Yar Khan Road",
      "Zahir Pir Road", "Khanpur Road", "Bypass Road", "College Road", "Hospital Road",
      "Kachehri Road", "Grain Market area", "Sabzi Mandi area", "Railway Station area",
      "Bus Stand area", "Industrial Estate area", "Old Sadiqabad", "New Sadiqabad", "Circular Road",
      "Fawara Chowk area", "Model Bazaar area",
    ],
  },
  {
    zone: "Colonies & residential areas",
    areas: [
      "Model Town", "Satellite Town", "Jinnah Colony", "Officers Colony", "Rehman Colony",
      "Muslim Colony", "Canal Colony", "Housing Colony", "Gulshan-e-Iqbal Colony", "Shadman Colony",
    ],
  },
];
