import type { AreaZone } from "./area-zone";

/** Multan neighbourhoods by zone. Not exhaustive: the picker also accepts a typed area. */
export const MULTAN_ZONES: readonly AreaZone[] = [
  {
    zone: "Main residential areas",
    areas: [
      "Gulgasht Colony", "Multan Cantt", "Shah Rukn-e-Alam Colony", "Zakariya Town",
      "Shalimar Colony", "New Shalimar Colony", "Madina Town", "Mumtazabad", "New Multan Colony",
      "Gulshan-e-Madina", "Jalilabad", "Bosan", "Bahadurpur", "Khalid Colony", "New Sadiqabad",
      "Officers Colony", "Muslim Town", "Satellite Town", "Model Town", "Shah Faisal Colony",
      "Gulberg Colony", "Jinnah Town", "Faisal Colony", "Rashidabad", "Zahid Town",
      "Mushtaq Colony", "Iftikhar Colony", "Qaisarabad", "Ahamdpura", "Shahsabswar Colony",
      "Sabzazar Colony", "Hameedan Colony", "Mohsin Town", "Mian Town", "Nasheman Colony",
      "Basti Daira", "Dastagirpur Colony", "Gulistan-e-Zahra Colony", "Justice Hamid Colony",
      "Meharban Colony", "Jalki Colony", "Calro Colony",
    ],
  },
  {
    zone: "Housing societies",
    areas: [
      "DHA Multan", "WAPDA Town Phase 1", "WAPDA Town Phase 2", "Fatima Jinnah Town",
      "Citi Housing Multan", "Royal Orchard", "Buch Executive Villas", "Dream Garden",
      "MDA Cooperative Housing Society", "MDA Officers Cooperative Housing Society",
      "Punjab Government Servants Housing Foundation", "PIA Employees Housing Society",
      "Green View Housing Scheme", "Canal Garden", "Garden Town", "Green Fort Housing Scheme",
      "Al Quresh Housing Scheme", "Al Falah Modern City", "Officers Town", "Pearl City",
      "Rasheedabad", "Suraj Miani", "Adams Housing", "Al Noor City", "Cantt Avenue Housing Scheme",
      "Eastern Housing", "Sun City Housing", "Smart Housing Multan", "Multan Golf City",
      "Icon Villas", "Royal Grace City", "Al-Rehman Garden", "City Villas", "BZU Employees Colony",
      "Sunshine Housing", "Gulshan-e-Wahid", "Sahar Villas", "Model Town Block A",
    ],
  },
  {
    zone: "Major roads & chowks",
    areas: [
      "Bosan Road", "Multan Public School Road", "Vehari Road", "Khanewal Road", "Mattital Road",
      "Northern Bypass", "Southern Bypass", "Bahawalpur Road", "Shujabad Road",
      "Purana Shujabad Road", "Sher Shah Road", "LMQ Road", "Abdali Road", "M.A. Jinnah Road",
      "Mumtazabad Road", "Gulgasht Road", "Nishtar Road", "Bahauddin Zakariya University Road",
      "Nag Shah Chowk area", "Vehari Chowk area", "MDA Chowk area", "Dera Adda",
      "Chowk Kumharanwala", "Chowk Shah Abbas", "Chowk Rasheedabad",
    ],
  },
  {
    zone: "Surrounding towns",
    areas: [
      "Shujabad", "Jalalpur Pirwala", "Sher Shah", "Qadirpur Rawan", "Basti Malook",
      "Budhla Sant", "Mattital", "Nawabpur", "Lutfabad", "Muzaffarabad", "Qasba Maral",
      "Khan Village", "Sui Mian", "Piran Ghaib", "Sahian Chawan", "Band Bosan",
    ],
  },
];
