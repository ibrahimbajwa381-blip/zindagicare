import type { AreaZone } from "./area-zone";

/** Shikarpur neighbourhoods by zone. Not exhaustive: the picker also accepts a typed area. */
export const SHIKARPUR_ZONES: readonly AreaZone[] = [
  {
    zone: "Main areas",
    areas: [
      "Shikarpur City Centre", "Shahi Bagh area", "Lakhi Gate", "Hathi Gate", "Hazari Gate",
      "Waggan Gate", "Karan Gate", "Station Road", "Sukkur Road", "Larkana Road", "Jacobabad Road",
      "Main Bazaar", "Clock Tower area", "Resham Gali", "Dhak Bazaar", "New Faujdari Road",
      "Civil Hospital area", "Kachehri Road", "Railway Station area", "Bypass Road",
    ],
  },
  {
    zone: "Colonies & residential areas",
    areas: [
      "Jinnah Colony", "Rehman Colony", "Railway Colony", "Officers Colony", "Labour Colony",
      "Housing Colony", "New Shikarpur residential area", "Sukkur Road residential belt",
      "Jacobabad Road residential belt", "Larkana Road residential belt",
    ],
  },
];
