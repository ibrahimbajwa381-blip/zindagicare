import type { AreaZone } from "./area-zone";

/** Burewala neighbourhoods by zone. Not exhaustive: the picker also accepts a typed area. */
export const BUREWALA_ZONES: readonly AreaZone[] = [
  {
    zone: "Main areas",
    areas: [
      "Burewala City Centre", "Multan Road", "Vehari Road", "Arifwala Road", "Lahore Road",
      "College Road", "Railway Road", "Main Bazaar", "Kachehri Road", "Hospital Road",
      "Grain Market area", "Sabzi Mandi area", "Model Bazaar area", "Stadium Road", "Bypass Road",
      "Chichawatni Road", "Qaboola Road", "Railway Station area", "Old Burewala", "New Burewala",
    ],
  },
  {
    zone: "Colonies & residential areas",
    areas: [
      "Satellite Town", "Model Town", "Officers Colony", "Jinnah Colony", "Rehman Colony",
      "Muslim Colony", "Housing Colony", "Canal Colony", "Sharqi residential area",
      "Gulshan-e-Iqbal Colony",
    ],
  },
];
