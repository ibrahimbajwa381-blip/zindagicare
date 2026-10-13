import type { AreaZone } from "./area-zone";

/** Layyah neighbourhoods by zone. Not exhaustive: the picker also accepts a typed area. */
export const LAYYAH_ZONES: readonly AreaZone[] = [
  {
    zone: "Main areas",
    areas: [
      "Layyah City Centre", "Karor Road", "Chowk Azam Road", "Chaubara Road", "Kot Addu Road",
      "Multan Road", "Railway Road", "Kachehri Road", "Main Bazaar", "College Road",
      "Hospital Road", "Bypass Road", "Mian Bahadar Mor", "Gelani Manzil Road", "Link Jail Road",
      "TDA Chowk area", "Grain Market area", "Sabzi Mandi area", "Railway Station area",
      "Old Layyah",
    ],
  },
  {
    zone: "Colonies & residential areas",
    areas: [
      "Rehmanabad", "Housing Colony", "TDA Colony", "Qureshi Housing area", "Employees Colony",
      "Jinnah Colony", "Model Town", "Officers Colony", "Satellite Town",
      "New Layyah residential area",
    ],
  },
  {
    zone: "Housing societies",
    areas: [
      "Fatima Garden", "Layyah Smart City", "Sami Garden", "Al Jannat Housing Scheme",
      "Al Moiz City Garden",
    ],
  },
];
