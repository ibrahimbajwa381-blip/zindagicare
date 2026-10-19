import type { AreaZone } from "./area-zone";

/** Sargodha neighbourhoods by zone. Not exhaustive: the picker also accepts a typed area. */
export const SARGODHA_ZONES: readonly AreaZone[] = [
  {
    zone: "Main residential areas",
    areas: [
      "Satellite Town", "Model Town", "University Road area", "Civil Lines", "Officers Colony",
      "Farooq Colony", "Gulshan-e-Jamal", "Gulshan-e-Iqbal", "Iqbal Colony", "Rehman Colony",
      "New Satellite Town", "Muslim Town", "Shalimar Town", "Tariqabad", "Liaquatabad",
      "Islampura", "Mujahid Colony", "Khayaban-e-Naveed", "Green Town", "50 Chak area",
      "47 Pull area", "49 Tail area", "78 North area", "91 North area", "Aziz Bhatti Town",
      "Qainchi Mor area", "Awan Colony", "Queens Road area",
      ..."ABCDEFGHIJKLMNOP".split("").map((block) => `Block ${block}`),
    ],
  },
  {
    zone: "Housing societies",
    areas: [
      "University Town", "Royal Orchard Sargodha", "Citi Housing Sargodha", "Al-Rehman Garden",
      "Al-Noor Garden", "Green Valley", "Faisalabad Road housing schemes",
      "Lahore Road housing schemes", "Khushab Road housing schemes",
      "Bhalwal Road housing schemes", "Chak 47 housing schemes", "Chak 49 housing schemes",
      "Canal View housing schemes", "Qainchi Mor residential schemes",
      "Awan Colony residential area", "Farooq Colony residential area",
    ],
  },
  {
    zone: "Major roads & markets",
    areas: [
      "University Road", "Faisalabad Road", "Lahore Road", "Khushab Road", "Bhalwal Road",
      "Mianwali Road", "Kachehri Road", "Queens Road", "Club Road", "Fatima Jinnah Road",
      "Railway Road", "Stadium Road", "Sillanwali Road", "47 Pull", "Qainchi Mor",
      "Kachehri Bazaar", "Amin Bazaar", "Urdu Bazaar", "Gol Chowk", "Company Bagh area",
      "General Bus Stand area", "Sargodha Railway Station area",
    ],
  },
  {
    zone: "Surrounding towns",
    areas: [
      "Bhalwal", "Sillanwali", "Shahpur", "Kot Momin", "Sahiwal, Sargodha District", "Bhera",
      "Farooka", "Phularwan", "Miani", "Jhawarian", "49 Tail", "Chak 47", "Chak 78 North",
      "Chak 91 North", "Lalian Road settlements", "Sargodha Cantonment area",
    ],
  },
];
