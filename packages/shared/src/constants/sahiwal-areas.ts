import type { AreaZone } from "./area-zone";

/** Sahiwal neighbourhoods by zone. Not exhaustive: the picker also accepts a typed area. */
export const SAHIWAL_ZONES: readonly AreaZone[] = [
  {
    zone: "Main city areas",
    areas: [
      "Sahiwal City Centre", "High Street", "Church Road", "Jhal Road", "GT Road",
      "Lahore–Multan Road", "Pakpattan Road", "Arifwala Road", "College Chowk area",
      "Sadar Chowk area", "Civil Lines", "Stadium Road", "Jahaz Ground", "Dosehra Ground",
    ],
  },
  {
    zone: "Colonies & residential areas",
    areas: [
      "Farid Town", "Canal Colony", "Model Town", "Manzoor Colony", "Gulshan Ali Housing Scheme",
      "Tariq bin Ziad Colony", "Bilal Colony", "Officer Colony", "Labour Colony",
      "Fatima Jinnah Housing Colony", "Zaildar Colony", "Gulistan Colony", "Shadab Town",
      "Pak Avenue Colony",
    ],
  },
  {
    zone: "Housing societies",
    areas: [
      "Jeewan City Housing Scheme", "Punjab Government Servants Housing Scheme",
      "Royal Orchard Sahiwal", "Rafi Gardens", "Pak Avenue Housing Scheme", "New Sahiwal City",
      "Ajwa City", "Al-Janat Housing Scheme", "Grand City Sahiwal", "Fawad Meadows",
      "Al Razzaq City", "Gulshan-e-Zainab", "Al-Haseeb Housing Scheme",
      "Royal Fort Housing Scheme", "Punjab Ghar Housing Scheme", "Capital Canal City",
      "Eden Life Sahiwal",
    ],
  },
];
