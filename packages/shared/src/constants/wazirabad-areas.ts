import type { AreaZone } from "./area-zone";

/** Wazirabad neighbourhoods by zone. Not exhaustive: the picker also accepts a typed area. */
export const WAZIRABAD_ZONES: readonly AreaZone[] = [
  {
    zone: "Main areas",
    areas: [
      "Wazirabad City Centre", "GT Road", "Circular Road", "Sialkot Road", "Gujranwala Road",
      "Allahabad Road", "Railway Road", "Main Bazaar", "Kachehri Road", "College Road",
      "Hospital Road", "Rail Bazaar", "Cutlery Market area", "Nizamabad", "Dhonkal Road",
      "Ghakkhar Road", "Sialkot Bypass", "Gujranwala Bypass", "Railway Station area",
      "Civil Lines area",
    ],
  },
  {
    zone: "Colonies & residential areas",
    areas: [
      "Model Town", "Satellite Town", "Officers Colony", "Jinnah Colony", "Rehman Colony",
      "Islam Pura", "Muslim Colony", "Nizamabad residential area", "Housing Colony",
      "New Wazirabad residential area",
    ],
  },
];
