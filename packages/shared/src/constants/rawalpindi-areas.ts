import { blocks, phases, type AreaZone } from "./area-zone";

/** Rawalpindi neighbourhoods by zone. Not exhaustive: the picker also accepts a typed area. */
export const RAWALPINDI_ZONES: readonly AreaZone[] = [
  {
    zone: "Old city & Saddar",
    areas: [
      "Saddar", "Raja Bazaar", "Liaquat Bagh", "Committee Chowk", "Kohati Bazaar",
      "Banni", "Moti Bazaar", "Bohar Bazaar", "Gawalmandi", "Waris Khan",
      "Pir Wadhai", "Dhok Ratta", "Mohanpura", "Arya Mohalla", "Kurti Road",
      "Lalkurti", "Mall Road", "Haider Road", "Bank Road",
    ],
  },
  {
    zone: "Satellite Town & Murree Road",
    areas: [
      "Satellite Town", ...blocks("Satellite Town Block", "ABCDEF"),
      "Commercial Market", "Murree Road", "6th Road", "Rehmanabad", "Chandni Chowk",
      "Shamsabad", "Faizabad", "Dhok Kala Khan", "Dhok Hassu", "Khayaban-e-Sir Syed",
      "Muslim Town", "Sadiqabad", "Allama Iqbal Colony", "Dhok Elahi Bakhsh", "Asghar Mall Road",
    ],
  },
  {
    zone: "Cantt & Chaklala",
    areas: [
      "Rawalpindi Cantt", "Chaklala Cantt", "Chaklala Scheme I", "Chaklala Scheme II",
      "Chaklala Scheme III", "Lalazar", "Range Road", "Tulsa Road", "Westridge I",
      "Westridge II", "Westridge III", "Harley Street", "Defence Road", "Askari 14",
      "Askari 13", "Askari 11", "Askari 10", "Askari 7", "Askari 6", "Askari 1",
      "Gulistan Colony", "Gulraiz", "Gulzar-e-Quaid", "Afshan Colony", "Morgah", "Tench Bhatta",
    ],
  },
  {
    zone: "Bahria Town & DHA",
    areas: [
      ...phases("Bahria Town Phase", 8),
      "Bahria Garden City", "Safari Villas", "Bahria Intellectual Village",
      "DHA Rawalpindi", "Defence Residency", "Gulshan Abad", "Car Chowk",
    ],
  },
  {
    zone: "Adiala, Chakri & Peshawar Road",
    areas: [
      "Adiala Road", "Chakri Road", "Dhamial", "Peshawar Road", "Misrial Road",
      "Gorakhpur", "Naseerabad", "Kamalabad", "Gulshan-e-Iqbal", "Fazal Town",
      "Al-Noor Colony", "Shah Khalid Colony", "Jhanda Chichi",
    ],
  },
  {
    zone: "Rawat, GT Road & Airport",
    areas: [
      "Rawat", "GT Road", "Kuri Road", "Islamabad Airport Road", "Airport Housing Society",
      "Gulshan Dadan Khan", "Koral Chowk", "Sihala", "Kalyal", "Chak Beli Khan Road",
    ],
  },
];
