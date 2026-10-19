import type { AreaZone } from "./area-zone";

/** Jhang neighbourhoods by zone. Not exhaustive: the picker also accepts a typed area. */
export const JHANG_ZONES: readonly AreaZone[] = [
  {
    zone: "Main residential areas & mohallas",
    areas: [
      "Satellite Town", "Satellite Town Block A", "Satellite Town Block B",
      "Satellite Town Block Z", "Civil Lines", "Purana Bagh", "Choudhary Colony", "Rana Colony",
      "Qadri Colony", "Canal Colony", "Shadab Colony", "Sultan Colony", "Malik Colony",
      "Ehsan Colony", "Elahi Bakhsh Colony", "Millat Colony", "Farooqabad", "Iqbal Nagar",
      "Siddique Abad", "Islam Nagar", "Islam Wala", "Rao Colony", "Baig Colony", "Qassmi Colony",
      "Milat Colony", "Gulshan-e-Fatima", "Bismillah Colony", "Pathan Colony", "Noor Shah",
      "Noor Pura", "Yousaf Abad", "Jalal Abad", "Pindi Mohalla", "Hussain Abad",
      "Mohalla Bagh Wala", "Mohalla Hassnana", "Mohalla Ghausia", "Mohalla Mohammadi",
      "Mohalla Daood Shah", "Mohalla Akbar Pura", "Mohalla Sultan Wala", "Mohalla Siddiquia",
      "Mohalla Rizwan-ur-Rasool", "Mohalla Monshian Wala", "Mohalla Aarian Wala",
      "Mohalla Bubranna", "Mohalla Kapayian", "Mohalla Dhup-Sari", "Mohalla Block Shah",
      "Tiba Ragistan", "Basti Ghogha Wali", "Basti Diwan Wali", "Basti Lakhi",
      "Basti Faiz Abad", "Basti Sultan Wali", "Basti Hermal Pur",
    ],
  },
  {
    zone: "Housing societies",
    areas: [
      "Jhang Residencia", "Pak Residencia", "Government Employees Housing Society",
      "Etihad Supreme City", "Paradise City", "Palm Villas Phase 1", "Ali Garden",
      "Green Wood City", "Sayaban Avenue", "PGSHF Scheme", "Canal View", "Housing Colony",
      "Low Income Housing Scheme", "3-Marla Scheme, Satellite Town", "WAPDA Colony",
      "Officers Colony", "Railway Colony", "Gulshan-e-Fatima Colony",
    ],
  },
  {
    zone: "Major roads & markets",
    areas: [
      "Chiniot Road", "Faisalabad Road", "Toba Tek Singh Road", "Sargodha Road", "Bhakkar Road",
      "Multan Road", "Old Chiniot Road", "Dar-ul-Sakina Road", "Canal Road", "Gojra Road",
      "Bab-e-Umer Road", "Shah Kabeer Road", "Noor Shah Road", "Sabzi Mandi Road",
      "Old Railway Road", "Kacha Railway Road", "Civil Lines Road", "Farooq Azam Road",
      "Toba Road", "Jhang Bazaar", "Main Bazaar", "Chambeli Market", "Milad Chowk",
      "Tanga Adda", "Ayub Chowk", "Nasir Chowk", "General Bus Stand area",
      "Railway Station area",
    ],
  },
  {
    zone: "Surrounding towns",
    areas: [
      "Jhang Sadar", "Shorkot", "Ahmadpur Sial", "Athara Hazari", "Garh Maharaja",
      "Chund Bharwana", "Mandi Shah Jewana", "Shah Jewana", "Mochiwala", "Maddoki",
      "Kot Sigh Singh", "Rodu Sultan", "Hassu Balail", "Bagh", "Qaim Bharwana", "Wasu Astana",
      "Kot Isa Shah", "Sultan Bahu", "Massan", "Trimmu",
    ],
  },
];
