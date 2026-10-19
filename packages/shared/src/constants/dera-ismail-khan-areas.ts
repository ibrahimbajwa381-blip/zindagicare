import type { AreaZone } from "./area-zone";

/** Dera Ismail Khan neighbourhoods by zone. Not exhaustive: the picker also accepts a typed area. */
export const DERA_ISMAIL_KHAN_ZONES: readonly AreaZone[] = [
  {
    zone: "Main areas",
    areas: [
      "City Centre", "Topanwala Bazaar", "Bannu Road", "Tank Road", "Peshawar Road",
      "Darya Khan Road", "Circular Road", "Kachehri Road", "Railway Road", "University Road",
      "Indus Highway area", "Paroa Road area", "Maddi Road area", "Chashma Road side",
      "Muslim Bazaar", "Sabzi Mandi area", "GPO area", "Committee Chowk area", "Nawab Bazaar",
      "Zafarabad",
    ],
  },
  {
    zone: "Colonies & residential areas",
    areas: [
      "D.I. Khan Township", "Model Town", "Officers Colony", "Cantt area", "Muslim Town",
      "Jinnah Colony", "Rehman Colony", "Gulshan-e-Iqbal", "University Town", "New City area",
    ],
  },
  {
    zone: "Housing societies",
    areas: [
      "D.I. Khan New City", "Government Employees housing area", "Township residential blocks",
      "University Road residential schemes",
    ],
  },
];
