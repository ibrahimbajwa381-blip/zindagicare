import type { AreaZone } from "./area-zone";

/** Faisalabad neighbourhoods by zone. Not exhaustive: the picker also accepts a typed area. */
export const FAISALABAD_ZONES: readonly AreaZone[] = [
  {
    zone: "Main residential areas",
    areas: [
      "Abdullahpur", "Amin Town", "Batala Colony", "Civil Lines", "D Ground", "Factory Area",
      "Ghulam Muhammad Abad", "Gobind Pura", "Gokhowal", "Gulbahar Colony", "Gulberg",
      "Gulistan Colony", "Madan Pura", "Manawala", "Mansoorabad", "Millat Town", "Nishatabad",
      "Peoples Colony No. 1", "Peoples Colony No. 2", "Saeed Colony", "Samanabad", "Tariqabad",
      "Jinnah Colony", "Aminabad", "Razaabad", "D-Type Colony", "Officer's Colony",
      "Gulistan Colony No. 1", "Gulistan Colony No. 2",
    ],
  },
  {
    zone: "Towns & surrounding localities",
    areas: [
      "Madina Town", "Jinnah Town", "Iqbal Town", "Lyallpur Town", "Chak Jhumra", "Jaranwala",
      "Samundri", "Tandlianwala", "Khurrianwala", "Dijkot", "Mamu Kanjan", "Satiana",
      "Mureedwala", "Sadhar", "Sahianwala", "Thikriwala", "Salarwala",
    ],
  },
  {
    zone: "Housing societies",
    areas: [
      "Abdullah Defence Housing Scheme", "Abdullah Farm Housing Scheme", "Adan Valley",
      "Air Avenue City", "Al Barkat Villas", "Al Jameel Housing Scheme", "Al Mehboob Garden",
      "Al Rehmat Villas", "Al-Hamra Town", "Al-Raheem Valley", "Ali Housing Colony",
      "Allied City", "Allied Housing Phase 2", "Amir Town", "Bilal City", "Canal Garden",
      "Canal Park", "Canal View Housing Scheme", "Canal Villas", "Chenab Gardens",
      "Citi Housing Society", "Citi Housing Society Phase 2", "City Villas",
      "Defence Fort Housing Scheme", "Doctor City", "Eden Executive", "Eden Gardens",
      "Eden Orchard", "Eden Valley", "FDA City", "Faisal Gardens", "Four Season Housing",
      "Ghalib City", "Green Valley", "Gulfishan Colony", "Ismail Valley", "Khayaban Colony",
      "Khayaban Colony 2", "Khayaban-e-Greens", "Kohinoor City", "Kohinoor Town",
      "Makkah Garden", "Madina Gardens", "Mannan Town", "Model City", "Model City 1",
      "Model City 2", "Motorway City", "Omega Residencia", "Paradise Valley",
      "Punjab Government Servants Housing Foundation", "Riaz-ul-Jannah", "Sitara Valley",
      "Sitara Supreme City", "SMD Homes", "Tech Town", "WAPDA City",
    ],
  },
  {
    zone: "Major roads",
    areas: [
      "Canal Road", "Canal Expressway", "Lower Canal Road", "Jaranwala Road", "Satiana Road",
      "Samundri Road", "Sargodha Road", "Jhang Road", "Sheikhupura Road", "Narwala Road",
      "Susan Road", "Susan Road vicinity", "Chen One Road", "Eid Gah Road", "College Road",
      "Millat Road", "Aminpur Road", "Satyana Road", "Faisalabad–Lahore Road",
      "Faisalabad–Jhang Road",
    ],
  },
  {
    zone: "Other localities",
    areas: [
      "Gulshan-e-Madina", "Sitara Gold City", "Raza Garden", "Sehgal City", "New Garden Town",
      "Shadman Colony", "Faisal Town", "Khayaban-e-Manzoor", "Deens Paradise", "Canal Valley",
      "Eden Executive Extension", "Officers Colony No. 1", "Officers Colony No. 2",
      "Al Noor Garden", "Madina Town extensions", "Millat Town extensions",
      "Peoples Colony blocks", "FDA City blocks", "WAPDA City blocks",
    ],
  },
];
