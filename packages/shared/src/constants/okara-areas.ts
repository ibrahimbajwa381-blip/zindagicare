import type { AreaZone } from "./area-zone";

/** Okara neighbourhoods by zone. Not exhaustive: the picker also accepts a typed area. */
export const OKARA_ZONES: readonly AreaZone[] = [
  {
    zone: "Main areas",
    areas: [
      "Okara City Centre", "GT Road", "Depalpur Road", "Faisalabad Road", "Renala Road",
      "Multan Road", "Railway Road", "Stadium Road", "Church Road", "M.A. Jinnah Road",
      "College Road", "Sadar Bazaar", "Sabzi Mandi area", "Model Bazaar area", "Katchery Road",
    ],
  },
  {
    zone: "Colonies & residential areas",
    areas: [
      "Model Town", "Rehman Town", "Ameer Colony", "Faisal Colony", "Jinnah Colony", "Muslim Town",
      "Farid Town", "Officers Colony", "Canal Colony", "Gulshan-e-Iqbal Colony", "Madina Colony",
      "Christian Colony", "Tariqabad", "Garden Town", "Shah Faisal Colony",
    ],
  },
  {
    zone: "Housing societies",
    areas: [
      "Okara Housing Scheme", "Government Employees Housing Scheme", "Royal City", "New Okara City",
    ],
  },
];
