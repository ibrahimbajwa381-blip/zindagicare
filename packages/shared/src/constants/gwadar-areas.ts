import type { AreaZone } from "./area-zone";

/** Gwadar neighbourhoods by zone. Not exhaustive: the picker also accepts a typed area. */
export const GWADAR_ZONES: readonly AreaZone[] = [
  {
    zone: "Main areas",
    areas: [
      "Gwadar Central", "Old Town / Old Gwadar", "New Gwadar", "Airport Road", "Marine Drive",
      "Jinnah Avenue", "Makran Coastal Highway area", "Gwadar Port area",
      "Gwadar Free Zone vicinity", "Fish Harbour area", "Main Bazaar", "Gwadar East Bay area",
      "Gwadar West Bay area", "Airport vicinity", "Port vicinity", "Industrial Estate vicinity",
      "Komagri", "Gazrawan",
    ],
  },
  {
    zone: "Neighbourhoods & residential areas",
    areas: [
      "Mohallah Zahoor Shah", "Saleh Muhammad", "Sohrabi", "Usmania", "Kamari",
      "Mohallah Karim Bakhsh", "Mohallah Shahdu Band", "Mullah Band", "Murad Bakhsh", "Sarabi",
      "Sheikh Umar", "Tobagh", "Lal Baksh", "Mohalla Baloch", "Mohalla Mir Abdul Ghafoor",
      "Mujahid",
    ],
  },
];
