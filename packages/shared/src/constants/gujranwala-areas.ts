import type { AreaZone } from "./area-zone";

/** Gujranwala neighbourhoods by zone. Not exhaustive: the picker also accepts a typed area. */
export const GUJRANWALA_ZONES: readonly AreaZone[] = [
  {
    zone: "Main residential areas",
    areas: [
      "Satellite Town", "Model Town", "Civil Lines", "Peoples Colony", "Garden Town",
      "Wapda Town", "Muslim Town", "Faisal Colony", "Sui Gas Road area", "DC Colony", "Rahwali",
      "Gondlanwala", "Eminabad Road area", "Garjakh", "Baghbanpura", "Dhulley", "Aroop",
      "Khiali Shahpur", "Shaheenabad", "Farid Town", "Shalimar Town", "Kashmir Colony",
      "Rehman Colony", "Islam Pura", "Mubarak Shah Road area", "Sheikhupura Road area",
      "Sialkot Road area", "Pasrur Road area", "Nowshera Road area", "Kangniwala",
      "Pindi Bypass area", "Chanda Qila area", "Chan Da Qila", "Jinnah Road area",
      "Gondlanwala Road area", "Hafizabad Road area", "Ferozwala", "Kotli Rustam", "Kot Ishaq",
      "Talwandi Rahwali",
    ],
  },
  {
    zone: "Housing societies",
    areas: [
      "Citi Housing Gujranwala", "Master City Housing Scheme", "Royal Palm City",
      "Canal View Housing Scheme", "Green Valley", "Fazaia Housing Scheme",
      "Model Town Cooperative Housing Society", "Gujranwala Development Authority (GDA) City",
      "Johar Town", "Al Haram City", "Palm City", "DHA Gujranwala", "University Town",
      "Etihad Town", "New Satellite Town", "Al Rehman Garden", "Al Noor Town", "Al Qaim City",
      "Canal Fort Gardens", "Chenab Gardens", "Citi Housing Extension", "City Housing Phase 2",
      "Master City Extension", "Shaheenabad Housing Scheme", "Gulshan Iqbal Colony",
      "Officers Colony", "Civil Lines Colony", "Canal Park", "Punjab Society", "Madina City",
      "Faisal Town", "Ali Town", "Hassan Pura Housing Scheme", "Awan Town",
    ],
  },
  {
    zone: "Major roads & markets",
    areas: [
      "GT Road (Grand Trunk Road)", "Sialkot Road", "Hafizabad Road", "Sheikhupura Road",
      "Pasrur Road", "Eminabad Road", "Sui Gas Road", "Gondlanwala Road", "Nowshera Road",
      "DC Road", "G.T. Road bypass", "Pindi Bypass", "Jinnah Road", "Satellite Town Market",
      "Model Town Market", "Main Bazar", "Rail Bazar", "Urdu Bazar", "Trust Plaza area",
      "Kangniwala Bypass", "Rahwali Cantonment area",
    ],
  },
  {
    zone: "Surrounding towns",
    areas: [
      "Wazirabad", "Kamoke", "Eminabad", "Nowshera Virkan", "Qila Didar Singh", "Ghakhar Mandi",
      "Sadhoke", "Ladhewala Waraich", "Tatley Aali", "Sohdra", "Ali Pur Chatha", "Rasul Nagar",
      "Kalaske", "Noshera Sansi", "Chicharwali",
    ],
  },
];
