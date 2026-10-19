import type { AreaZone } from "./area-zone";

/** Rahim Yar Khan neighbourhoods by zone. Not exhaustive: the picker also accepts a typed area. */
export const RAHIM_YAR_KHAN_ZONES: readonly AreaZone[] = [
  {
    zone: "Main residential areas",
    areas: [
      "Abbasia Town", "Abbasia Bungalows", "Gulshan-e-Iqbal", "Gulshan-e-Usman",
      "Gulshan-e-Nasir", "Gulshan-e-Arjmand", "Satellite Town", "Old RYK / Cantt area",
      "Civil Lines", "Officers Colony", "Habib Colony", "Hasan Colony", "Islamia Colony",
      "Islam Nagar", "Noor-e-Wali", "Sakh Sarwar Colony", "Rehman Colony", "Muslim Colony",
      "Bhatta Colony", "Canal Colony", "Canal View area", "Azizabad", "Behar Colony",
      "Shalimar Town", "Saleem Garden", "Rahim Garden", "Khawaja Bungalows", "Adam Sahaba area",
      "Jinnah Park vicinity", "Mohalla Kanjoo", "Gulshan-e-Madina", "Gulshan-e-Fareed",
      "Gulberg Residence", "New Pind area", "Railway Colony", "Labour Colony",
      "Airport Road vicinity",
    ],
  },
  {
    zone: "Housing societies",
    areas: [
      "Abbasia Town Phase 1", "Abbasia Town Phase 2", "Abbasia Town Phase 3", "Canal Avenue",
      "Khainban Ali", "Ittehad City Housing Scheme", "Paradise Housing Scheme",
      "RYK City Housing Scheme", "Garden Avenue Housing Society", "Al-Khair Housing Society",
      "Iqbal Garden", "Punjnad Housing Society", "Haider Town", "WAPDA Colony",
      "Government Employees residential areas",
    ],
  },
  {
    zone: "Major roads & chowks",
    areas: [
      "Abu Dhabi Road", "Khanpur Road", "Airport Road", "Manthar Road", "Shahbazpur Road",
      "Kacha Sadiqabad Road", "Sadiqabad Bypass Road", "Sur Bhuri Road", "Pattan Minara Road",
      "Rahim Yar Khan Bypass", "Hospital Road", "Circular Road", "Canal Road", "Railway Road",
      "Stadium Road", "Shahi Road", "Gulshan Bakery Road", "Laghari Road", "Jinnah Park streets",
      "City Chowk", "DCO Chowk", "DCO East Chowk", "Sadiq Bazaar Chowk", "Sadiq Club Chowk",
      "Lakkar Mandi Chowk", "Railway Chowk", "Wireless Pull Chowk", "Addah Gulmarg Chowk",
      "Theli Chowk",
    ],
  },
  {
    zone: "Surrounding towns",
    areas: [
      "Khanpur", "Sadiqabad", "Liaquatpur", "Zahir Pir", "Kot Samaba", "Iqbalabad",
      "Tranda Saway Khan", "Rukanpur", "Mianwali Qureshian", "Fatehpur Punjabian",
      "Sardar Garh", "Bangla Manthar", "Sheikh Wahan", "Sanni Pull", "Tibbi Laran",
      "Rajanpur Kalan", "Dera Pinnia", "Abu Dhabi Road Chak 85/P", "Chak 105/P", "Chak 110/P",
    ],
  },
];
