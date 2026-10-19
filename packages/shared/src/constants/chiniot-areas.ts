import type { AreaZone } from "./area-zone";

/** Chiniot neighbourhoods by zone. Not exhaustive: the picker also accepts a typed area. */
export const CHINIOT_ZONES: readonly AreaZone[] = [
  {
    zone: "Main areas",
    areas: [
      "Chiniot City Centre", "Faisalabad Road", "Jhang Road", "Chenab Nagar Road", "Sargodha Road",
      "Railway Road", "Qazi Street area", "Shahi Masjid area", "Bhowana Road", "Thathi area",
      "Mohallah Islampura", "Mohallah Hussainabad", "Mohallah Razaabad", "Mohallah Madinaabad",
      "Mohallah Muhammadi", "Mohallah Usmanabad", "Mohallah Ghareebabad", "Mohallah Qadimi",
      "Mohallah Shah Ismail", "Mohallah Sheikhupura",
    ],
  },
  {
    zone: "Residential areas",
    areas: [
      "Satellite Town", "Officers Colony", "Jinnah Colony", "Model Town", "Gulshan-e-Madina",
      "Rehman City area", "Chenab Nagar side", "New Chiniot residential area",
      "Faisalabad Road residential belt", "Sargodha Road residential belt",
    ],
  },
];
