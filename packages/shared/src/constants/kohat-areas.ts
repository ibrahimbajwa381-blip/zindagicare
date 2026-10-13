import type { AreaZone } from "./area-zone";

/** Kohat neighbourhoods by zone. Not exhaustive: the picker also accepts a typed area. */
export const KOHAT_ZONES: readonly AreaZone[] = [
  {
    zone: "Main areas",
    areas: [
      "Kohat City Centre", "Bannu Road", "Hangu Road", "Rawalpindi Road", "Peshawar Road",
      "Saddar Bazaar", "Main Bazaar", "Kachehri Road", "College Road", "University Road",
      "Tanda Road", "Jerma", "KDA Township", "Kohat Cantonment", "Kohat Development Authority area",
      "Gumbat Road side", "Shakardara Road side", "Hospital Road", "Railway Station area",
      "Bypass Road",
    ],
  },
  {
    zone: "Colonies & residential areas",
    areas: [
      "KDA Township", "Officers Colony", "Jinnah Colony", "Model Town", "Satellite Town",
      "Rehman Colony", "Muslimabad", "Cantt residential area", "University vicinity",
      "Tanda residential area",
    ],
  },
];
