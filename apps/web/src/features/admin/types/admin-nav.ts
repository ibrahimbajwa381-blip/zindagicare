/** Actionable item counts shown beside admin sidebar links. */
export type AdminNavCounts = {
  doctors: number;
  nurses: number;
  physiotherapists: number;
  reviews: number;
  sundayConsult: number;
  urgentCare: number;
  /** Open home visits (requested or assigned), one count per provider queue. */
  homeVisitsDoctor: number;
  homeVisitsPhysiotherapist: number;
  homeVisitsNurse: number;
};
