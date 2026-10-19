import type { AreaZone } from "./area-zone";
import { ABBOTTABAD_ZONES } from "./abbottabad-areas";
import { BAHAWALPUR_ZONES } from "./bahawalpur-areas";
import { CHARSADDA_ZONES } from "./charsadda-areas";
import { CHINIOT_ZONES } from "./chiniot-areas";
import { DERA_GHAZI_KHAN_ZONES } from "./dera-ghazi-khan-areas";
import { DERA_ISMAIL_KHAN_ZONES } from "./dera-ismail-khan-areas";
import { FAISALABAD_ZONES } from "./faisalabad-areas";
import { GUJRANWALA_ZONES } from "./gujranwala-areas";
import { GUJRAT_ZONES } from "./gujrat-areas";
import { HAFIZABAD_ZONES } from "./hafizabad-areas";
import { HARIPUR_ZONES } from "./haripur-areas";
import { HYDERABAD_ZONES } from "./hyderabad-areas";
import { ISLAMABAD_ZONES } from "./islamabad-areas";
import { JACOBABAD_ZONES } from "./jacobabad-areas";
import { JHANG_ZONES } from "./jhang-areas";
import { KAMOKE_ZONES } from "./kamoke-areas";
import { KARACHI_ZONES } from "./karachi-areas";
import { KASUR_ZONES } from "./kasur-areas";
import { KOTRI_ZONES } from "./kotri-areas";
import { LAHORE_ZONES } from "./lahore-areas";
import { LARKANA_ZONES } from "./larkana-areas";
import { LAYYAH_ZONES } from "./layyah-areas";
import { MANDI_BAHAUDDIN_ZONES } from "./mandi-bahauddin-areas";
import { MARDAN_ZONES } from "./mardan-areas";
import { MINGORA_ZONES } from "./mingora-areas";
import { MULTAN_ZONES } from "./multan-areas";
import { MUZAFFARABAD_ZONES } from "./muzaffarabad-areas";
import { MUZAFFARGARH_ZONES } from "./muzaffargarh-areas";
import { NAWABSHAH_ZONES } from "./nawabshah-areas";
import { OKARA_ZONES } from "./okara-areas";
import { PAKPATTAN_ZONES } from "./pakpattan-areas";
import { PESHAWAR_ZONES } from "./peshawar-areas";
import { QUETTA_ZONES } from "./quetta-areas";
import { RAHIM_YAR_KHAN_ZONES } from "./rahim-yar-khan-areas";
import { RAWALPINDI_ZONES } from "./rawalpindi-areas";
import { SAHIWAL_ZONES } from "./sahiwal-areas";
import { SARGODHA_ZONES } from "./sargodha-areas";
import { SHEIKHUPURA_ZONES } from "./sheikhupura-areas";
import { SIALKOT_ZONES } from "./sialkot-areas";
import { SUKKUR_ZONES } from "./sukkur-areas";
import { TURBAT_ZONES } from "./turbat-areas";
import { WAH_CANTONMENT_ZONES } from "./wah-cantonment-areas";
import { KHANEWAL_ZONES } from "./khanewal-areas";
import { JHELUM_ZONES } from "./jhelum-areas";
import { KHANPUR_ZONES } from "./khanpur-areas";
import { KHAIRPUR_ZONES } from "./khairpur-areas";
import { CHISHTIAN_ZONES } from "./chishtian-areas";
import { KOT_ADDU_ZONES } from "./kot-addu-areas";
import { MIRPUR_KHAS_ZONES } from "./mirpur-khas-areas";
import { ATTOCK_ZONES } from "./attock-areas";
import { SADIQABAD_ZONES } from "./sadiqabad-areas";
import { AHMEDPUR_EAST_ZONES } from "./ahmedpur-east-areas";
import { NOWSHERA_ZONES } from "./nowshera-areas";
import { CHAKWAL_ZONES } from "./chakwal-areas";
import { GOJRA_ZONES } from "./gojra-areas";
import { TOBA_TEK_SINGH_ZONES } from "./toba-tek-singh-areas";
import { MIANWALI_ZONES } from "./mianwali-areas";
import { GWADAR_ZONES } from "./gwadar-areas";
import { SWABI_ZONES } from "./swabi-areas";
import { RAWALAKOT_ZONES } from "./rawalakot-areas";
import { SKARDU_ZONES } from "./skardu-areas";
import { GILGIT_ZONES } from "./gilgit-areas";
import { BAHAWALNAGAR_ZONES } from "./bahawalnagar-areas";
import { VEHARI_ZONES } from "./vehari-areas";
import { SHIKARPUR_ZONES } from "./shikarpur-areas";
import { WAZIRABAD_ZONES } from "./wazirabad-areas";
import { BUREWALA_ZONES } from "./burewala-areas";
import { KOHAT_ZONES } from "./kohat-areas";
import { JARANWALA_ZONES } from "./jaranwala-areas";

export type { AreaZone } from "./area-zone";

/** Each area listed once per city (first zone wins, case-insensitive). */
function dedupe(zones: readonly AreaZone[]): readonly AreaZone[] {
  const seen = new Set<string>();
  return zones.map(({ zone, areas }) => ({
    zone,
    areas: areas.filter((area) => {
      const key = area.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }),
  }));
}

