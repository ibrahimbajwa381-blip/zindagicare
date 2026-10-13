import type { AreaZone } from "./area-zone";

/** Ahmedpur East neighbourhoods by zone. Not exhaustive: the picker also accepts a typed area. */
export const AHMEDPUR_EAST_ZONES: readonly AreaZone[] = [
  {
    zone: "Main areas",
    areas: [
      "Ahmedpur East City Centre", "Main Bazaar", "Uch Road", "Bahawalpur Road", "Multan Road",
      "Railway Road", "Kachehri Road", "Hospital Road", "College Road", "Bypass Road",
      "Qainchi Mor", "Sadiqabad Mohallah", "Darbar Road area", "Grain Market area",
      "Sabzi Mandi area", "Bus Stand area", "Old Ahmedpur East", "New Ahmedpur East",
      "Railway Station vicinity", "Main commercial market area",
    ],
  },
  {
    zone: "Colonies & residential areas",
    areas: [
      "Mohallah Sadiqabad", "Basti Patwarian", "Housing Colony", "Jinnah Colony", "Officers Colony",
      "Rehman Colony", "Muslim Colony", "Model Town", "Satellite Town", "Canal Colony",
    ],
  },
];
