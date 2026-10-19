import { phases, type AreaZone } from "./area-zone";

const sectors = (letter: string, count: number) =>
  Array.from({ length: count }, (_, i) => `Hayatabad Sector ${letter}-${i + 1}`);

/**
 * Peshawar neighbourhoods by zone. Not exhaustive: the picker also accepts a
 * typed area. Hayatabad sectors are listed on their own, not tied to a phase,
 * because the phase-to-sector mapping is unconfirmed.
 */
export const PESHAWAR_ZONES: readonly AreaZone[] = [
  {
    zone: "Hayatabad",
    areas: [
      "Hayatabad",
      ...phases("Hayatabad Phase", 7),
      ...sectors("C", 4),
      ...sectors("D", 4),
      ...sectors("G", 4),
      ...sectors("H", 4),
      ...sectors("J", 5),
      ...sectors("K", 6),
      ...sectors("L", 3),
      ...sectors("M", 4),
      "Hayatabad Industrial Estate", "Industrial Estate Labour Colony",
      "Hayatabad Medical Complex", "Tatara Park", "Bagh-e-Naran",
      "Basharat Market", "Yasir Bin Ammar Market", "T&T Colony",
    ],
  },
  {
    zone: "University Town & Abdara Road",
    areas: [
      "University Town",
      "University Town Block A", "University Town Block B",
      "University Town Block C", "University Town Block D",
      "Abdara Road", "Old Jamrud Road", "Khushal Khan Khattak Road", "Canal Road",
      "Park Avenue Road", "Chinar Road", "Syed Jamal-ud-Din Afghani Road", "Gul Mehar Road",
      "Gulshan-e-Iqbal Road", "Officers Colony", "Danish Abad", "Tehkal Bala", "Tehkal Payan",
      "University of Peshawar", "Agriculture University", "Board Bazaar", "Nasir Bagh Road",
      "Sheikh Yaseen Town",
    ],
  },
  {
    zone: "Saddar & Cantonment",
    areas: [
      "Saddar Bazaar", "Saddar Road", "Mall Road", "Khyber Road", "Peshawar Cantt",
      "Army Stadium", "Peshawar Club", "Garrison Park", "Sher Khan Shaheed Road",
      "Gora Qabristan", "Lal Kurti", "Peshawar Railway Station", "Peshawar Airport",
    ],
  },
  {
    zone: "Old Peshawar & walled city",
    areas: [
      "Andar Shehr", "Qissa Khwani Bazaar", "Chowk Yadgar", "Ghanta Ghar", "Khyber Bazaar",
      "Kutchery Bazaar", "Meena Bazaar", "Mewa Mandi", "Karimpura", "Gor Khatri",
      "Sethi Mohallah", "Mohallah Baqir Shah", "Kohati Gate", "Hashtnagri", "Lahori Gate",
      "Ramdas", "Dabgari Gardens", "Ashraf Road", "Namak Mandi", "Chowk Shaheedan",
      "Bazar-e-Misgaran", "Sarafa Bazaar",
    ],
  },
  {
    zone: "Gulbahar & Faqirabad",
    areas: [
      ...phases("Gulbahar Phase", 4),
      "Faqirabad", "Faqirabad No. 1", "Faqirabad No. 2",
      "Gulbahar Colony", "Wazir Bagh", "Wazir Colony", "Sikandar Town", "Shaheen Muslim Town",
      "Nauthia", "Nauthia Jadid", "Sheikh Junaidabad", "Jahangirpura", "Gunj", "Akhunabad",
      "Hazar Khawani", "Hashtnagar", "Charsadda Road",
    ],
  },
  {
    zone: "Ring Road & Warsak Road",
    areas: [
      "Ring Road", "Warsak Road", "Regi Model Town", "Regi Lalma", "DHA Peshawar",
      "Wapda Town", "Canal View", "New University Model Town", "New University Model Town 2",
      "Police Colony", "Afridi Town", "Hasham Baber Town", "Saleem Homes",
      "Shams-ul-Qamar Colony", "Khyber Kalay Housing Scheme", "Army Welfare Housing Society",
      "Peshawar Enclave", "City Residencia", "City Oasis", "Gulshan-e-Peshawar",
      "University Garden", "Officers Housing Society",
      "Education Employees Foundation Housing Scheme", "Madina Residency",
      "Al-Moeez Housing Society",
    ],
  },
  {
    zone: "Dalazak Road & east",
    areas: [
      "Dalazak Road", "Yakatoot", "Rahatabad", "Zargarabad", "Gulshan-e-Rehman",
      "Sheikh Muhammadi", "Chughal Pura", "Wadpaga", "Pawaka", "Khazana", "Akbarpura Road",
      "Badaber Road", "Larama", "Badaber", "Mathra",
    ],
  },
  {
    zone: "Kohat Road & south",
    areas: [
      "Kohat Road", "Sufaid Dheri", "Pishtakhara", "Achini", "Achini Bala", "Achini Payan",
      "Regi", "Landi Arbab", "Arbab Road", "Musazai", "Sangu", "Mattani", "Urmar", "Kankola",
    ],
  },
  {
    zone: "Other housing societies",
    areas: [
      "Khyber Residencia", "Jalozai Housing Scheme", "Executive Lodges", "Al-Masa Model Town",
      "Mulazai Housing Scheme",
    ],
  },
  {
    zone: "Northern & outer Peshawar",
    areas: [
      "Chamkani", "Tarnab", "Shah Alam", "Babu Garhi", "Malkandher", "Palosi", "Nasir Bagh",
      "Warsak", "Jhagra",
    ],
  },
];
