import type { AreaZone } from "./area-zone";

/** Kamoke neighbourhoods by zone. Not exhaustive: the picker also accepts a typed area. */
export const KAMOKE_ZONES: readonly AreaZone[] = [
  {
    zone: "Main areas",
    areas: [
      "Kamoke City Centre", "GT Road", "Railway Road", "G.T. Road Bazaar", "Sialkot Road",
      "Eminabad Road", "Lahore Road", "Gujranwala Road", "Mandi area", "Grain Market area",
      "Sabzi Mandi area", "Bus Stand area", "Railway Station area", "Main Bazaar", "Kutchery Road",
    ],
  },
  {
    zone: "Colonies & residential areas",
    areas: [
      "Model Town", "Jinnah Colony", "Rehman Pura", "Islam Pura", "Madina Colony", "New Model Town",
      "Officers Colony", "Gulshan-e-Iqbal Colony", "Awan Town", "Muslim Town", "Tariqabad",
      "Shadman Colony", "Farooqabad area", "Rasool Nagar area", "Ahmad Nagar Road residential belt",
    ],
  },
];
