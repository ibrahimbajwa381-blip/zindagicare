import type { AreaZone } from "./area-zone";

/** Muzaffargarh neighbourhoods by zone. Not exhaustive: the picker also accepts a typed area. */
export const MUZAFFARGARH_ZONES: readonly AreaZone[] = [
  {
    zone: "Main areas",
    areas: [
      "Muzaffargarh City Centre", "Multan Road", "Dera Ghazi Khan Road", "Jhang Road",
      "Alipur Road", "Khan Garh Road", "Railway Road", "Kachehri Road", "Main Bazaar",
      "Chowk Sarwar Shaheed Road side", "College Road", "Hospital Road", "Bus Stand area",
      "Railway Station area", "Industrial Estate area",
    ],
  },
  {
    zone: "Colonies & residential areas",
    areas: [
      "Model Town", "Satellite Town", "Officers Colony", "Jinnah Colony", "Rehman Colony",
      "Madina Colony", "Gulshan-e-Iqbal Colony", "Islam Pura", "New Muzaffargarh", "Canal Colony",
      "Labour Colony", "Shah Jamal Road residential belt", "Khan Garh Road residential belt",
      "Alipur Road residential belt", "Dera Ghazi Khan Road residential belt",
    ],
  },
];
