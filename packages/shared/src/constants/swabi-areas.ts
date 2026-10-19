import type { AreaZone } from "./area-zone";

/** Swabi neighbourhoods by zone. Not exhaustive: the picker also accepts a typed area. */
export const SWABI_ZONES: readonly AreaZone[] = [
  {
    zone: "Main areas",
    areas: [
      "Swabi City Centre", "Main Bazaar", "Mardan Road", "Topi Road", "Jehangira Road",
      "Yar Hussain Road", "Maneri", "Shahmansoor", "Marghuz", "Gohati", "Kotha", "Panjpir",
      "Ismaila", "Shewa", "Zaida", "Lahor", "Topi", "Chota Lahor", "Bam Khel", "Parmoli",
    ],
  },
  {
    zone: "Colonies & residential areas",
    areas: [
      "Shahmansoor Township", "Officers Colony", "Jinnah Colony", "Housing Colony",
      "Maneri residential area", "Marghuz residential area", "Gohati residential area",
      "Kotha residential area", "Yar Hussain residential area", "Swabi University vicinity",
    ],
  },
];
