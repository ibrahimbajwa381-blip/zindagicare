import type { AreaZone } from "./area-zone";

/** Gilgit neighbourhoods by zone. Not exhaustive: the picker also accepts a typed area. */
export const GILGIT_ZONES: readonly AreaZone[] = [
  {
    zone: "Main areas",
    areas: [
      "Gilgit City Centre", "Jutial", "Sakwar", "Konodas", "Kashrote", "Zulfiqarabad", "Danyore",
      "Basin", "Napura", "Nomal Road area", "Airport Road", "Gilgit-Baltistan Secretariat area",
      "River View Road", "Karakoram Highway area", "Shahrah-e-Quaid-e-Azam", "Chinar Bagh",
      "Amphrey", "Oshikhandass Road side", "Main Bazaar", "Raja Bazaar",
    ],
  },
  {
    zone: "Residential areas",
    areas: [
      "Jutial residential area", "Sakwar residential area", "Konodas residential area",
      "Kashrote residential area", "Zulfiqarabad residential area", "Basin residential area",
      "Danyore residential area", "University of Gilgit-Baltistan vicinity", "Airport vicinity",
      "Secretariat vicinity",
    ],
  },
];
