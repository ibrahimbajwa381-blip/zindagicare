import type { AreaZone } from "./area-zone";

/** Hyderabad (Sindh) neighbourhoods by zone. Not exhaustive: the picker also accepts a typed area. */
export const HYDERABAD_ZONES: readonly AreaZone[] = [
  {
    zone: "Main residential areas",
    areas: [
      ...Array.from({ length: 12 }, (_, i) => `Latifabad Unit ${i + 1}`),
      "Qasimabad", "Citizen Colony", "Wadhu Wah Road area", "Naseem Nagar", "Sehrish Nagar",
      "Abdullah Garden", "Hirabad", "Heerabad", "Gari Khata", "Pakka Qila", "Market Tower area",
      "Saddar", "Cantonment area", "Tando Agha", "Paretabad", "Phulelli", "Hala Naka",
      "Ghangra Mori", "SITE Area", "Auto Bhan Road area", "Jamshoro Road area", "Thandi Sarak",
      "Station Road area", "Tilak Incline", "Shahi Bazar", "Resham Gali", "Risala Road area",
      "Soldier Bazaar", "Pathan Colony", "Afghan Colony", "Gulshan-e-Sajjad",
      "Gulistan-e-Sarmast", "Bhitai Town", "Al Raheem Shopping Centre vicinity",
    ],
  },
  {
    zone: "Housing societies",
    areas: [
      "Mehran Housing Society", "Al-Rehman Housing Society", "Al-Mustafa Town",
      "Al-Habib Housing Society", "Royal City", "New Hyderabad City", "Kohsar", "Palm Enclave",
      "Defence Housing Society", "Officers Colony", "Labour Colony",
      "Sindh University Employees Cooperative Housing Society", "Isra Village",
      "Gulshan-e-Fatima", "Madina City", "Al-Aziz City", "Al-Noor Garden",
      "Qasimabad extensions", "Wadhu Wah residential schemes", "Hala Naka residential schemes",
      "Jamshoro Road housing schemes",
    ],
  },
  {
    zone: "Major roads & markets",
    areas: [
      "Auto Bhan Road", "Jamshoro Road", "Hala Naka Road", "Wadhu Wah Road",
      "Qasimabad Main Road", "Latifabad Unit 7 Road", "Latifabad Unit 8 Road",
      "Latifabad Unit 10 Road", "Latifabad Unit 11 Road", "Station Road", "Risala Road",
      "Saddar Road", "Hirabad Road", "Tando Agha Road", "Phulelli Road", "Market Tower",
      "Heerabad Market", "Cantonment Market", "SITE Industrial Area",
    ],
  },
  {
    zone: "Surrounding towns",
    areas: [
      "Kotri", "Jamshoro", "Hattri", "Tando Jam", "Tando Allahyar", "Matiari", "Hala",
      "Tando Qaiser", "Husri", "Bhanoth", "Bulri Shah Karim", "Odero Lal", "Shahdadpur",
      "Saeedabad",
    ],
  },
];
