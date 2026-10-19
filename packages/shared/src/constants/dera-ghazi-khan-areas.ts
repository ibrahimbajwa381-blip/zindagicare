import type { AreaZone } from "./area-zone";

/** Dera Ghazi Khan neighbourhoods by zone. Not exhaustive: the picker also accepts a typed area. */
export const DERA_GHAZI_KHAN_ZONES: readonly AreaZone[] = [
  {
    zone: "Main residential areas",
    areas: [
      "Model Town", "Model Town Extension", "Satellite Town", "Civil Lines", "Officers Colony",
      "Fareed Abad", "Indus Colony", "Shakoorabad Colony", "Ghazi Colony",
      "Gulshan-e-Ijaz Colony", "Gulshan-e-Ejaz", "Khayaban-e-Sarwar", "Khayaban-e-Waqar",
      "Gadai", "Gadai Shumali", "Gadai Shumali Extension", "Gadai Gharbi", "Churhatta",
      "Churhatta Sindh Shumali", "Churhatta Sindh Janubi", "Basti Buzdar", "Basti Malana",
      "Basti Damba", "Basti Qaisrani", "Railway Road area", "College Road area",
      "New College Road area", "Saddar Bazaar area", "Liaqat Bazaar area", "Pathar Bazaar area",
      "Faridi Bazaar area", "Multan Road area", "Taunsa Road area", "Jampur Road area",
      "Board Road area", "Hospital Road area", "Jail Road area",
    ],
  },
  {
    zone: "Housing societies",
    areas: [
      "New Defence View Housing Scheme", "Garden Town Housing Scheme", "Gulberg Town",
      "Gulberg Town Phase II", "Gulberg Town Phase III", "Apna Ghar", "Dream Garden",
      "Usmania Village", "Royal Defence View", "Royal Defence View Phase III",
      "Defence Garden Housing Scheme", "Adams Housing Scheme", "Adams Housing Scheme Extension",
      "City Garden DG Khan", "City Garden Extension", "Canal City Housing Society",
      "Sana Valley Society", "National Housing Society", "Gulshan-e-Ejaz Housing Scheme",
      "Ghazi Cottages", "Royal Orchard Enclave", "Urban City", "Al-Fakhar Town",
      "Al-Inam Garden", "Green Garden", "Zam Zam City", "Dream City", "Smart Villas",
      "Usmania Village Extension", "T.K. Garden Housing Scheme",
      "Punjab Government Servants Housing Foundation (PGSHF) Scheme",
    ],
  },
  {
    zone: "Major roads & markets",
    areas: [
      "Multan Road", "Taunsa Road", "Jampur Road", "Board Road", "Jail Road", "College Road",
      "New College Road", "Railway Road", "Hospital Road", "Dera Ghazi Khan Bypass",
      "Indus Highway corridor", "Liaqat Bazaar", "Saddar Bazaar", "Pathar Bazaar",
      "Faridi Bazaar", "Grain Market area", "Vegetable Market area", "General Bus Stand area",
      "Railway Station area", "Chowk Churhatta", "Khuda Bakhsh Chowk", "Gidar Wali Bypass",
      "Manka Canal area",
    ],
  },
  {
    zone: "Surrounding towns",
    areas: [
      "Taunsa Sharif", "Kot Chutta", "Sakhi Sarwar", "Shadan Lund", "Vehova", "Fort Munro",
      "Choti Zareen", "Jampur", "Kala", "Shah Sadar Din", "Kot Mubarak", "Yaroo",
      "Tibbi Qaisrani", "Haji Ghazi", "Aqalpur", "Mangrotha",
    ],
  },
];
