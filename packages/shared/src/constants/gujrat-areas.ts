import type { AreaZone } from "./area-zone";

/** Gujrat neighbourhoods by zone. Not exhaustive: the picker also accepts a typed area. */
export const GUJRAT_ZONES: readonly AreaZone[] = [
  {
    zone: "Main city areas",
    areas: [
      "Main Bazaar", "Muslim Bazaar", "Railway Road", "GT Road", "Bhimber Road",
      "Jalalpur Jattan Road", "Airport Chowk", "Jail Road", "Model Town", "Dar-ul-Islam Colony",
    ],
  },
  {
    zone: "Colonies & residential areas",
    areas: [
      "Shadman Colony", "New Shadman Colony", "Saleem Colony", "Gubarg Colony",
      "Jalal Cheema Colony", "Zeb Colony", "Ahmad Town", "Rashid Colony", "Al-Nabi Colony",
      "Shehzad Colony", "Barha Dari Colony", "Asghar Town", "New Madal Town",
      "Akhtar Shah Colony", "Gulshan Colony", "Elahi Colony", "Shah Daula Town", "Islam Nagar",
    ],
  },
  {
    zone: "Housing societies",
    areas: [
      "Chenab Orchard", "River Garden Housing Scheme", "City Housing Society",
      "Model Town Housing Area", "Royal Garden Housing Society",
      "Dar-ul-Salam Welfare Housing Society", "Gulshan Bashir", "Valley Residencia",
    ],
  },
  {
    zone: "Commercial landmarks",
    areas: [
      "Jinnah Super Market", "Model Bazaar", "Sarwar Gold Plaza", "Aleena Center", "Sadiq Plaza",
      "Madina Plaza", "Chenab Plaza", "City Plaza", "Pace Gujrat",
    ],
  },
];
