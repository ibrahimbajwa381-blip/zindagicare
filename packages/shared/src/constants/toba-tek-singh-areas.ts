import type { AreaZone } from "./area-zone";

/** Toba Tek Singh neighbourhoods by zone. Not exhaustive: the picker also accepts a typed area. */
export const TOBA_TEK_SINGH_ZONES: readonly AreaZone[] = [
  {
    zone: "Main areas",
    areas: [
      "Toba Tek Singh City Centre", "Jhang Road", "Gojra Road", "Kamalia Road", "Rajana Road",
      "Chichawatni Road", "Railway Road", "College Road", "Kachehri Road", "Main Bazaar",
      "Hospital Road", "Grain Market area", "Sabzi Mandi area", "Railway Station vicinity",
      "Bypass Road", "Stadium Road", "District Courts vicinity", "Old Toba Tek Singh",
      "New Toba Tek Singh", "Bus Stand area",
    ],
  },
  {
    zone: "Colonies & residential areas",
    areas: [
      "Model Town", "Satellite Town", "Officers Colony", "Jinnah Colony", "Rehman Colony",
      "Housing Colony", "Canal Colony", "Muslim Colony", "Gulshan-e-Iqbal Colony",
      "New residential area near Gojra Road",
    ],
  },
];
