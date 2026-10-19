import type { AreaZone } from "./area-zone";

/** Larkana neighbourhoods by zone. Not exhaustive: the picker also accepts a typed area. */
export const LARKANA_ZONES: readonly AreaZone[] = [
  {
    zone: "Main residential areas",
    areas: [
      "Sachal Colony", "Ali Goharabad", "Lahori Muhalla", "Waleed", "Dokri Road area",
      "Station Road area", "Resham Gali", "Pakistan Chowk area", "Jinnah Bagh area",
      "Civil Lines", "Larkana City Centre", "Bakrani Road area", "Naudero Road area",
      "Ratodero Road area", "Qambar Road area", "Miro Khan Road area", "Khairpur Road area",
      "Garhi Khuda Bakhsh Road area", "Shahi Bazaar", "Shah Nawaz Bhutto Road area",
      "Bhutto Nagar", "Rehmatpur", "Allahabad", "Dhamrah Road area",
      "Chandka Medical College vicinity", "Chandka Hospital vicinity", "Qafila Serai area",
      "Hyderi Muhalla", "Gajanpur", "Eid Gah area", "Ameerabad", "Sirai Muhalla",
      "Khokhar Muhalla", "Gharibabad", "Gharibabad Colony", "Hassan Wali", "Bahman",
      "Ali Murad Muhalla",
    ],
  },
  {
    zone: "Colonies & housing schemes",
    areas: [
      "Rehmatpur Colony", "Allahabad Colony", "Ameerabad Colony", "Chandka Housing Scheme",
      "Larkana Cooperative Housing Society", "WAPDA Colony", "Railway Colony",
      "Police Line Colony", "Teachers Colony", "Officers Colony", "Labour Colony",
      "Irrigation Colony", "Local Government Employees Colony", "New Larkana Housing Scheme",
      "Bakrani Road residential schemes", "Naudero Road residential schemes",
      "Ratodero Road residential schemes", "Qambar Road residential schemes",
    ],
  },
  {
    zone: "Major roads & markets",
    areas: [
      "Station Road", "Bakrani Road", "Naudero Road", "Ratodero Road", "Qambar Road",
      "Miro Khan Road", "Khairpur Road", "Dhamrah Road", "Dokri Road", "Shah Nawaz Bhutto Road",
      "Jinnah Bagh Road", "Pakistan Chowk", "Lahori Muhalla market", "Sachal Colony Road",
      "Chandka Medical College Road", "Main Bus Stand area", "Railway Station area",
      "Jinnah Bagh vicinity", "Civil Hospital area",
    ],
  },
  {
    zone: "Surrounding towns",
    areas: [
      "Naudero", "Ratodero", "Dokri", "Bakrani", "Garhi Khuda Bakhsh", "Bangul Dero", "Badah",
      "Miro Khan", "Qambar", "Shahdadkot", "Warah", "Radhan", "Madeji", "Dhamrah",
      "Ketti Mumtaz", "Jumo Agham", "Sijawal Junejo",
    ],
  },
];
