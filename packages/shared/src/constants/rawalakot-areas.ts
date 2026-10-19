import type { AreaZone } from "./area-zone";

/** Rawalakot neighbourhoods by zone. Not exhaustive: the picker also accepts a typed area. */
export const RAWALAKOT_ZONES: readonly AreaZone[] = [
  {
    zone: "Main areas",
    areas: [
      "Rawalakot City Centre", "Main Bazaar", "Kachehri Road", "Poonch Road", "Hajira Road",
      "Bagh Road", "Abbaspur Road", "Hospital Road", "College Road", "University of Poonch area",
      "Shamsabad", "Dhamni", "Chota Gala", "Ali Sojal", "Khaigala Road area", "Nala Road area",
      "Civil Lines area", "Bus Stand area", "Upper Rawalakot", "Lower Rawalakot",
    ],
  },
  {
    zone: "Residential areas",
    areas: [
      "Shamsabad residential area", "Chota Gala residential area", "Dhamni residential area",
      "University vicinity", "Hospital vicinity", "Poonch Road residential belt",
      "Hajira Road residential belt", "Bagh Road residential belt",
    ],
  },
];
