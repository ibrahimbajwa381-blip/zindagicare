import { phases, type AreaZone } from "./area-zone";

/** Islamabad sectors and societies by zone. Not exhaustive: the picker also accepts a typed area. */
export const ISLAMABAD_ZONES: readonly AreaZone[] = [
  {
    zone: "E & F sectors",
    areas: [
      "E-7", "E-8", "E-9", "E-11", "E-12",
      "F-5", "F-6", "F-7", "F-8", "F-10", "F-11", "F-15", "F-17",
      "Jinnah Super Market", "Super Market (F-6)", "Kohsar Market",
      "Gulshan-e-Khudadad", "Police Foundation (E-11)",
    ],
  },
  {
    zone: "G & H sectors",
    areas: [
      "G-5", "G-6", "G-7", "G-8", "G-9", "G-10", "G-11", "G-12", "G-13", "G-14", "G-15", "G-16",
      "H-8", "H-9", "H-11", "H-12", "H-13",
      "Aabpara", "Melody Market", "Sitara Market", "Karachi Company", "Peshawar Mor",
    ],
  },
  {
    zone: "I sectors & industrial",
    areas: [
      "I-8", "I-9", "I-10", "I-11", "I-12", "I-14", "I-15", "I-16",
      "Khanna Pul", "Faizabad",
    ],
  },
  {
    zone: "Central & diplomatic",
    areas: [
      "Blue Area", "Jinnah Avenue", "Constitution Avenue", "Diplomatic Enclave",
      "Shakarparian", "Saidpur Village", "Nurpur Shahan", "Margalla Town",
    ],
  },
  {
    zone: "Park Road & Bani Gala",
    areas: [
      "Bani Gala", "Bhara Kahu", "Park Road", "Chak Shahzad", "Shahzad Town",
      "Tarlai", "Alipur Farash", "Kuri Road", "Rawal Town", "Malpur",
      "Lehtrar Road", "Sihala", "Humak", "Islamabad Expressway",
    ],
  },
  {
    zone: "Zone V & Expressway societies",
    areas: [
      ...phases("DHA Phase", 5),
      "Bahria Enclave", "Gulberg Greens", "Gulberg Residencia",
      "PWD Housing Society", "Pakistan Town", "Korang Town", "Soan Garden",
      "Naval Anchorage", "CBR Town", "Police Foundation (O-9)", "National Police Foundation",
      "Ghauri Town", "Jinnah Garden", "Media Town", "Airport Housing Society",
      "Defence Residency", "Engineers Cooperative Housing Society",
    ],
  },
  {
    zone: "D, B & West Islamabad",
    areas: [
      "D-12", "D-17", "B-17", "Multi Gardens (B-17)", "Top City-1",
      "Golra Sharif", "Tarnol", "Sangjani", "Mumtaz City", "Faisal Town",
      "Shah Allah Ditta", "Margalla View Housing Society",
    ],
  },
];
