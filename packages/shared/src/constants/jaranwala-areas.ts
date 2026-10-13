import type { AreaZone } from "./area-zone";

/** Jaranwala neighbourhoods by zone. Not exhaustive: the picker also accepts a typed area. */
export const JARANWALA_ZONES: readonly AreaZone[] = [
  {
    zone: "Main areas",
    areas: [
      "Jaranwala City Centre", "Faisalabad Road", "Lahore Road", "Sheikhupura Road",
      "Nankana Sahib Road", "Satiana Road", "Main Bazaar", "Railway Road", "Kachehri Road",
      "College Road", "Hospital Road", "Grain Market area", "Sabzi Mandi area",
      "Railway Station area", "Bypass Road", "Stadium Road", "Model Bazaar area", "Old Jaranwala",
      "New Jaranwala", "Bus Stand area",
    ],
  },
  {
    zone: "Colonies & residential areas",
    areas: [
      "Model Town", "Satellite Town", "Officers Colony", "Jinnah Colony", "Rehman Colony",
      "Muslim Colony", "Canal Colony", "Housing Colony", "Gulshan-e-Iqbal Colony",
      "Faisalabad Road residential belt",
    ],
  },
];
