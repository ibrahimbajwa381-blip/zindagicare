import type { AreaZone } from "./area-zone";

/** Jacobabad neighbourhoods by zone. Not exhaustive: the picker also accepts a typed area. */
export const JACOBABAD_ZONES: readonly AreaZone[] = [
  {
    zone: "Main areas",
    areas: [
      "Jacobabad City Centre", "Shahi Bazaar", "Station Road", "Thul Road", "Kashmore Road",
      "Quetta Road", "Dera Allah Yar Road", "Railway Station area", "Civil Hospital area",
      "Main Bazaar", "Sabzi Mandi area", "Grain Market area", "Sadar area", "Cantt area",
      "Airport Road area", "Bypass Road", "Jaffarabad Road side", "Old Jacobabad", "New Jacobabad",
      "Transport terminal area",
    ],
  },
  {
    zone: "Colonies & residential areas",
    areas: [
      "Satellite Town", "Jinnah Colony", "Rehman Colony", "Officers Colony", "Railway Colony",
      "Labour Colony", "Gulshan-e-Iqbal Colony", "Muslim Colony", "Shikarpur Road residential area",
      "Thul Road residential area",
    ],
  },
];
