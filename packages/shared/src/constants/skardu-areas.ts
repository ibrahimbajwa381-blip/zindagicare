import type { AreaZone } from "./area-zone";

/** Skardu neighbourhoods by zone. Not exhaustive: the picker also accepts a typed area. */
export const SKARDU_ZONES: readonly AreaZone[] = [
  {
    zone: "Main areas",
    areas: [
      "Skardu City Centre", "Main Bazaar", "Hussainabad", "Sadpara Road", "Airport Road",
      "Satpara Road", "Shigar Road", "Khaplu Road", "New Bus Stand area", "Yadgar Chowk",
      "Ali Chowk", "Hameed Garh", "Qatil Gah", "Khargrong", "Mehdiabad Road side", "Gamba Skardu",
      "Olding", "Siksa", "Basho Road side", "Skardu Airport vicinity",
    ],
  },
  {
    zone: "Residential areas",
    areas: [
      "Hussainabad residential area", "Hameed Garh residential area", "Gamba residential area",
      "New Skardu residential area", "Satpara Road residential belt",
      "Shigar Road residential belt", "Airport Road residential belt", "Yadgar Chowk vicinity",
    ],
  },
];