/** Cities with a curated area list, keyed by lowercase name. */
const CITY_AREA_ZONES: Readonly<Record<string, readonly AreaZone[]>> = {
  lahore: dedupe(LAHORE_ZONES),
  islamabad: dedupe(ISLAMABAD_ZONES),
  rawalpindi: dedupe(RAWALPINDI_ZONES),
  karachi: dedupe(KARACHI_ZONES),
  peshawar: dedupe(PESHAWAR_ZONES),
  faisalabad: dedupe(FAISALABAD_ZONES),
  multan: dedupe(MULTAN_ZONES),
  sialkot: dedupe(SIALKOT_ZONES),
  quetta: dedupe(QUETTA_ZONES),
  gujranwala: dedupe(GUJRANWALA_ZONES),
  hyderabad: dedupe(HYDERABAD_ZONES),
  bahawalpur: dedupe(BAHAWALPUR_ZONES),
  sargodha: dedupe(SARGODHA_ZONES),
  sukkur: dedupe(SUKKUR_ZONES),
  larkana: dedupe(LARKANA_ZONES),
  sheikhupura: dedupe(SHEIKHUPURA_ZONES),
  "rahim yar khan": dedupe(RAHIM_YAR_KHAN_ZONES),
  jhang: dedupe(JHANG_ZONES),
  "dera ghazi khan": dedupe(DERA_GHAZI_KHAN_ZONES),
  gujrat: dedupe(GUJRAT_ZONES),
  sahiwal: dedupe(SAHIWAL_ZONES),
  mardan: dedupe(MARDAN_ZONES),
  kasur: dedupe(KASUR_ZONES),
  okara: dedupe(OKARA_ZONES),
  mingora: dedupe(MINGORA_ZONES),
  nawabshah: dedupe(NAWABSHAH_ZONES),
  chiniot: dedupe(CHINIOT_ZONES),
  kotri: dedupe(KOTRI_ZONES),
  kamoke: dedupe(KAMOKE_ZONES),
  hafizabad: dedupe(HAFIZABAD_ZONES),
  muzaffargarh: dedupe(MUZAFFARGARH_ZONES),
  "dera ismail khan": dedupe(DERA_ISMAIL_KHAN_ZONES),
  turbat: dedupe(TURBAT_ZONES),
  muzaffarabad: dedupe(MUZAFFARABAD_ZONES),
  abbottabad: dedupe(ABBOTTABAD_ZONES),
  "mandi bahauddin": dedupe(MANDI_BAHAUDDIN_ZONES),
  jacobabad: dedupe(JACOBABAD_ZONES),
  layyah: dedupe(LAYYAH_ZONES),
  pakpattan: dedupe(PAKPATTAN_ZONES),
  haripur: dedupe(HARIPUR_ZONES),
  charsadda: dedupe(CHARSADDA_ZONES),
  rawalakot: dedupe(RAWALAKOT_ZONES),
  skardu: dedupe(SKARDU_ZONES),
  gilgit: dedupe(GILGIT_ZONES),
  bahawalnagar: dedupe(BAHAWALNAGAR_ZONES),
  vehari: dedupe(VEHARI_ZONES),
  shikarpur: dedupe(SHIKARPUR_ZONES),
  wazirabad: dedupe(WAZIRABAD_ZONES),
  burewala: dedupe(BUREWALA_ZONES),
  kohat: dedupe(KOHAT_ZONES),
  jaranwala: dedupe(JARANWALA_ZONES),
  sadiqabad: dedupe(SADIQABAD_ZONES),
  "ahmedpur east": dedupe(AHMEDPUR_EAST_ZONES),
  nowshera: dedupe(NOWSHERA_ZONES),
  chakwal: dedupe(CHAKWAL_ZONES),
  gojra: dedupe(GOJRA_ZONES),
  "toba tek singh": dedupe(TOBA_TEK_SINGH_ZONES),
  mianwali: dedupe(MIANWALI_ZONES),
  gwadar: dedupe(GWADAR_ZONES),
  swabi: dedupe(SWABI_ZONES),
  "wah cantonment": dedupe(WAH_CANTONMENT_ZONES),
  khanewal: dedupe(KHANEWAL_ZONES),
  jhelum: dedupe(JHELUM_ZONES),
  khanpur: dedupe(KHANPUR_ZONES),
  khairpur: dedupe(KHAIRPUR_ZONES),
  chishtian: dedupe(CHISHTIAN_ZONES),
  "kot addu": dedupe(KOT_ADDU_ZONES),
  "mirpur khas": dedupe(MIRPUR_KHAS_ZONES),
  attock: dedupe(ATTOCK_ZONES),
};

/** Area zones for `city`, or undefined when we have no list for it. */
export function areaZonesForCity(city: string | null | undefined): readonly AreaZone[] | undefined {
  return CITY_AREA_ZONES[(city ?? "").trim().toLowerCase()];
}

export function hasAreaList(city: string | null | undefined): boolean {
  return areaZonesForCity(city) !== undefined;
}
