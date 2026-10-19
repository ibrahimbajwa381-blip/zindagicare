import type { AreaZone } from "./area-zone";

/** Bahawalnagar neighbourhoods by zone. Not exhaustive: the picker also accepts a typed area. */
export const BAHAWALNAGAR_ZONES: readonly AreaZone[] = [
  {
    zone: "Main areas",
    areas: [
      "Bahawalnagar City Centre", "Railway Road", "Fort Abbas Road", "Chishtian Road",
      "Haroonabad Road", "Minchinabad Road", "Main Bazaar", "Kachehri Road", "College Road",
      "Hospital Road", "Grain Market area", "Sabzi Mandi area", "Railway Station area",
      "Bypass Road", "Circular Road", "Sadar Bazaar", "Model Bazaar area", "Old Bahawalnagar",
      "New Bahawalnagar", "Bus Stand area",
    ],
  },
  {
    zone: "Colonies & residential areas",
    areas: [
      "Model Town", "Satellite Town", "Officers Colony", "Jinnah Colony", "Rehman Colony",
      "Muslim Colony", "Canal Colony", "Housing Colony", "Farid Town", "Gulshan-e-Iqbal Colony",
    ],
  },
];
