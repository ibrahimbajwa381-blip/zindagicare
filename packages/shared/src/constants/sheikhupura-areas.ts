import type { AreaZone } from "./area-zone";

/** Sheikhupura neighbourhoods by zone. Not exhaustive: the picker also accepts a typed area. */
export const SHEIKHUPURA_ZONES: readonly AreaZone[] = [
  {
    zone: "Main residential areas",
    areas: [
      "Civil Lines", "Housing Colony", "Farooqabad Road area", "Lahore Road area",
      "Sargodha Road area", "Jandiala Road area", "Sharaqpur Road area", "Faisalabad Road area",
      "Stadium Road area", "Rehmanpura", "Nabi Pura", "Rasool Pura", "Kot Abdul Malik Road area",
      "Bhikhi Road area", "Hiran Minar Road area", "Tariq Road area", "Jinnah Park vicinity",
      "Ghazi Minara area", "New Civil Lines", "Mandi Faizabad Road area", "Sharifpura",
      "Madina Colony", "Muslim Ganj", "Mohalla Ahmadpura", "Mohalla Pir Bahar Shah",
      "Mohalla Jandiala", "Mohalla Kacha Shahab", "Mohalla Islampura", "Mohalla Nizam Pura",
      "Mohalla Farooq Ganj", "Mohalla Ghang Road", "Mohalla Qila Sattar Shah",
      "Mohalla Warburton Road", "Mohalla Mian Ali", "Mohalla Hakeem Mumtaz",
      "Mohalla Chah Jandiala", "Mohalla Shama Colony",
    ],
  },
  {
    zone: "Housing societies",
    areas: [
      "Sheikhupura Housing Colony", "Sheikhupura Cooperative Housing Society",
      "Al-Rehman Garden", "Al-Noor Garden", "Canal View Housing Scheme", "Model City",
      "New Model City", "Eden Housing Scheme", "Madina Town", "Green Town", "Officers Colony",
      "Government Employees Housing Scheme", "Railway Colony", "WAPDA Colony", "Labour Colony",
      "Farooqabad Housing Scheme", "Sharaqpur Road housing schemes",
      "Lahore Road housing schemes", "Faisalabad Road housing schemes",
      "Sargodha Road housing schemes", "Hiran Minar Road residential schemes",
      "Kot Abdul Malik residential schemes", "Bhikhi residential schemes",
      "Ferozewala residential schemes",
    ],
  },
  {
    zone: "Major roads & markets",
    areas: [
      "Lahore Road", "Sargodha Road", "Faisalabad Road", "Jandiala Road", "Sharaqpur Road",
      "Farooqabad Road", "Hiran Minar Road", "Bhikhi Road", "Mandi Faizabad Road",
      "Kot Abdul Malik Road", "Stadium Road", "Tariq Road", "Railway Road", "Circular Road",
      "Main Bazaar", "Jinnah Park area", "Railway Station vicinity", "General Bus Stand area",
      "Civil Lines market", "Hiran Minar vicinity",
    ],
  },
  {
    zone: "Surrounding towns",
    areas: [
      "Farooqabad", "Ferozewala", "Kot Abdul Malik", "Muridke", "Sharaqpur Sharif",
      "Safdarabad", "Khanqah Dogran", "Narang Mandi", "Mananwala", "Bhikhi",
      "Jandiala Sher Khan", "Qila Sattar Shah", "Warburton", "Kala Shah Kaku", "Faizpur",
      "Sacha Soda",
    ],
  },
];
