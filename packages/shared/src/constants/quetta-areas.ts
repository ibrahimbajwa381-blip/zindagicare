import type { AreaZone } from "./area-zone";

/** Quetta neighbourhoods by zone. Not exhaustive: the picker also accepts a typed area. */
export const QUETTA_ZONES: readonly AreaZone[] = [
  {
    zone: "Main residential areas",
    areas: [
      "Jinnah Town", "Shahbaz Town", "Model Town", "Model Town Extension", "Satellite Town",
      "Samungli", "Sariab", "Sariab Road area", "Brewery Road area", "Zarghoon Road area",
      "Chaman Housing Scheme", "Chiltan Housing Scheme", "Nawa Killi", "Hazara Town",
      "Pashtunabad", "Killi Shabo", "Killi Kamalo", "Killi Ismail", "Killi Deba",
      "Killi Bangulzai", "Kasi Road area", "Kharotabad", "Airport Road area",
      "Kuchlak Road area", "Western Bypass area", "Eastern Bypass area", "Toghi Road area",
      "Mecongi Road area", "Joint Road area", "Arbab Karam Khan Road area", "Brewery area",
    ],
  },
  {
    zone: "Colonies & housing schemes",
    areas: [
      "Zarghoon Housing Scheme", "Takhtani Housing Scheme", "Kirani Housing Scheme",
      "Shalkot Housing Scheme", "Darakhshan Housing Scheme", "QDA Enclave",
      "Chiltan Extension Housing Scheme", "Rakhshan Housing Scheme",
      "Low Cost Housing, Sirki Road", "Samungli Housing Scheme",
      "PHAF Housing Scheme, Kuchlak Road", "DHA Quetta", "Chiltan Homes", "Umar Homes",
      "Quetta Avenue", "Blue Enclave", "Qasim Bagh Town", "Jan Town", "Toghi Housing Scheme",
      "Abdali Housing Scheme", "Gulistan Town", "Madrissa Road Housing Scheme",
    ],
  },
  {
    zone: "Major roads & bazaars",
    areas: [
      "Jinnah Road", "Zarghoon Road", "Sariab Road", "Samungli Road", "Airport Road",
      "Brewery Road", "Chaman Road", "Kuchlak Road", "Spinny Road", "Joint Road", "Toghi Road",
      "Sirki Road", "Prince Road", "Liaquat Bazaar", "Kandahari Bazaar", "Suraj Ganj Bazaar",
      "Abdul Sattar Road", "Mecongi Road", "Shahrah-e-Iqbal", "RCD Highway", "Western Bypass",
      "Eastern Bypass",
    ],
  },
  {
    zone: "Surrounding towns",
    areas: ["Kuchlak", "Hanna Urak", "Kirani", "Baleli", "Dasht", "Panjpai", "Wali Tangi"],
  },
];
