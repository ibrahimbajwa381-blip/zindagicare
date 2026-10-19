import type { AreaZone } from "./area-zone";

/** Charsadda neighbourhoods by zone. Not exhaustive: the picker also accepts a typed area. */
export const CHARSADDA_ZONES: readonly AreaZone[] = [
  {
    zone: "Main areas",
    areas: [
      "Charsadda City Centre", "Farooq-e-Azam Chowk area", "Tangi Road", "Peshawar Road",
      "Mardan Road", "Umarzai Road", "Prang Road", "Shabqadar Road", "Main Bazaar",
      "Railway Road area", "Hospital Road", "College Road", "Sardaryab Road side", "Utmanzai",
      "Prang", "Rajjar", "Umarzai", "Tarnab", "Hisara Yasinzai", "Dheri Zardad",
    ],
  },
  {
    zone: "Colonies & residential areas",
    areas: [
      "Turangzai Baba Town", "Ayub Model Colony", "Green Valley Housing Scheme area",
      "Ahmad Abad Phase 2 area", "Jinnah Colony", "Officers Colony", "Model Town", "Rehman Colony",
      "New Charsadda residential area", "Peshawar Road residential belt",
    ],
  },
];
