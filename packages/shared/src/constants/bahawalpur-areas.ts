import type { AreaZone } from "./area-zone";

/** Bahawalpur neighbourhoods by zone. Not exhaustive: the picker also accepts a typed area. */
export const BAHAWALPUR_ZONES: readonly AreaZone[] = [
  {
    zone: "Main residential areas",
    areas: [
      "Model Town A", "Model Town B", "Model Town C", "Satellite Town", "Civil Lines",
      "Cantt area", "Farid Gate", "Circular Road", "Shahi Bazaar", "Urdu Bazaar", "Trust Colony",
      "Islami Colony", "Shahdara", "Dubai Mahal Road area", "Yazman Road area",
      "Ahmedpur Road area", "Baghdad-ul-Jadeed area", "One Unit Chowk area", "Sadiq Colony",
      "Jhangi Wala Road area", "Muhammadi Colony", "Allama Iqbal Town", "Gulshan-e-Iqbal",
      "Gulberg Colony", "Hashmi Garden", "New Samanabad", "Niaz Colony", "Basti Malook Shah",
      "Tibba Badar Sher", "Kotla Musa Khan", "Noor Mahal Road area", "Railway Colony",
      "Officers Colony", "Peoples Colony", "Shahdara Colony", "Shadab Colony", "Madina Town",
      "Rehman Colony", "Al-Noor Garden", "Dubai Town", "Garden Town",
    ],
  },
  {
    zone: "Housing societies",
    areas: [
      "DHA Bahawalpur", "Model Town Housing Scheme",
      "Government Employees Cooperative Housing Society",
      "Bahawalpur Cooperative Housing Society", "Al-Rehman Garden", "Royal City",
      "City Housing Bahawalpur", "Canal View Housing Scheme", "Jhangi Wala Road housing schemes",
      "Yazman Road housing schemes", "Ahmedpur Road housing schemes",
      "Baghdad-ul-Jadeed residential schemes", "Bahawalpur Bypass housing schemes",
    ],
  },
  {
    zone: "Major roads & markets",
    areas: [
      "Railway Road", "Ahmedpur Road", "Yazman Road", "Jhangi Wala Road", "Noor Mahal Road",
      "Dubai Mahal Road", "Baghdad Road", "Hasilpur Road", "Multan Road", "Bahawalpur Bypass",
      "Dring Stadium Road area", "One Unit Chowk", "Fawara Chowk", "Chowk Bazaar",
      "Model Town A Market", "Model Town B Market", "Satellite Town Market", "Trust Plaza area",
      "University Chowk area",
    ],
  },
  {
    zone: "Surrounding towns",
    areas: [
      "Ahmedpur East", "Yazman", "Hasilpur", "Khairpur Tamewali", "Uch Sharif", "Samasatta",
      "Mubarakpur", "Dera Nawab Sahib", "Lal Sohanra", "Baghdad-ul-Jadeed", "Musafir Khana",
      "Qaimpur", "Khanqah Sharif",
    ],
  },
];
