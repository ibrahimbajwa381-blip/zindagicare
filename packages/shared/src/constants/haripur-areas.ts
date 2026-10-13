import type { AreaZone } from "./area-zone";

/** Haripur neighbourhoods by zone. Not exhaustive: the picker also accepts a typed area. */
export const HARIPUR_ZONES: readonly AreaZone[] = [
  {
    zone: "Main areas",
    areas: [
      "Haripur City Centre", "Main Bazaar", "Darwesh", "Khalabat Road", "Hattar Road",
      "Khanpur Road", "Shah Maqsood Road", "Sera-e-Saleh", "Panian", "Tofkian", "KTS area",
      "Railway Road", "College Road", "Hospital Road", "GT Road area", "Tarbela Road", "Mang Road",
      "Chapper Road side", "Hattar Industrial Estate", "Haripur University vicinity",
    ],
  },
  {
    zone: "Colonies & residential areas",
    areas: [
      "Khalabat Township", "Officers Colony", "Jinnah Colony", "Model Town", "Satellite Town",
      "Rehman Colony", "Muslim Town", "Housing Colony", "Sera-e-Saleh residential area",
      "Panian residential area",
    ],
  },
];
