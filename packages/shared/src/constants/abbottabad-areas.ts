import type { AreaZone } from "./area-zone";

/** Abbottabad neighbourhoods by zone. Not exhaustive: the picker also accepts a typed area. */
export const ABBOTTABAD_ZONES: readonly AreaZone[] = [
  {
    zone: "Main areas",
    areas: [
      "Supply Bazaar", "Mandian", "Jinnahabad", "Nawanshehr", "Kakul Road", "Murree Road",
      "Mansehra Road", "Karakoram Highway area", "Fawara Chowk", "Kehal", "Salhad", "Bilal Town",
      "PMA Road area", "Shimla Hill area", "College Road", "Cantt area", "Main Bazaar",
      "Ayub Medical Complex area", "Abbottabad University vicinity", "Dhamtour Road",
    ],
  },
  {
    zone: "Colonies & residential areas",
    areas: [
      "Habibullah Colony", "Officers Colony", "Kehal residential area", "Salhad residential area",
      "Mandian residential area", "Kakul residential area", "Supply residential area",
    ],
  },
  {
    zone: "Housing societies",
    areas: [
      "Abbottabad Township Scheme", "Silk Valley Housing Scheme", "Askari Housing area",
      "Hassan Town", "Bilqias Town",
    ],
  },
];
