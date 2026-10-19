import type { AreaZone } from "./area-zone";

/** Vehari neighbourhoods by zone. Not exhaustive: the picker also accepts a typed area. */
export const VEHARI_ZONES: readonly AreaZone[] = [
  {
    zone: "Main areas",
    areas: [
      "Vehari City Centre", "Multan Road", "Burewala Road", "Luddan Road", "Mailsi Road",
      "College Road", "Club Road", "Railway Road", "Kachehri Road", "Main Bazaar", "Hospital Road",
      "Grain Market area", "Sabzi Mandi area", "Railway Station area", "Bypass Road",
      "Model Bazaar area", "Stadium Road", "District Courts vicinity", "Old Vehari", "New Vehari",
    ],
  },
  {
    zone: "Colonies & residential areas",
    areas: [
      "Sharqi Colony", "Satellite Town", "Model Town", "Officers Colony", "Jinnah Colony",
      "Rehman Colony", "Canal Colony", "Housing Colony", "Gulshan-e-Iqbal Colony", "Muslim Town",
    ],
  },
];
