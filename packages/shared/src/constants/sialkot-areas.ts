import type { AreaZone } from "./area-zone";

/** Sialkot neighbourhoods by zone. Not exhaustive: the picker also accepts a typed area. */
export const SIALKOT_ZONES: readonly AreaZone[] = [
  {
    zone: "Main residential areas",
    areas: [
      "Model Town", "New Model Town", "Miana Pura", "New Mianapura", "Neka Pura", "Shahabpura",
      "Rangpura", "Adalat Garh", "Puran Nagar", "Lahori Shah", "Muhammad Pura", "Prem Nagar",
      "Gohadpur", "Hajipura", "Khadim Ali Road area", "Kashmir Road area", "Daska Road area",
      "Cantt area", "Paris Road area", "Kutchery Road area", "Waterworks area",
      "Capital Road area", "Iqbal Town", "Latif Colony", "Zeeshan Colony", "Madina Colony",
      "Gulshan-e-Azeem Town", "Khokhar Town", "Umer Town", "Toheed Town", "Mag Town",
      "Aziz Town", "Gulistan Colony", "Habib Pura", "Akbarabad", "Kotli area", "Kakaywali",
      "Pacca Garha", "Miana Town",
    ],
  },
  {
    zone: "Housing societies",
    areas: [
      "Citi Housing Society", "Citi Housing Society Block A", "Citi Housing Society Block B",
      "Citi Housing Society Block C", "Citi Housing Society Block E", "Askari 1", "Askari 2",
      "Cantt View Colony", "Cantt Model Villas", "Kent Housing Society",
      "Nasheman Housing Scheme", "Airport Avenue Housing Society", "Sial Housing",
      "Silk City Housing Society", "Al Noor Town", "Azhar Town", "Aziz Garden", "MB Villas",
      "Chenab Farm Houses", "Model Town Cooperative Housing Society", "Ajmal Garden Colony",
      "Bilal Colony", "Bilal Garden", "Kashmir Villas", "Robi Villas", "Canal View Colony",
      "Punjab Colony", "Saif Town", "Jalal Town", "Mian Safdar Town", "Mian Saeed Town",
      "Abu Bakar Town", "Sahib Town", "Happy Valley", "Rana Tariq Town",
      "Toheed Town, Rehmanpur", "Gohadpur Model Town", "Agha Nadeem Khan Housing",
      "Muhammad Adnan Model Town",
    ],
  },
  {
    zone: "Major roads",
    areas: [
      "Kashmir Road", "Daska Road", "Wazirabad Road", "Airport Road", "Khadim Ali Road",
      "Defence Road", "Hajipura Road", "Pasrur Road", "Marala Road", "Shahabpura Road",
      "Rangpura Road", "Aimanabad Road", "Cantt Road", "Chenab Rangers Road",
      "Aziz Bhatti Shaheed Road", "Kutchery Road", "Paris Road", "Nasir Road",
      "Prem Nagar Road", "Capital Road", "Railway Road", "Commissioner Road",
      "Small Industrial Estate area",
    ],
  },
  {
    zone: "Surrounding towns",
    areas: [
      "Daska", "Sambrial", "Pasrur", "Ugoki", "Head Marala", "Kotli Loharan", "Chawinda",
      "Badiana", "Bhopalwala", "Aimanabad", "Sahowala", "Madharian Wala Kalar",
      "Jandiala Sher Khan", "Bhalowali", "Kakrali", "Bharath", "Langraywali", "Jallianwala",
      "Moman", "Kotli Behram",
    ],
  },
];
