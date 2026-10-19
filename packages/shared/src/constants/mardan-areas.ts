import type { AreaZone } from "./area-zone";

/** Mardan neighbourhoods by zone. Not exhaustive: the picker also accepts a typed area. */
export const MARDAN_ZONES: readonly AreaZone[] = [
  {
    zone: "Main areas",
    areas: [
      "Mardan City Centre", "Bank Road", "Mall Road", "Nowshera Road", "Charsadda Road",
      "Swabi Road", "Par Hoti", "Sheikh Maltoon Town", "Baghdada", "Bijli Ghar", "Toru", "Hoti",
      "Muslimabad", "Gujar Garhi", "Bakhshali", "Katlang Road area", "Rustam Road area",
      "Lund Khwar", "Shahbaz Garhi", "Takht Bhai Road area",
    ],
  },
  {
    zone: "Housing societies",
    areas: [
      "Mardan Enclave", "Prime Housing Scheme", "Green Acres Town", "Gulshan Model Town",
      "MerryLand Housing Society", "Shehryar Colony", "Akbar Colony", "New Muslim Town",
      "Officers Colony",
    ],
  },
];
