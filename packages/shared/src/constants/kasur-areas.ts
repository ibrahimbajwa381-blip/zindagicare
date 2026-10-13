import type { AreaZone } from "./area-zone";

/** Kasur neighbourhoods by zone. Not exhaustive: the picker also accepts a typed area. */
export const KASUR_ZONES: readonly AreaZone[] = [
  {
    zone: "Main areas",
    areas: [
      "Kasur City Centre", "Circular Road", "Railway Road", "Ferozepur Road", "Lahore Road",
      "Kot Radha Kishan Road", "Khara Road", "Mandi area", "Steel Bagh Chowk area",
      "Bulleh Shah Road area", "Sadar area", "Shahbaz Khan Road area", "Mustafabad Road area",
      "Kot Murad Khan", "New City area", "Kot Haleem Khan", "Basti Ghausia", "Raja Jang Road area",
      "Chunian Road area", "Pattoki Road area",
    ],
  },
  {
    zone: "Residential areas",
    areas: [
      "Model Town", "Officers Colony", "Rehman Pura", "Rasool Pura", "Mubarak Pura",
      "Basti Sheikh Sard", "Islam Pura", "Jinnah Colony", "Gulberg Colony", "Awan Town",
    ],
  },
];
