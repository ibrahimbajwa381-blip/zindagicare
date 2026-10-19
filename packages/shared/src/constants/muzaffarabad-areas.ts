import type { AreaZone } from "./area-zone";

/** Muzaffarabad neighbourhoods by zone. Not exhaustive: the picker also accepts a typed area. */
export const MUZAFFARABAD_ZONES: readonly AreaZone[] = [
  {
    zone: "Main areas",
    areas: [
      "Upper Chattar", "Lower Chattar", "Madina Market", "Bank Road", "Neelum Road",
      "Jhelum Valley Road", "Domel", "Chattar", "Chehla Bandi", "Naluchi", "Ambore", "Plate",
      "Gojra", "Bandi", "Lohar Gali", "Patika Road side", "University of Azad Jammu & Kashmir area",
      "CMH area", "Central Bazaar", "Red Fort vicinity",
    ],
  },
  {
    zone: "Colonies & residential areas",
    areas: [
      "Satellite Town", "Langarpura", "Officers Colony", "Chattar residential area",
      "Chehla Bandi residential area", "Naluchi residential area", "Ambore residential area",
      "Plate residential area", "Gojra residential area", "Domel residential area",
    ],
  },
  {
    zone: "Housing societies",
    areas: [
      "Satellite Town Langarpura",
    ],
  },
];
