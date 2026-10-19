import type { AreaZone } from "./area-zone";

/** Gojra neighbourhoods by zone. Not exhaustive: the picker also accepts a typed area. */
export const GOJRA_ZONES: readonly AreaZone[] = [
  {
    zone: "Main areas",
    areas: [
      "Main Bazaar", "Quaid-e-Azam Road", "National Bank Road", "Mission Road", "Mongi Road",
      "Mochi Wala Road", "Samundri Road", "Jhang Road", "Pansera Road", "Toba Road",
      "Railway Station area", "Civil Hospital area", "Galla Mandi", "Lari Adda", "Civil Club area",
      "Ghadda Khana", "Eid Gah Road", "Baseline / 298 Road area", "Housing Colony Chowk",
      "Mission Chowk",
    ],
  },
  {
    zone: "Colonies & residential areas",
    areas: [
      "Bahar Colony", "Javaid Colony", "Sharifabad", "Ghareeb Colony", "Altaf Zikria Colony",
      "Samanzar Colony", "Green Town No. 1", "Green Town No. 2", "Alfaiz Society", "Bilal Park",
      "Samanabad", "Rasool Nagar", "Millat Town", "Tower Colony", "Tufail Colony",
      "Dastaghir Colony", "Shah Alam Colony", "Gulshan Zubaida Colony", "Tariqabad",
      "New Model Town", "Muslimabad", "Housing Colony", "Islam Pura", "Sharif Pura",
      "Sarwer Colony", "Ali Park", "Jamil Park", "Mughal Park", "Hussainia Colony",
      "Christian Colony", "Ansar Colony", "Awan Colony", "Ashraf Colony", "Iqbal Town",
      "Aftab Town", "Shadman Park", "Gulshan Colony", "Hafeez Park", "Haider Park", "New Plot area",
    ],
  },
];
