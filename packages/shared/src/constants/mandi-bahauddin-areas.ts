import type { AreaZone } from "./area-zone";

/** Mandi Bahauddin neighbourhoods by zone. Not exhaustive: the picker also accepts a typed area. */
export const MANDI_BAHAUDDIN_ZONES: readonly AreaZone[] = [
  {
    zone: "Main areas",
    areas: [
      "City Centre", "Railway Road", "GPO Road", "College Chowk", "Cheema Chowk", "Kachehri Road",
      "Jail Road", "Phalia Road", "Sargodha Road", "Gujrat Road", "Main Bazaar", "Committee Bazaar",
      "Bano Bazaar", "Ghala Mandi", "Civil Hospital Road", "Thana Road", "Sadar Chowk",
      "Lohara Market", "Usmania Mohallah", "Toheed Ganj",
    ],
  },
  {
    zone: "Colonies & residential areas",
    areas: [
      "Dhaka Colony", "Kashmir Colony", "Mohallah Islamabad", "Gulshan Iqbal Town",
      "Satellite Town", "Model Town", "Jinnah Colony", "Officers Colony", "Rehman Colony",
      "Housing Colony",
    ],
  },
  {
    zone: "Housing societies",
    areas: [
      "Eiffel Town", "Eiffel Town Phase II", "Jinnah Canal View City",
      "Other Phalia Road housing areas",
    ],
  },
];
