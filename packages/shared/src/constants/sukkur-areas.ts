import type { AreaZone } from "./area-zone";

/** Sukkur neighbourhoods by zone. Not exhaustive: the picker also accepts a typed area. */
export const SUKKUR_ZONES: readonly AreaZone[] = [
  {
    zone: "Main residential areas",
    areas: [
      "Sukkur City", "Sukkur Barrage area", "Military Road", "Queens Road", "Minara Road",
      "Shikarpur Road", "Station Road", "Airport Road", "New Pind", "Old Sukkur",
      "Sukkur Township", "Rohri Road area", "Bunder Road", "Clock Tower area", "Ghanta Ghar area",
      "Miani Road area", "Barrage Colony", "Labour Colony", "Officers Colony", "Satellite Town",
      "Pak Colony", "Bhutta Road area", "Qureshi Goth", "Islamia College area",
      "Adam Shah Colony", "Muhammad Bin Qasim Park vicinity", "Race Course Road area",
      "Military Housing area", "Queens Colony", "New Goth", "Shalimar area", "Numaish Gah area",
      "Bachal Shah Miani", "Ali Wahan", "Arain Road area", "Kandhra Road area",
    ],
  },
  {
    zone: "Housing societies",
    areas: [
      "Sukkur Cooperative Housing Society", "Mehran Housing Society", "Sukkur Housing Society",
      "Al-Rehman Housing Scheme", "New Sukkur Housing Scheme", "Green Town", "Gulshan-e-Iqbal",
      "Gulshan-e-Hyder", "Qureshi Goth residential area", "New Pind residential schemes",
      "Rohri Road housing schemes", "Airport Road housing schemes",
      "Shikarpur Road housing schemes",
    ],
  },
  {
    zone: "Major roads & markets",
    areas: [
      "Rohri Road", "Barrage Road", "Miani Road", "Arain Road", "Kandhra Road", "Sukkur Bypass",
      "National Highway N-5", "Clock Tower market", "Shahi Bazaar", "Ghanta Ghar market",
      "Sarafa Bazaar", "Frere Road commercial area", "Main Bus Stand area",
      "Railway Station area", "Sukkur Barrage vicinity",
    ],
  },
  {
    zone: "Surrounding towns",
    areas: [
      "Rohri", "Pano Aqil", "Saleh Pat", "Kandhra", "New Sukkur", "Bagarji", "Arain", "Sangi",
      "Kotri Kabir", "Mirpur Mathelo", "Ghotki", "Daharki", "Ubauro",
    ],
  },
];
