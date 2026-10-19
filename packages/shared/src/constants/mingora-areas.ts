import type { AreaZone } from "./area-zone";

/** Mingora neighbourhoods by zone. Not exhaustive: the picker also accepts a typed area. */
export const MINGORA_ZONES: readonly AreaZone[] = [
  {
    zone: "Main areas",
    areas: [
      "Mingora City Centre", "Nishat Chowk", "Green Chowk", "Saidu Sharif Road", "Malookabad",
      "Qambar", "Rahimabad", "Amankot", "Rang Mohalla", "Shahdara", "Banr", "Fizagat", "Landikas",
      "Khwazakhela Road side", "Marghazar Road side", "College Colony", "Swat University Road area",
      "Grassy Ground area", "Saidu Sharif", "Kanju side",
    ],
  },
  {
    zone: "Residential areas & schemes",
    areas: [
      "Officers Colony", "New Malookabad", "Green Valley area", "Shahdara residential area",
      "Amankot residential area", "Qambar residential area", "Rahimabad residential area",
      "Fizagat residential area", "Saidu Sharif residential area", "Banr residential area",
    ],
  },
];
