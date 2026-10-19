import type { AreaZone } from "./area-zone";

/** Kotri neighbourhoods by zone. Not exhaustive: the picker also accepts a typed area. */
export const KOTRI_ZONES: readonly AreaZone[] = [
  {
    zone: "Main areas",
    areas: [
      "Kotri City Centre", "SITE Kotri", "Kotri Railway Station area", "Indus Highway area",
      "Jamshoro Road", "Hyderabad Road", "Kotri Industrial Area", "Labour Colony",
      "Allah Bachayo Shoro Colony", "Gulshan-e-Shahbaz side", "Taluka Hospital area",
      "Kotri Barrage area", "Old Kotri", "New Kotri", "River Indus side residential area",
    ],
  },
  {
    zone: "Colonies & residential areas",
    areas: [
      "SITE residential area", "Officers Colony", "Railway Colony", "Jinnah Colony",
      "Ghulam Muhammad Colony", "Mehran Colony", "Shah Latif Colony", "Hussainabad", "Aliabad",
      "Qasimabad Road side", "Jamshoro Road residential belt", "Kotri Barrage residential area",
    ],
  },
];
