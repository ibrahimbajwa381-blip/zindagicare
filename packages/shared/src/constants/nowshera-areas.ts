import type { AreaZone } from "./area-zone";

/** Nowshera neighbourhoods by zone. Not exhaustive: the picker also accepts a typed area. */
export const NOWSHERA_ZONES: readonly AreaZone[] = [
  {
    zone: "Main areas",
    areas: [
      "Nowshera City", "Nowshera Kalan", "Nowshera Khurd", "Nowshera Cantt", "Amangarh", "Pir Piai",
      "Manki Sharif", "Kheshgi", "Cherat Road area", "GT Road area", "Peshawar Road", "Mardan Road",
      "Kabul River vicinity", "Railway Station area", "Cantt Bazaar", "Main Bazaar",
    ],
  },
  {
    zone: "Colonies & residential areas",
    areas: [
      "Nowshera Cantt residential area", "Amangarh residential area", "Officers Colony",
      "Jinnah Colony", "Housing Colony", "Railway Colony", "New Nowshera residential area",
    ],
  },
];
